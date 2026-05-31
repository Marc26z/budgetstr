import { useState } from 'react';
import { Eye, EyeOff, Loader2, ShieldCheck, Sparkles, Copy, Check } from 'lucide-react';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLoginActions } from '@/hooks/useLoginActions';
import { useToast } from '@/hooks/useToast';

const validateNsec = (nsec: string) => /^nsec1[a-z0-9]{58}$/i.test(nsec.trim());

/**
 * A budget-app-tailored login surface designed to play nicely with password
 * managers and passkey-style credential storage.
 *
 * The nsec is treated as a *password*: we render a real <form> with a hidden
 * username field and a password input marked with the appropriate autocomplete
 * hints. This lets 1Password, Bitwarden, iCloud Keychain and browser-native
 * managers offer to save/fill the nsec exactly like any other credential.
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

  // --- Create state ---
  const [generated, setGenerated] = useState('');
  const [copied, setCopied] = useState(false);

  const username = generated
    ? nip19.npubEncode(getPublicKey(nip19.decode(generated).data as Uint8Array))
      : nsec && validateNsec(nsec)
      ? safeNpub(nsec)
      : 'budgetstr';

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
        // Successful submit of the credential form lets the password manager
        // prompt to save it.
      } catch {
        setError("Couldn't log in with this key.");
        setBusy(false);
      }
    }, 50);
  };

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

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
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
                {busy ? <Loader2 className="size-4 animate-spin" /> : 'Log in'}
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

                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
                    <p className="text-xs text-amber-900 dark:text-amber-300">
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
