import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  BUDGET_ENTRY_KIND,
  newEntryId,
  type BudgetEntry,
  type BudgetEntryPayload,
} from '@/lib/budget';

/**
 * Save (create or update) a budget entry. The payload is NIP-44 encrypted to
 * the user's own pubkey and published as an addressable kind 34529 event keyed
 * by the entry's `d` tag.
 */
export function useSaveEntry() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id?: string;
      payload: BudgetEntryPayload;
    }) => {
      if (!user) throw new Error('You must be logged in.');
      if (!user.signer.nip44) {
        throw new Error(
          'Your signer does not support NIP-44 encryption. Please use an nsec or upgrade your signer.',
        );
      }

      const id = input.id ?? newEntryId();
      const ciphertext = await user.signer.nip44.encrypt(
        user.pubkey,
        JSON.stringify(input.payload),
      );

      const event = await user.signer.signEvent({
        kind: BUDGET_ENTRY_KIND,
        content: ciphertext,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', id],
          ['alt', 'Encrypted budgetstr entry'],
        ],
      });

      await nostr.event(event, { signal: AbortSignal.timeout(5000) });
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-entries', user?.pubkey] });
    },
  });
}

/** Delete a budget entry via NIP-09 deletion of its addressable coordinate. */
export function useDeleteEntry() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: BudgetEntry) => {
      if (!user) throw new Error('You must be logged in.');

      const coordinate = `${BUDGET_ENTRY_KIND}:${user.pubkey}:${entry.id}`;
      const event = await user.signer.signEvent({
        kind: 5,
        content: 'Deleted budget entry',
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['a', coordinate],
          ['e', entry.event.id],
          ['k', String(BUDGET_ENTRY_KIND)],
        ],
      });

      await nostr.event(event, { signal: AbortSignal.timeout(5000) });
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-entries', user?.pubkey] });
    },
  });
}
