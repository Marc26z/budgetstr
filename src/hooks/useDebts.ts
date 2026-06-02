import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { DEBTS_D_TAG, type Debt } from '@/lib/budget';

const APP_DATA_KIND = 30078;

function isDebtArray(value: unknown): value is Debt[] {
  return (
    Array.isArray(value) &&
    value.every(
      (d) =>
        typeof d === 'object' &&
        d !== null &&
        typeof (d as Record<string, unknown>).id === 'string' &&
        typeof (d as Record<string, unknown>).label === 'string' &&
        typeof (d as Record<string, unknown>).balance === 'number' &&
        typeof (d as Record<string, unknown>).currency === 'string',
    )
  );
}

/** Fetch and decrypt the user's debts list. */
export function useDebts() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery<Debt[]>({
    queryKey: ['debts', user?.pubkey],
    enabled: !!user,
    queryFn: async (c) => {
      if (!user) return [];
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const [event] = await nostr.query(
        [
          {
            kinds: [APP_DATA_KIND],
            authors: [user.pubkey],
            '#d': [DEBTS_D_TAG],
            limit: 1,
          },
        ],
        { signal },
      );

      if (!event || !event.content) return [];

      try {
        const plaintext = await user.signer.nip44!.decrypt(user.pubkey, event.content);
        const parsed: unknown = JSON.parse(plaintext);
        if (!isDebtArray(parsed)) return [];
        return parsed.map((d) => ({ ...d, type: d.type ?? 'other' }));
      } catch {
        return [];
      }
    },
    staleTime: 30_000,
  });
}

/** Persist the full debts list (encrypted to self). */
export function useSaveDebts() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (debts: Debt[]) => {
      if (!user) throw new Error('You must be logged in.');
      if (!user.signer.nip44) {
        throw new Error('Your signer does not support NIP-44 encryption.');
      }

      const ciphertext = await user.signer.nip44.encrypt(
        user.pubkey,
        JSON.stringify(debts),
      );

      const event = await user.signer.signEvent({
        kind: APP_DATA_KIND,
        content: ciphertext,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', DEBTS_D_TAG],
          ['alt', 'budgetstr debts'],
        ],
      });

      await nostr.event(event, { signal: AbortSignal.timeout(5000) });
      return debts;
    },
    onSuccess: (debts) => {
      queryClient.setQueryData(['debts', user?.pubkey], debts);
      queryClient.invalidateQueries({ queryKey: ['debts', user?.pubkey] });
    },
  });
}
