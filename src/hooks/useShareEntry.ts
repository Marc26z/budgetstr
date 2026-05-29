import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { nip19 } from 'nostr-tools';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  SHARED_ENTRY_KIND,
  type BudgetEntry,
  type SharedEntryPayload,
} from '@/lib/budget';

/**
 * Share a budget entry with another user. The entry payload is re-encrypted
 * with NIP-44 to the recipient's pubkey and published as a kind 1431 event
 * tagged with the recipient so they can find and decrypt it.
 */
export function useShareEntry() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { entry: BudgetEntry; recipients: string[] }) => {
      if (!user) throw new Error('You must be logged in.');
      if (!user.signer.nip44) {
        throw new Error('Your signer does not support NIP-44 encryption.');
      }

      const { entry, recipients } = input;
      const myNpub = nip19.npubEncode(user.pubkey);

      const payload: SharedEntryPayload = {
        title: entry.title,
        amount: entry.amount,
        currency: entry.currency,
        type: entry.type,
        category: entry.category,
        note: entry.note,
        date: entry.date,
        createdAt: entry.createdAt,
        entryId: entry.id,
        sharedBy: myNpub,
      };

      const published = [];
      for (const recipient of recipients) {
        const ciphertext = await user.signer.nip44.encrypt(
          recipient,
          JSON.stringify(payload),
        );

        const event = await user.signer.signEvent({
          kind: SHARED_ENTRY_KIND,
          content: ciphertext,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ['p', recipient],
            ['entry', entry.id],
            ['alt', 'A budget entry shared with you on NoteBudget'],
          ],
        });

        await nostr.event(event, { signal: AbortSignal.timeout(5000) });
        published.push(event);
      }

      return published;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-entries', user?.pubkey] });
    },
  });
}
