/**
 * Passkey-backed nsec storage using WebAuthn + the PRF extension.
 *
 * What this enables:
 * - The user creates an account with a Google Passkey (or any other
 *   platform passkey: iCloud Keychain, 1Password, Windows Hello, …).
 * - Their nsec is encrypted with a key derived from the passkey via the
 *   WebAuthn `prf` extension (`hmac-secret` on the platform side).
 * - The encrypted nsec lives in secure storage (Keychain / KeyStore on
 *   native, localStorage on web). Without the passkey, it cannot be
 *   decrypted — even by JavaScript on this origin.
 * - To sign back in, the user authenticates with their passkey; we
 *   re-derive the PRF secret and decrypt the nsec.
 *
 * Why PRF (not just storing the nsec inside the credential):
 *   WebAuthn credentials are cryptographic keypairs whose private bytes
 *   are non-extractable. We can't pull the nsec out of one. The PRF
 *   extension lets us derive a deterministic 32-byte secret from the
 *   credential — perfect as an AES-GCM key.
 *
 * Security notes:
 * - The PRF salt is fixed per-app, so calling getCredential() with the
 *   same salt on the same passkey yields the same secret. We use that
 *   secret as a wrapping key, never persisting it.
 * - A fresh AES-GCM IV is generated per encrypt; both ciphertext and IV
 *   are stored alongside the credentialId.
 * - If the user has a Google account on the device, Android's Credential
 *   Manager will show "Save with Google Password Manager" / "Sign in
 *   with Google" — the same passkey UX described at
 *   https://www.google.com/account/about/passkeys.
 */

import { secureStorage } from '@/lib/secureStorage';

/** Storage key for the encrypted vault. */
const STORAGE_KEY = 'budgetstr:passkey-vault';

/** Fixed PRF salt — must be 32 bytes, app-specific, never changes. */
const PRF_SALT = new TextEncoder().encode('budgetstr/passkey/v1/prf-salt-fix');

/** Relying-Party identifier. Use the current hostname (or 'localhost'). */
function getRpId(): string {
  if (typeof window === 'undefined') return 'localhost';
  return window.location.hostname || 'localhost';
}

/** A user's stored passkey vault. */
interface PasskeyVault {
  /** The credential id, base64url. */
  credentialId: string;
  /** AES-GCM IV used for the ciphertext, base64url (12 bytes). */
  iv: string;
  /** AES-GCM ciphertext of the nsec (UTF-8), base64url. */
  ciphertext: string;
  /** ISO timestamp for display ("Created Jun 1, 2026"). */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Base64url helpers (no padding, URL-safe)
// ---------------------------------------------------------------------------

function bufToB64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBuf(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    b64url.length + ((4 - (b64url.length % 4)) % 4),
    '=',
  );
  const str = atob(b64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

// ---------------------------------------------------------------------------
// Capability detection
// ---------------------------------------------------------------------------

/** Whether the platform exposes WebAuthn at all. */
export function isPasskeySupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    !!navigator.credentials &&
    typeof navigator.credentials.create === 'function' &&
    typeof navigator.credentials.get === 'function'
  );
}

// ---------------------------------------------------------------------------
// Vault persistence
// ---------------------------------------------------------------------------

/** Check if a passkey vault is stored on this device. */
export async function hasStoredPasskey(): Promise<boolean> {
  const raw = await secureStorage.getItem(STORAGE_KEY);
  return !!raw;
}

