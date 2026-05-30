import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { PIGGYBANK_D_TAG, type PiggyBankAccount } from '@/lib/budget';

const APP_DATA_KIND = 30078;

function isAccountArray(value: unknown): value is PiggyBankAccount[] {
  return (
    Array.isArray(value) &&
    value.every(
      (a) =>
        typeof a === 'object' &&
        a !== null &&
        typeof (a as Record<string, unknown>).id === 'string' &&
        typeof (a as Record<string, unknown>).address === 'string',
    )
  );
}

/** Fetch and decrypt the user's piggy bank accounts. */
export function usePiggyBank() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery<PiggyBankAccount[]>({
    queryKey: ['piggybank', user?.pubkey],
    enabled: !!user,
    queryFn: async (c) => {
      if (!user) return [];
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const [event] = await nostr.query(
        [
          {
            kinds: [APP_DATA_KIND],
            authors: [user.pubkey],
            '#d': [PIGGYBANK_D_TAG],
            limit: 1,
          },
        ],
        { signal },
      );

      if (!event || !event.content) return [];

      try {
        const plaintext = await user.signer.nip44!.decrypt(user.pubkey, event.content);
        const parsed: unknown = JSON.parse(plaintext);
        return isAccountArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    staleTime: 30_000,
  });
}

/** Persist the full piggy bank accounts list (encrypted to self). */
export function useSavePiggyBank() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accounts: PiggyBankAccount[]) => {
      if (!user) throw new Error('You must be logged in.');
      if (!user.signer.nip44) {
        throw new Error('Your signer does not support NIP-44 encryption.');
      }

      const ciphertext = await user.signer.nip44.encrypt(
        user.pubkey,
        JSON.stringify(accounts),
      );

      const event = await user.signer.signEvent({
        kind: APP_DATA_KIND,
        content: ciphertext,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', PIGGYBANK_D_TAG],
          ['alt', 'budgetstr piggy bank accounts'],
        ],
      });

      await nostr.event(event, { signal: AbortSignal.timeout(5000) });
      return accounts;
    },
    onSuccess: (accounts) => {
      queryClient.setQueryData(['piggybank', user?.pubkey], accounts);
      queryClient.invalidateQueries({ queryKey: ['piggybank', user?.pubkey] });
    },
  });
}
