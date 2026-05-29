import { useState } from 'react';
import { Loader2, Trash2, UserPlus } from 'lucide-react';
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
import { useContacts, useSaveContacts } from '@/hooks/useContacts';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { useToast } from '@/hooks/useToast';
import type { Contact } from '@/lib/budget';

interface ContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Resolve an npub or hex pubkey input to a hex pubkey. */
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

export function ContactsDialog({ open, onOpenChange }: ContactsDialogProps) {
  const { data: contacts = [], isLoading } = useContacts();
  const { mutateAsync: saveContacts, isPending } = useSaveContacts();
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
    if (contacts.some((c) => c.pubkey === pubkey)) {
      toast({ title: 'Already added', variant: 'destructive' });
      return;
    }
    const next: Contact[] = [...contacts, { pubkey, name: label.trim() || undefined }];
    try {
      await saveContacts(next);
      setInput('');
      setLabel('');
      toast({ title: 'Person added' });
    } catch (err) {
      toast({
        title: 'Could not add',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const handleRemove = async (pubkey: string) => {
    const next = contacts.filter((c) => c.pubkey !== pubkey);
    try {
      await saveContacts(next);
      toast({ title: 'Removed' });
    } catch (err) {
      toast({
        title: 'Could not remove',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>People</DialogTitle>
          <DialogDescription>
            Add people by their npub to share budget entries with them.
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
            placeholder="Label (optional, e.g. Partner)"
            className="text-base md:text-sm"
          />
          <Button type="submit" className="w-full" disabled={isPending || !input.trim()}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="size-4 mr-2" /> Add person
              </>
            )}
          </Button>
        </form>

        <div className="border-t pt-4">
          {isLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No people added yet.
            </p>
          ) : (
            <div className="space-y-1 max-h-[40vh] overflow-y-auto">
              {contacts.map((contact) => (
                <ContactRow
                  key={contact.pubkey}
                  contact={contact}
                  onRemove={() => handleRemove(contact.pubkey)}
                  disabled={isPending}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ContactRow({
  contact,
  onRemove,
  disabled,
}: {
  contact: Contact;
  onRemove: () => void;
  disabled: boolean;
}) {
  const author = useAuthor(contact.pubkey);
  const meta = author.data?.metadata;
  const name = contact.name?.trim() || meta?.name || meta?.display_name || genUserName(contact.pubkey);
  const npub = nip19.npubEncode(contact.pubkey);

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
