import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  BUDGET_ENTRY_KIND,
  isBudgetEntryPayload,
  type BudgetEntry,
} from '@/lib/budget';

/**
 * Fetch and decrypt the current user's own budget entries (kind 34529).
 * Each entry's content is NIP-44 encrypted to the user themselves.
 */
export function useBudgetEntries() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery<BudgetEntry[]>({
    queryKey: ['budget-entries', user?.pubkey],
    enabled: !!user,
    queryFn: async (c) => {
      if (!user) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query(
        [{ kinds: [BUDGET_ENTRY_KIND], authors: [user.pubkey], limit: 500 }],
        { signal },
      );

      const entries: BudgetEntry[] = [];

      for (const event of events) {
        const d = event.tags.find(([n]) => n === 'd')?.[1];
        if (!d) continue;

        try {
          const plaintext = await user.signer.nip44!.decrypt(
            user.pubkey,
            event.content,
          );
          const payload: unknown = JSON.parse(plaintext);
          if (!isBudgetEntryPayload(payload)) continue;

          entries.push({ ...payload, id: d, event });
        } catch {
          // Skip entries we cannot decrypt or parse.
          continue;
        }
      }

      // Newest first by entry date, then createdAt.
      entries.sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return b.createdAt - a.createdAt;
      });

      return entries;
    },
    staleTime: 30_000,
  });
}
