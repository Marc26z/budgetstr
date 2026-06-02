import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { CASH_D_TAG, type CashHolding } from '@/lib/budget';

const APP_DATA_KIND = 30078;

function isHoldingArray(value: unknown): value is CashHolding[] {
  return (
    Array.isArray(value) &&
    value.every(
      (h) =>
        typeof h === 'object' &&
        h !== null &&
        typeof (h as Record<string, unknown>).id === 'string' &&
        typeof (h as Record<string, unknown>).label === 'string' &&
        typeof (h as Record<string, unknown>).amount === 'number' &&
        typeof (h as Record<string, unknown>).currency === 'string',
    )
  );
}

/**
 * Fetch and decrypt the user's cash holdings list. These are physical or
 * digital cash balances tracked separately from income/expense entries.
 */
export function useCashHoldings() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery<CashHolding[]>({
    queryKey: ['cash-holdings', user?.pubkey],
    enabled: !!user,
    queryFn: async (c) => {
      if (!user) return [];
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const [event] = await nostr.query(
        [
          {
            kinds: [APP_DATA_KIND],
            authors: [user.pubkey],
            '#d': [CASH_D_TAG],
            limit: 1,
          },
        ],
        { signal },
      );

      if (!event || !event.content) return [];

      try {
        const plaintext = await user.signer.nip44!.decrypt(user.pubkey, event.content);
        const parsed: unknown = JSON.parse(plaintext);
        if (!isHoldingArray(parsed)) return [];
        // Normalize legacy entries that may not have `paper`.
        return parsed.map((h) => ({ ...h, paper: !!h.paper }));
      } catch {
        return [];
      }
    },
    staleTime: 30_000,
  });
}

/** Persist the full cash holdings list (encrypted to self). */
export function useSaveCashHoldings() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (holdings: CashHolding[]) => {
      if (!user) throw new Error('You must be logged in.');
      if (!user.signer.nip44) {
        throw new Error('Your signer does not support NIP-44 encryption.');
      }

      const ciphertext = await user.signer.nip44.encrypt(
        user.pubkey,
        JSON.stringify(holdings),
      );

      const event = await user.signer.signEvent({
        kind: APP_DATA_KIND,
        content: ciphertext,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', CASH_D_TAG],
          ['alt', 'budgetstr cash holdings'],
        ],
      });

      await nostr.event(event, { signal: AbortSignal.timeout(5000) });
      return holdings;
    },
    onSuccess: (holdings) => {
      queryClient.setQueryData(['cash-holdings', user?.pubkey], holdings);
      queryClient.invalidateQueries({ queryKey: ['cash-holdings', user?.pubkey] });
    },
  });
}
