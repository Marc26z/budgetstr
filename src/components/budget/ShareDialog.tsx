import { useEffect, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import { nip19 } from 'nostr-tools';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useContacts } from '@/hooks/useContacts';
import { useShareEntry } from '@/hooks/useShareEntry';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { useToast } from '@/hooks/useToast';
import type { BudgetEntry, Contact } from '@/lib/budget';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: BudgetEntry | null;
  onManageContacts: () => void;
}

export function ShareDialog({ open, onOpenChange, entry, onManageContacts }: ShareDialogProps) {
  const { data: contacts = [], isLoading } = useContacts();
  const { mutateAsync: shareEntry, isPending } = useShareEntry();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(new Set());
    }
  }, [open]);

  const toggle = (pubkey: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pubkey)) next.delete(pubkey);
      else next.add(pubkey);
      return next;
    });
  };

  const handleShare = async () => {
    if (!entry || selected.size === 0) return;
    try {
      await shareEntry({ entry, recipients: [...selected] });
      toast({
        title: 'Shared',
        description: `"${entry.title}" shared with ${selected.size} ${
          selected.size === 1 ? 'person' : 'people'
        }.`,
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Could not share',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share entry</DialogTitle>
          <DialogDescription>
            {entry
              ? `Choose who to share "${entry.title}" with. It's re-encrypted for each recipient.`
              : 'Choose who to share with.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <div className="inline-flex items-center justify-center size-12 rounded-full bg-muted">
              <Users className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              You haven't added anyone yet. Add a person to start sharing budget entries.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onManageContacts();
              }}
            >
              Add a person
            </Button>
          </div>
        ) : (
          <div className="space-y-1 max-h-[50vh] overflow-y-auto -mx-1 px-1">
            {contacts.map((contact) => (
              <ContactRow
                key={contact.pubkey}
                contact={contact}
                checked={selected.has(contact.pubkey)}
                onToggle={() => toggle(contact.pubkey)}
              />
            ))}
          </div>
        )}

        {contacts.length > 0 && (
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleShare} disabled={isPending || selected.size === 0}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                `Share${selected.size ? ` (${selected.size})` : ''}`
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ContactRow({
  contact,
  checked,
  onToggle,
}: {
  contact: Contact;
  checked: boolean;
  onToggle: () => void;
}) {
  const author = useAuthor(contact.pubkey);
  const meta = author.data?.metadata;
  const name = contact.name?.trim() || meta?.name || meta?.display_name || genUserName(contact.pubkey);
  const npub = nip19.npubEncode(contact.pubkey);

  return (
    <label className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <Avatar size="sm">
        <AvatarImage src={meta?.picture} alt={name} />
        <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate font-mono">{npub.slice(0, 16)}…</p>
      </div>
    </label>
  );
}
