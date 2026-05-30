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
 * Share all of the current user's existing entries with a newly-added partner,
 * so their combined balance is populated immediately rather than only with
 * entries created from that point forward.
 */
export function useBackfillPartner() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { partnerPubkey: string; entries: BudgetEntry[] }) => {
      if (!user) throw new Error('You must be logged in.');
      if (!user.signer.nip44) {
        throw new Error('Your signer does not support NIP-44 encryption.');
      }

      const { partnerPubkey, entries } = input;
      const myNpub = nip19.npubEncode(user.pubkey);

      const results = await Promise.allSettled(
        entries.map(async (entry) => {
          const payload: SharedEntryPayload = {
            title: entry.title,
            amount: entry.amount,
            currency: entry.currency,
            type: entry.type,
            category: entry.category,
            note: entry.note,
            date: entry.date,
            createdAt: entry.createdAt,
            recurrence: entry.recurrence ?? 'none',
            entryId: entry.id,
            sharedBy: myNpub,
          };

          const ciphertext = await user.signer.nip44!.encrypt(
            partnerPubkey,
            JSON.stringify(payload),
          );

          const event = await user.signer.signEvent({
            kind: SHARED_ENTRY_KIND,
            content: ciphertext,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
              ['p', partnerPubkey],
              ['entry', entry.id],
              ['alt', 'A budget entry shared with you on budgetstr'],
            ],
          });

          await nostr.event(event, { signal: AbortSignal.timeout(5000) });
        }),
      );

      const failed = results.filter((r) => r.status === 'rejected').length;
      return { total: entries.length, failed };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-entries', user?.pubkey] });
    },
  });
}
