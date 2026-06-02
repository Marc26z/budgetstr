import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Copy, Eye, EyeOff, KeyRound, ShieldAlert } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';

interface RevealNsecDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The nsec (bech32) to reveal. */
  nsec: string;
}

/** Auto-close the reveal screen after this many ms to limit shoulder-surfing exposure. */
const AUTO_CLOSE_MS = 60_000;

/**
 * A two-step "Reveal my secret key" dialog.
 *
 * Step 1 — Warning gate: the user must explicitly acknowledge the danger of
 * exposing their nsec before it is shown.
 *
 * Step 2 — Reveal: the nsec is displayed masked by default with a show/hide
 * toggle and a copy button. The dialog auto-closes after 60 seconds to limit
 * shoulder-surfing exposure.
 *
 * The dialog state is fully reset whenever it closes, so re-opening always
 * starts at the warning gate.
 */
export function RevealNsecDialog({ open, onOpenChange, nsec }: RevealNsecDialogProps) {
  const { toast } = useToast();
  const [acknowledged, setAcknowledged] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset whenever the dialog is opened/closed.
  useEffect(() => {
    if (!open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setAcknowledged(false);
      setShowKey(false);
      setCopied(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      if (autoCloseRef.current) {
        clearTimeout(autoCloseRef.current);
        autoCloseRef.current = null;
      }
    }
  }, [open]);

  // Start the auto-close countdown once the user acknowledges the warning.
  useEffect(() => {
    if (open && acknowledged) {
      autoCloseRef.current = setTimeout(() => {
        onOpenChange(false);
      }, AUTO_CLOSE_MS);
    }
    return () => {
      if (autoCloseRef.current) {
        clearTimeout(autoCloseRef.current);
        autoCloseRef.current = null;
      }
    };
  }, [open, acknowledged, onOpenChange]);

  const copyNsec = async () => {
    if (!nsec) return;
    try {
      await navigator.clipboard.writeText(nsec);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Copied',
        description: 'Paste it into your password manager and clear your clipboard when done.',
      });
    } catch {
      toast({ title: 'Copy failed', description: 'Please copy the key manually.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-5 text-amber-400" /> Your secret key
          </DialogTitle>
          <DialogDescription>
            {acknowledged
              ? 'Save this somewhere safe — never share it with anyone.'
              : 'Read the warning carefully before continuing.'}
          </DialogDescription>
        </DialogHeader>

        {!acknowledged ? (
          // ──────────── Warning gate ────────────
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
              <ShieldAlert className="size-6 shrink-0 text-rose-400 mt-0.5" />
              <div className="space-y-2 text-sm text-rose-100">
                <p className="font-semibold text-rose-300">Keep this secret</p>
                <p className="text-xs text-rose-100/90">
                  Your secret key (<span className="font-mono">nsec</span>) is the
                  only key to your account. Anyone who sees it can:
                </p>
                <ul className="text-xs list-disc pl-5 space-y-1 text-rose-100/90">
                  <li>Read every encrypted budget entry, contact, and partner.</li>
                  <li>Impersonate you on Nostr.</li>
                  <li>Steal funds sent to any lightning address tied to your identity.</li>
                </ul>
              </div>
            </div>

            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 text-amber-400 mt-0.5" />
              <p className="text-xs text-amber-200">
                Only reveal your key in private. Never send it over chat, email, or screenshots.
                Save it in a password manager.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => setAcknowledged(true)}
                disabled={!nsec}
              >
                I understand — show my key
              </Button>
            </div>
          </div>
        ) : (
          // ──────────── Reveal ────────────
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reveal-nsec">Secret key (nsec)</Label>
              <div className="relative">
                <Input
                  id="reveal-nsec"
                  type={showKey ? 'text' : 'password'}
                  value={nsec}
                  readOnly
                  className="pr-20 font-mono text-base md:text-sm"
                  onFocus={(e) => e.currentTarget.select()}
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
                    onClick={copyNsec}
                    className="px-2 text-muted-foreground hover:text-foreground"
                    aria-label="Copy key"
                  >
                    {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 text-amber-400 mt-0.5" />
              <p className="text-xs text-amber-200">
                This dialog will close automatically after a minute. Anyone with this
                key has full access to your account — keep it secret.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button onClick={copyNsec} variant="outline" disabled={!nsec}>
                {copied ? (
                  <><Check className="size-4 mr-2 text-primary" /> Copied</>
                ) : (
                  <><Copy className="size-4 mr-2" /> Copy</>
                )}
              </Button>
              <Button onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
