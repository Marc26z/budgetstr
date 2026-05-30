import { useState } from 'react';
import { Heart, Loader2, Trash2, UserPlus } from 'lucide-react';
import { nip19 } from 'nostr-tools';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePartners, useSavePartners } from '@/hooks/usePartners';
import { useBudgetEntries } from '@/hooks/useBudgetEntries';
import { useBackfillPartner } from '@/hooks/useBackfillPartner';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { useToast } from '@/hooks/useToast';
import type { Partner } from '@/lib/budget';

interface PartnersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Resolve an npub / nprofile / hex pubkey to a hex pubkey. */
function resolvePubkey(input: string): string | null {
  const trimmed = input.trim();
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
  try {
    const decoded = nip19.decode(trimmed);
    if (decoded.type === 'npub') return decoded.data;
    if (decoded.type === 'nprofile') return decoded.data.pubkey;
  } catch {
    return null;
  }
  return null;
}

export function PartnersDialog({ open, onOpenChange }: PartnersDialogProps) {
  const { data: partners = [], isLoading } = usePartners();
  const { data: entries = [] } = useBudgetEntries();
  const { mutateAsync: savePartners, isPending } = useSavePartners();
  const { mutateAsync: backfill, isPending: isBackfilling } = useBackfillPartner();
  const { toast } = useToast();

  const [input, setInput] = useState('');
  const [label, setLabel] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const pubkey = resolvePubkey(input);
    if (!pubkey) {
      toast({ title: 'Invalid identifier', description: 'Enter a valid npub.', variant: 'destructive' });
      return;
    }
    if (partners.some((p) => p.pubkey === pubkey)) {
      toast({ title: 'Already a partner', variant: 'destructive' });
      return;
    }

    const next: Partner[] = [...partners, { pubkey, name: label.trim() || undefined }];
    try {
      await savePartners(next);
      setInput('');
      setLabel('');

      // Share all existing entries so the combined balance is populated now.
      if (entries.length > 0) {
        const { failed, total } = await backfill({ partnerPubkey: pubkey, entries });
        if (failed > 0) {
          toast({
            title: 'Partner added',
            description: `Shared ${total - failed} of ${total} entries. Some couldn't be shared right now.`,
          });
        } else {
          toast({
            title: 'Partner added',
            description: `Your ${total} existing ${total === 1 ? 'entry' : 'entries'} are now shared.`,
          });
        }
      } else {
        toast({ title: 'Partner added' });
      }
    } catch (err) {
      toast({
        title: 'Could not add partner',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const handleRemove = async (pubkey: string) => {
    const next = partners.filter((p) => p.pubkey !== pubkey);
    try {
      await savePartners(next);
      toast({
        title: 'Partner removed',
        description: 'They will no longer be pooled into your combined balance.',
      });
    } catch (err) {
      toast({
        title: 'Could not remove',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const busy = isPending || isBackfilling;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="size-5 text-primary" /> Shared balance
          </DialogTitle>
          <DialogDescription>
            Link with a spouse or partner by their npub. Your income and expenses are pooled into a
            combined balance, income, and expense total — and so are theirs.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAdd} className="space-y-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="npub1…"
            className="font-mono text-base md:text-sm"
          />
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional, e.g. Spouse)"
            className="text-base md:text-sm"
          />
          <Button type="submit" className="w-full" disabled={busy || !input.trim()}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="size-4 mr-2" /> Link partner
              </>
            )}
          </Button>
        </form>

        <div className="rounded-lg bg-muted/50 border p-3">
          <p className="text-xs text-muted-foreground">
            For a two-way shared balance, your partner needs to add you back in their own budgetstr.
            Each side shares its entries with the other, encrypted end-to-end.
          </p>
        </div>

        <div className="border-t pt-4">
          {isLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : partners.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No partners linked yet.
            </p>
          ) : (
            <div className="space-y-1 max-h-[40vh] overflow-y-auto">
              {partners.map((partner) => (
                <PartnerRow
                  key={partner.pubkey}
                  partner={partner}
                  onRemove={() => handleRemove(partner.pubkey)}
                  disabled={busy}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PartnerRow({
  partner,
  onRemove,
  disabled,
}: {
  partner: Partner;
  onRemove: () => void;
  disabled: boolean;
}) {
  const author = useAuthor(partner.pubkey);
  const meta = author.data?.metadata;
  const name = partner.name?.trim() || meta?.name || meta?.display_name || genUserName(partner.pubkey);
  const npub = nip19.npubEncode(partner.pubkey);

  return (
    <div className="flex items-center gap-3 rounded-lg p-2">
      <Avatar size="sm">
        <AvatarImage src={meta?.picture} alt={name} />
        <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate font-mono">{npub.slice(0, 18)}…</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${name}`}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
