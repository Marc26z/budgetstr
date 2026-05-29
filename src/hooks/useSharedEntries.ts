import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  SHARED_ENTRY_KIND,
  isBudgetEntryPayload,
  type SharedEntry,
  type SharedEntryPayload,
} from '@/lib/budget';

function isSharedPayload(value: unknown): value is SharedEntryPayload {
  if (!isBudgetEntryPayload(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.entryId === 'string';
}

/**
 * Fetch and decrypt budget entries that other users have shared with the
 * current user (kind 1431, tagged with the user's pubkey). Each entry's
 * content is NIP-44 encrypted to the current user by its author.
 */
export function useSharedEntries() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery<SharedEntry[]>({
    queryKey: ['shared-entries', user?.pubkey],
    enabled: !!user,
    queryFn: async (c) => {
      if (!user) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query(
        [{ kinds: [SHARED_ENTRY_KIND], '#p': [user.pubkey], limit: 500 }],
        { signal },
      );

      // De-duplicate: keep the latest share per (sharer, entryId).
      const latest = new Map<string, SharedEntry>();

      for (const event of events) {
        try {
          const plaintext = await user.signer.nip44!.decrypt(
            event.pubkey,
            event.content,
          );
          const payload: unknown = JSON.parse(plaintext);
          if (!isSharedPayload(payload)) continue;

          const entry: SharedEntry = {
            ...payload,
            eventId: event.id,
            sharerPubkey: event.pubkey,
            event,
          };

          const key = `${event.pubkey}:${payload.entryId}`;
          const existing = latest.get(key);
          if (!existing || existing.event.created_at < event.created_at) {
            latest.set(key, entry);
          }
        } catch {
          continue;
        }
      }

      const entries = [...latest.values()];
      entries.sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return b.createdAt - a.createdAt;
      });

      return entries;
    },
    staleTime: 30_000,
  });
}
