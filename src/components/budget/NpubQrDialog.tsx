import { useState } from 'react';
import { Check, Copy, QrCode } from 'lucide-react';
import { nip19 } from 'nostr-tools';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QRCodeCanvas } from '@/components/ui/qrcode';
import { useToast } from '@/hooks/useToast';

interface NpubQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hex pubkey of the account whose npub should be displayed. */
  pubkey: string;
}

/**
 * Show the user's npub as a scannable QR code so others can quickly add
 * them as a contact, partner, or budget recipient. Includes a copy button
 * for falling back to text-based sharing.
 */
export function NpubQrDialog({ open, onOpenChange, pubkey }: NpubQrDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const npub = pubkey ? nip19.npubEncode(pubkey) : '';

  const copyNpub = async () => {
    if (!npub) return;
    try {
      await navigator.clipboard.writeText(npub);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <QrCode className="size-5 text-primary" /> Your npub
          </DialogTitle>
          <DialogDescription>
            Share this code so others can find you on Nostr — to add as a contact,
            link as a partner, or send shared entries.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {npub ? (
            <div className="rounded-xl bg-white p-4">
              <QRCodeCanvas value={npub} size={220} level="M" />
            </div>
          ) : (
            <div className="size-[220px] rounded-xl bg-muted" />
          )}

          <p className="text-xs text-muted-foreground font-mono text-center break-all px-2">
            {npub}
          </p>

          <Button
            variant="outline"
            onClick={copyNpub}
            disabled={!npub}
            className="w-full"
          >
            {copied ? (
              <><Check className="size-4 mr-2 text-primary" /> Copied</>
            ) : (
              <><Copy className="size-4 mr-2" /> Copy npub</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
