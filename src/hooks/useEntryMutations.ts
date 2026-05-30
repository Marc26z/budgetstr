import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { nip19 } from 'nostr-tools';
import type { NPool, NostrSigner } from '@nostrify/nostrify';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePartners } from '@/hooks/usePartners';
import {
  BUDGET_ENTRY_KIND,
  SHARED_ENTRY_KIND,
  newEntryId,
  type BudgetEntry,
  type BudgetEntryPayload,
  type Partner,
  type SharedEntryPayload,
} from '@/lib/budget';

/**
 * Publish a kind 1431 shared copy of an entry to each partner, so that
 * partners pool this entry into their combined balance. Best-effort: failures
 * for individual partners are swallowed so one bad relay/recipient doesn't
 * block saving the entry locally.
 */
async function shareWithPartners(
  nostr: NPool,
  signer: NostrSigner,
  selfPubkey: string,
  id: string,
  payload: BudgetEntryPayload,
  partners: Partner[],
) {
  if (!partners.length || !signer.nip44) return;

  const myNpub = nip19.npubEncode(selfPubkey);
  const sharedPayload: SharedEntryPayload = {
    ...payload,
    recurrence: payload.recurrence ?? 'none',
    entryId: id,
    sharedBy: myNpub,
  };

  await Promise.allSettled(
    partners.map(async (partner) => {
      const ciphertext = await signer.nip44!.encrypt(
        partner.pubkey,
        JSON.stringify(sharedPayload),
      );
      const event = await signer.signEvent({
        kind: SHARED_ENTRY_KIND,
        content: ciphertext,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['p', partner.pubkey],
          ['entry', id],
          ['alt', 'A budget entry shared with you on budgetstr'],
        ],
      });
      await nostr.event(event, { signal: AbortSignal.timeout(5000) });
    }),
  );
}

/**
 * Save (create or update) a budget entry. The payload is NIP-44 encrypted to
 * the user's own pubkey and published as an addressable kind 34529 event keyed
 * by the entry's `d` tag. If the user has shared-balance partners, an encrypted
 * copy is automatically shared with each of them.
 */
export function useSaveEntry() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { data: partners = [] } = usePartners();
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

      // Keep partners' combined balance in sync automatically.
      await shareWithPartners(nostr, user.signer, user.pubkey, id, input.payload, partners);

      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-entries', user?.pubkey] });
    },
  });
}

/**
 * Delete a budget entry via NIP-09 deletion of its addressable coordinate.
 * Also issues deletions for any shared copies sent to partners so it
 * disappears from their combined balance too.
 */
export function useDeleteEntry() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: BudgetEntry) => {
      if (!user) throw new Error('You must be logged in.');

      const coordinate = `${BUDGET_ENTRY_KIND}:${user.pubkey}:${entry.id}`;

      // Find any shared copies of this entry that we authored, so we can
      // delete them from partners' views as well.
      let sharedEventIds: string[] = [];
      try {
        const shared = await nostr.query(
          [{ kinds: [SHARED_ENTRY_KIND], authors: [user.pubkey], '#entry': [entry.id], limit: 100 }],
          { signal: AbortSignal.timeout(3000) },
        );
        sharedEventIds = shared.map((e) => e.id);
      } catch {
        // Best effort — proceed with at least the local deletion.
      }

      const event = await user.signer.signEvent({
        kind: 5,
        content: 'Deleted budget entry',
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['a', coordinate],
          ['e', entry.event.id],
          ...sharedEventIds.map((id): [string, string] => ['e', id]),
          ['k', String(BUDGET_ENTRY_KIND)],
          ['k', String(SHARED_ENTRY_KIND)],
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