async function loadVault(): Promise<PasskeyVault | null> {
  const raw = await secureStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PasskeyVault;
    if (!parsed.credentialId || !parsed.iv || !parsed.ciphertext) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function saveVault(vault: PasskeyVault): Promise<void> {
  await secureStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
}

/** Remove the stored passkey vault from this device. */
export async function clearStoredPasskey(): Promise<void> {
  await secureStorage.removeItem(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Crypto: derive an AES-GCM key from the PRF output
// ---------------------------------------------------------------------------

async function importPrfKey(prfBytes: ArrayBuffer): Promise<CryptoKey> {
  // The PRF output is already 32 bytes of high-entropy material — use it
  // directly as an AES-256-GCM key.
  return crypto.subtle.importKey(
    'raw',
    prfBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ---------------------------------------------------------------------------
// WebAuthn — extract the PRF result safely
// ---------------------------------------------------------------------------

interface PrfClientExtensionResults {
  prf?: { results?: { first?: ArrayBuffer } };
}

function extractPrfResult(cred: PublicKeyCredential): ArrayBuffer | null {
  const exts = cred.getClientExtensionResults() as PrfClientExtensionResults;
  return exts.prf?.results?.first ?? null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CreatePasskeyOptions {
  /** Display name used by the authenticator UI (e.g. "Alice's budgetstr"). */
  username?: string;
}

/**
 * Register a new passkey and use its PRF secret to encrypt the given nsec.
 * After this resolves, `signInWithPasskey()` will be able to recover the
 * nsec by re-authenticating the same passkey.
 *
 * Throws if the platform doesn't support PRF or the user cancels.
 */
export async function createPasskeyAndStoreNsec(
  nsec: string,
  options: CreatePasskeyOptions = {},
): Promise<void> {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys are not supported on this device.');
  }

  const username = options.username || 'budgetstr';
  // The user handle is a stable random id for this credential — not an email.
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  let credential: PublicKeyCredential;
  try {
    credential = (await navigator.credentials.create({
      publicKey: {
        rp: { id: getRpId(), name: 'budgetstr' },
        user: {
          id: userId,
          name: username,
          displayName: username,
        },
        challenge,
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        timeout: 60_000,
        authenticatorSelection: {
          // `platform` = device-bound passkey (Google Password Manager,
          // iCloud Keychain, Windows Hello). `required` = must be a real
          // passkey with user verification.
          authenticatorAttachment: 'platform',
          residentKey: 'required',
          userVerification: 'required',
        },
        extensions: {
          // Ask the authenticator to evaluate the PRF at registration time
          // so we can wrap the nsec immediately. Some platforms only honor
          // PRF on subsequent get() calls — we handle both cases below.
          prf: { eval: { first: PRF_SALT } },
        } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential;
  } catch (err) {
    if (err instanceof Error && err.name === 'NotAllowedError') {
      throw new Error('Passkey creation was cancelled.');
    }
    throw err;
  }

  if (!credential) {
    throw new Error('Passkey creation failed.');
  }

  const credentialId = bufToB64url(credential.rawId);

  // Try to use the PRF result returned from `create`. If absent (some
  // browsers / authenticators only return PRF from `get`), do an immediate
  // `get` to harvest it.
  let prf = extractPrfResult(credential);
  if (!prf) {
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: getRpId(),
        allowCredentials: [{ type: 'public-key', id: credential.rawId }],
        userVerification: 'required',
        timeout: 60_000,
        extensions: {
          prf: { eval: { first: PRF_SALT } },
        } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null;

    if (!assertion) {
      throw new Error('Could not derive an encryption key from the passkey.');
    }
    prf = extractPrfResult(assertion);
  }

  if (!prf) {
    throw new Error(
      'Your passkey provider does not support the PRF extension. Try using Google Password Manager (Chrome on Android) or iCloud Keychain.',
    );
  }

  // Encrypt the nsec with the PRF-derived key.
  const aesKey = await importPrfKey(prf);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    new TextEncoder().encode(nsec),
  );

  await saveVault({
    credentialId,
    iv: bufToB64url(iv),
    ciphertext: bufToB64url(ciphertext),
    createdAt: new Date().toISOString(),
  });
}

/**
 * Authenticate with the stored passkey, derive the PRF secret, and decrypt
 * the stored nsec. Returns the nsec string on success.
 *
 * Throws if no passkey is stored, the user cancels, or PRF is unavailable.
 */
export async function signInWithPasskey(): Promise<string> {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys are not supported on this device.');
  }

  const vault = await loadVault();
  if (!vault) {
    throw new Error('No passkey is set up on this device.');
  }

  const credentialIdBytes = b64urlToBuf(vault.credentialId);

  let assertion: PublicKeyCredential | null;
  try {
    assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: getRpId(),
        allowCredentials: [{ type: 'public-key', id: credentialIdBytes }],
        userVerification: 'required',
        timeout: 60_000,
        extensions: {
          prf: { eval: { first: PRF_SALT } },
        } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null;
  } catch (err) {
    if (err instanceof Error && err.name === 'NotAllowedError') {
      throw new Error('Passkey sign-in was cancelled.');
    }
    throw err;
  }

  if (!assertion) {
    throw new Error('Passkey sign-in failed.');
  }

  const prf = extractPrfResult(assertion);
  if (!prf) {
    throw new Error(
      'Could not derive an encryption key from this passkey. The passkey provider may not support the PRF extension.',
    );
  }

  const aesKey = await importPrfKey(prf);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64urlToBuf(vault.iv) },
      aesKey,
      b64urlToBuf(vault.ciphertext),
    );
  } catch {
    throw new Error('The passkey did not match the stored vault.');
  }

  return new TextDecoder().decode(plaintext);
}

/**
 * Re-attach an existing passkey to this device by re-encrypting the user's
 * supplied nsec with the passkey's PRF secret.
 *
 * This is the "I already have a passkey on another device, sign me in here"
 * flow. WebAuthn passkeys themselves contain no extractable bytes — they only
 * yield a deterministic PRF secret per credential. To rebuild the local
 * encrypted vault on a new device we need the nsec once (from the user's
 * password manager / written backup), which we then re-encrypt with the PRF
 * key derived from the passkey assertion.
 *
 * Uses a *discoverable* assertion (no `allowCredentials`) so the platform
 * presents any synced passkey for this RP — including ones created on a
 * different device. After this resolves, future sign-ins on this device can
 * use the simple `signInWithPasskey()` path.
 *
 * Throws if PRF is unavailable, the user cancels, or the platform supplies
 * no passkey.
 */
export async function reattachPasskey(nsec: string): Promise<void> {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys are not supported on this device.');
  }

  let assertion: PublicKeyCredential | null;
  try {
    assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: getRpId(),
        // No allowCredentials: invite the platform to show every synced
        // passkey for this RP so the user can pick the right one.
        userVerification: 'required',
        timeout: 60_000,
        extensions: {
          prf: { eval: { first: PRF_SALT } },
        } as AuthenticationExtensionsClientInputs,
      },
      // Hint: prefer the platform/synced authenticator UI when supported.
      mediation: 'optional',
    } as CredentialRequestOptions)) as PublicKeyCredential | null;
  } catch (err) {
    if (err instanceof Error && err.name === 'NotAllowedError') {
      throw new Error('Passkey sign-in was cancelled.');
    }
    throw err;
  }

  if (!assertion) {
    throw new Error('No passkey was selected.');
  }

  const prf = extractPrfResult(assertion);
  if (!prf) {
    throw new Error(
      'Could not derive an encryption key from this passkey. The passkey provider may not support the PRF extension.',
    );
  }

  const credentialId = bufToB64url(assertion.rawId);
  const aesKey = await importPrfKey(prf);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    new TextEncoder().encode(nsec),
  );

  await saveVault({
    credentialId,
    iv: bufToB64url(iv),
    ciphertext: bufToB64url(ciphertext),
    createdAt: new Date().toISOString(),
  });
}
