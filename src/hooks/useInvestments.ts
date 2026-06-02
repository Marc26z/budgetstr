import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { INVESTMENTS_D_TAG, type Investment } from '@/lib/budget';

const APP_DATA_KIND = 30078;

function isInvestmentArray(value: unknown): value is Investment[] {
  return (
    Array.isArray(value) &&
    value.every(
      (i) =>
        typeof i === 'object' &&
        i !== null &&
        typeof (i as Record<string, unknown>).id === 'string' &&
        typeof (i as Record<string, unknown>).label === 'string' &&
        typeof (i as Record<string, unknown>).currentValue === 'number' &&
        typeof (i as Record<string, unknown>).currency === 'string',
    )
  );
}

/** Fetch and decrypt the user's investments list. */
export function useInvestments() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery<Investment[]>({
    queryKey: ['investments', user?.pubkey],
    enabled: !!user,
    queryFn: async (c) => {
      if (!user) return [];
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const [event] = await nostr.query(
        [
          {
            kinds: [APP_DATA_KIND],
            authors: [user.pubkey],
            '#d': [INVESTMENTS_D_TAG],
            limit: 1,
          },
        ],
        { signal },
      );

      if (!event || !event.content) return [];

      try {
        const plaintext = await user.signer.nip44!.decrypt(user.pubkey, event.content);
        const parsed: unknown = JSON.parse(plaintext);
        if (!isInvestmentArray(parsed)) return [];
        // Default to 'other' type when missing.
        return parsed.map((i) => ({ ...i, type: i.type ?? 'other' }));
      } catch {
        return [];
      }
    },
    staleTime: 30_000,
  });
}

/** Persist the full investments list (encrypted to self). */
export function useSaveInvestments() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (investments: Investment[]) => {
      if (!user) throw new Error('You must be logged in.');
      if (!user.signer.nip44) {
        throw new Error('Your signer does not support NIP-44 encryption.');
      }

      const ciphertext = await user.signer.nip44.encrypt(
        user.pubkey,
        JSON.stringify(investments),
      );

      const event = await user.signer.signEvent({
        kind: APP_DATA_KIND,
        content: ciphertext,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', INVESTMENTS_D_TAG],
          ['alt', 'budgetstr investments'],
        ],
      });

      await nostr.event(event, { signal: AbortSignal.timeout(5000) });
      return investments;
    },
    onSuccess: (investments) => {
      queryClient.setQueryData(['investments', user?.pubkey], investments);
      queryClient.invalidateQueries({ queryKey: ['investments', user?.pubkey] });
    },
  });
}
