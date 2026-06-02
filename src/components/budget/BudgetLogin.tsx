import { useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  Fingerprint,
  Loader2,
  ShieldCheck,
  Sparkles,
  Copy,
  Check,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLoginActions } from '@/hooks/useLoginActions';
import { useToast } from '@/hooks/useToast';
import {
  createPasskeyAndStoreNsec,
  hasStoredPasskey,
  isPasskeySupported,
  reattachPasskey,
  signInWithPasskey,
} from '@/lib/passkey';

const validateNsec = (nsec: string) => /^nsec1[a-z0-9]{58}$/i.test(nsec.trim());

/**
 * The login surface. Three paths in to the app:
 *
 *   1. Passkey (top — recommended): create a new account or sign in using a
 *      Google Passkey / iCloud Keychain / Windows Hello passkey. The user's
 *      nsec is encrypted with a key derived from the passkey via WebAuthn's
 *      PRF extension and stored on-device. The user is also shown the nsec
 *      so they can back it up.
 *
 *   2. Log in with an existing nsec (tab): credential form for password
 *      managers — they auto-fill via the username/current-password fields.
 *
 *   3. Create a new account by generating a fresh nsec and saving it to
 *      a password manager (tab).
 */
export function BudgetLogin() {
  const login = useLoginActions();
  const { toast } = useToast();

  const [tab, setTab] = useState<'login' | 'create'>('login');

  // --- Login state ---
  const [nsec, setNsec] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // --- Create-with-nsec state ---
  const [generated, setGenerated] = useState('');
  const [copied, setCopied] = useState(false);

  // --- Passkey state ---
  const passkeySupported = isPasskeySupported();
  const [passkeyVaultExists, setPasskeyVaultExists] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  /** When set, we've just created a passkey-backed account and are showing
   *  the freshly-generated nsec for the user to back up before continuing. */
  const [passkeyBackupNsec, setPasskeyBackupNsec] = useState('');
  const [passkeyBackupCopied, setPasskeyBackupCopied] = useState(false);
  const [showBackupKey, setShowBackupKey] = useState(false);
  /** Open the inline "re-attach a synced passkey" form. */
  const [reattachOpen, setReattachOpen] = useState(false);
  const [reattachNsec, setReattachNsec] = useState('');
  const [reattachError, setReattachError] = useState('');
  const [showReattachKey, setShowReattachKey] = useState(false);

  useEffect(() => {
    if (!passkeySupported) return;
    let cancelled = false;
    hasStoredPasskey().then((exists) => {
      if (!cancelled) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPasskeyVaultExists(exists);
      }
    });
    return () => { cancelled = true; };
  }, [passkeySupported]);

  const username = generated
    ? nip19.npubEncode(getPublicKey(nip19.decode(generated).data as Uint8Array))
    : nsec && validateNsec(nsec)
      ? safeNpub(nsec)
      : 'budgetstr';

  // ---------------------------------------------------------------------------
  // Existing nsec login
  // ---------------------------------------------------------------------------
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateNsec(nsec)) {
      setError('Enter a valid secret key starting with nsec1.');
      return;
    }
    setBusy(true);
    setError('');
    setTimeout(() => {
      try {
        login.nsec(nsec.trim());
      } catch {
        setError("Couldn't log in with this key.");
        setBusy(false);
      }
    }, 50);
  };

  // ---------------------------------------------------------------------------
  // Create-by-saving-nsec flow
  // ---------------------------------------------------------------------------
  const generate = () => {
    const sk = generateSecretKey();
    setGenerated(nip19.nsecEncode(sk));
    setCopied(false);
  };

  const copyGenerated = async () => {
    try {
      await navigator.clipboard.writeText(generated);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Copy failed', description: 'Please copy the key manually.', variant: 'destructive' });
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!generated) return;
    setBusy(true);
    setTimeout(() => {
      try {
        login.nsec(generated);
      } catch {
        toast({ title: 'Could not create account', variant: 'destructive' });
        setBusy(false);
      }
    }, 50);
  };

  // ---------------------------------------------------------------------------
  // Passkey flows
  // ---------------------------------------------------------------------------
  const handlePasskeyCreate = async () => {
    setPasskeyBusy(true);
    try {
      const sk = generateSecretKey();
      const newNsec = nip19.nsecEncode(sk);
      const npub = nip19.npubEncode(getPublicKey(sk));
      // Use the npub as the displayed username inside the passkey UI so the
      // user can tell budgetstr passkeys apart from others on their device.
      await createPasskeyAndStoreNsec(newNsec, { username: `budgetstr (${npub.slice(0, 12)}…)` });
      setPasskeyBackupNsec(newNsec);
      setPasskeyVaultExists(true);
    } catch (err) {
      toast({
        title: 'Could not create passkey',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setPasskeyBusy(true);
    try {
      const recoveredNsec = await signInWithPasskey();
      login.nsec(recoveredNsec);
    } catch (err) {
      toast({
        title: 'Passkey sign-in failed',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
      setPasskeyBusy(false);
    }
  };

  /**
   * Re-attach an existing (synced) passkey to this device. WebAuthn passkeys
   * never expose extractable bytes, so to bootstrap the local encrypted vault
   * here we need the nsec once. After the user's passkey signs the assertion,
   * the PRF secret encrypts the supplied nsec and stores the new vault — and
   * subsequent sign-ins on this device use the simple passkey path.
   */
  const handleReattach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateNsec(reattachNsec)) {
      setReattachError('Enter a valid secret key starting with nsec1.');
      return;
    }
    setPasskeyBusy(true);
    setReattachError('');
    try {
      await reattachPasskey(reattachNsec.trim());
      // Vault is now stored locally; complete the login.
      login.nsec(reattachNsec.trim());
      setReattachOpen(false);
      setReattachNsec('');
      setPasskeyVaultExists(true);
    } catch (err) {
      setReattachError(err instanceof Error ? err.message : 'Could not link the passkey.');
      setPasskeyBusy(false);
    }
  };

  const finishPasskeyBackup = () => {
    if (!passkeyBackupNsec) return;
    try {
      login.nsec(passkeyBackupNsec);
    } catch {
      toast({ title: 'Could not log in', variant: 'destructive' });
    }
  };

  const copyPasskeyBackupNsec = async () => {
    try {
      await navigator.clipboard.writeText(passkeyBackupNsec);
      setPasskeyBackupCopied(true);
      setTimeout(() => setPasskeyBackupCopied(false), 2000);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  // ---------------------------------------------------------------------------
  // Backup screen — shown right after a passkey-backed account is created
  // ---------------------------------------------------------------------------
  if (passkeyBackupNsec) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-6 flex flex-col items-center">
          <img
            src="/logo.jpg"
            alt="budgetstr"
            className="size-20 rounded-2xl object-cover shadow-lg shadow-primary/25 mb-3"
          />
          <h1 className="text-2xl font-bold tracking-tight">Back up your key</h1>
          <p className="text-muted-foreground mt-2 text-sm max-w-sm">
            Your account is secured by a passkey on this device. Save your secret
            key (nsec) somewhere safe — you'll need it to log in on a different
            device or if you lose your passkey.
          </p>
        </div>

        <div className="rounded-2xl border bg-card shadow-sm p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="backup-nsec">Your secret key (nsec)</Label>
            <div className="relative">
              <Input
                id="backup-nsec"
                type={showBackupKey ? 'text' : 'password'}
                value={passkeyBackupNsec}
                readOnly
                className="pr-20 font-mono text-base md:text-sm"
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                <button
                  type="button"
                  onClick={() => setShowBackupKey((s) => !s)}
                  className="px-2 text-muted-foreground hover:text-foreground"
                  aria-label={showBackupKey ? 'Hide key' : 'Show key'}
                >
                  {showBackupKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
                <button
                  type="button"
                  onClick={copyPasskeyBackupNsec}
                  className="px-2 text-muted-foreground hover:text-foreground"
                  aria-label="Copy key"
                >
                  {passkeyBackupCopied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
            <p className="text-xs text-amber-300">
              Without this key, you cannot recover your account if your device is
              lost. Store it in a password manager or write it down.
            </p>
          </div>

          <Button onClick={finishPasskeyBackup} className="w-full h-11">
            I've saved it — continue
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main login surface
  // ---------------------------------------------------------------------------
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8 flex flex-col items-center">
        <img
          src="/logo.jpg"
          alt="budgetstr"
          className="size-24 rounded-2xl object-cover shadow-lg shadow-primary/25 mb-2"
        />
        <h1 className="text-3xl font-bold tracking-tight text-primary drop-shadow-[0_0_12px_rgba(45,212,191,0.4)]">budgetstr</h1>
        <p className="text-muted-foreground mt-2 text-base">
          Private, encrypted budgeting on Nostr.
        </p>
      </div>

      {/* Passkey card — only when supported */}
      {passkeySupported && (
        <div className="rounded-2xl border bg-card shadow-sm p-5 mb-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Fingerprint className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {passkeyVaultExists ? 'Continue with passkey' : 'Use a passkey'}
              </p>
              <p className="text-xs text-muted-foreground">
                {passkeyVaultExists
                  ? 'Sign in with your fingerprint, face, or screen lock.'
                  : 'Sign in with an existing passkey, or create a new account.'}
              </p>
            </div>
          </div>

          {passkeyVaultExists ? (
            // Vault on this device — single-tap sign-in.
            <>
              <Button
                onClick={handlePasskeySignIn}
                className="w-full h-11"
                disabled={passkeyBusy}
              >
                {passkeyBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Fingerprint className="size-4 mr-2" />
                    Sign in with passkey
                  </>
                )}
              </Button>
              <button
                type="button"
                onClick={() => setPasskeyVaultExists(false)}
                className="w-full text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
              >
                <ArrowLeft className="size-3" /> Use a different account
              </button>
            </>
          ) : reattachOpen ? (
            // No local vault but the user has a passkey from another device.
            // Re-attach it by re-encrypting their nsec with the PRF secret.
            <form onSubmit={handleReattach} className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Paste your secret key once to link your passkey on this device. Future
                sign-ins won't need it.
              </p>
              <div className="relative">
                <Input
                  type={showReattachKey ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={reattachNsec}
                  onChange={(e) => { setReattachNsec(e.target.value); if (reattachError) setReattachError(''); }}
                  placeholder="nsec1…"
                  className="pr-10 font-mono text-base md:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowReattachKey((s) => !s)}
                  className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                  aria-label={showReattachKey ? 'Hide key' : 'Show key'}
                >
                  {showReattachKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {reattachError && <p className="text-sm text-destructive">{reattachError}</p>}
              <Button
                type="submit"
                className="w-full h-11"
                disabled={passkeyBusy || !reattachNsec.trim()}
              >
                {passkeyBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Fingerprint className="size-4 mr-2" />
                    Link &amp; sign in
                  </>
                )}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setReattachOpen(false);
                  setReattachNsec('');
                  setReattachError('');
                }}
                className="w-full text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
              >
                <ArrowLeft className="size-3" /> Back
              </button>
            </form>
          ) : (
            // No local vault — primary CTA is "Sign in with existing passkey",
            // secondary is creating a brand-new account.
            <>
              <Button
                onClick={() => { setReattachOpen(true); setReattachError(''); }}
                className="w-full h-11"
                disabled={passkeyBusy}
              >
                <Fingerprint className="size-4 mr-2" />
                Sign in with existing passkey
              </Button>
              <Button
                variant="outline"
                onClick={handlePasskeyCreate}
                className="w-full h-11"
                disabled={passkeyBusy}
              >
                {passkeyBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="size-4 mr-2" />
                    Create new account with passkey
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      )}

      <div className="rounded-2xl border bg-card shadow-sm p-6">
        <Tabs value={tab} onValueChange={(v) => { setTab(v as 'login' | 'create'); setError(''); }}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="login">Log in</TabsTrigger>
            <TabsTrigger value="create">Create account</TabsTrigger>
          </TabsList>

          {/* LOGIN — credential form for password managers */}
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4" autoComplete="on">
              {/* Hidden username gives password managers a credential identity to store the nsec against. */}
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={username}
                readOnly
                tabIndex={-1}
                aria-hidden="true"
                className="hidden"
              />

              <div className="space-y-2">
                <Label htmlFor="nsec-password">Secret key (nsec)</Label>
                <div className="relative">
                  <Input
                    id="nsec-password"
                    name="password"
                    type={showKey ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={nsec}
                    onChange={(e) => { setNsec(e.target.value); if (error) setError(''); }}
                    placeholder="nsec1…"
                    className="pr-10 font-mono text-base md:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((s) => !s)}
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                    aria-label={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <ShieldCheck className="size-3.5 mt-0.5 shrink-0 text-primary" />
                  Save your nsec in your password manager — it's the only key to your budget.
                </p>
              </div>

              <Button type="submit" className="w-full h-11" disabled={busy || !nsec.trim()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <><KeyRound className="size-4 mr-2" /> Log in</>}
              </Button>
            </form>
          </TabsContent>

          {/* CREATE — generate a new nsec and save it to the password manager */}
          <TabsContent value="create">
            <form onSubmit={handleCreate} className="space-y-4" autoComplete="on">
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={username}
                readOnly
                tabIndex={-1}
                aria-hidden="true"
                className="hidden"
              />

              {!generated ? (
                <div className="text-center py-4 space-y-4">
                  <div className="inline-flex items-center justify-center size-14 rounded-full bg-primary/10">
                    <Sparkles className="size-7 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    We'll generate a brand-new secret key. Store it in your password manager so you
                    can log in from anywhere.
                  </p>
                  <Button type="button" onClick={generate} className="w-full h-11">
                    Generate my key
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-nsec">Your new secret key</Label>
                    <div className="relative">
                      <Input
                        id="new-nsec"
                        name="password"
                        type={showKey ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={generated}
                        readOnly
                        className="pr-20 font-mono text-base md:text-sm"
                      />
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                        <button
                          type="button"
                          onClick={() => setShowKey((s) => !s)}
                          className="px-2 text-muted-foreground hover:text-foreground"
                          aria-label={showKey ? 'Hide key' : 'Show key'}
                        >
                          {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={copyGenerated}
                          className="px-2 text-muted-foreground hover:text-foreground"
                          aria-label="Copy key"
                        >
                          {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                    <p className="text-xs text-amber-300">
                      This key is your only way in. Save it in your password manager now — there is
                      no recovery if it's lost.
                    </p>
                  </div>

                  <Button type="submit" className="w-full h-11" disabled={busy}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : "I've saved it — continue"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setGenerated('')}
                    className="w-full text-sm text-muted-foreground hover:text-foreground"
                  >
                    Generate a different key
                  </button>
                </div>
              )}
            </form>
          </TabsContent>
        </Tabs>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-6">
        Vibed with{' '}
        <a
          href="https://shakespeare.diy"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Shakespeare
        </a>
      </p>
    </div>
  );
}

function safeNpub(nsec: string): string {
  try {
    const decoded = nip19.decode(nsec.trim());
    if (decoded.type !== 'nsec') return 'budgetstr';
    return nip19.npubEncode(getPublicKey(decoded.data));
  } catch {
    return 'budgetstr';
  }
}
