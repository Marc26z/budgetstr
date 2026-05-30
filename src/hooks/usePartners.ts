import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { PARTNERS_D_TAG, type Partner } from '@/lib/budget';

const APP_DATA_KIND = 30078;

function isPartnerArray(value: unknown): value is Partner[] {
  return (
    Array.isArray(value) &&
    value.every(
      (p) =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as Record<string, unknown>).pubkey === 'string',
    )
  );
}

/**
 * Fetch and decrypt the user's private shared-balance partners list.
 * Partners pool their full income/expenses into a combined balance.
 */
export function usePartners() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery<Partner[]>({
    queryKey: ['budget-partners', user?.pubkey],
    enabled: !!user,
    queryFn: async (c) => {
      if (!user) return [];
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const [event] = await nostr.query(
        [
          {
            kinds: [APP_DATA_KIND],
            authors: [user.pubkey],
            '#d': [PARTNERS_D_TAG],
            limit: 1,
          },
        ],
        { signal },
      );

      if (!event || !event.content) return [];

      try {
        const plaintext = await user.signer.nip44!.decrypt(user.pubkey, event.content);
        const parsed: unknown = JSON.parse(plaintext);
        return isPartnerArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    staleTime: 30_000,
  });
}

/** Persist the full partners list (encrypted to self). */
export function useSavePartners() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (partners: Partner[]) => {
      if (!user) throw new Error('You must be logged in.');
      if (!user.signer.nip44) {
        throw new Error('Your signer does not support NIP-44 encryption.');
      }

      const ciphertext = await user.signer.nip44.encrypt(
        user.pubkey,
        JSON.stringify(partners),
      );

      const event = await user.signer.signEvent({
        kind: APP_DATA_KIND,
        content: ciphertext,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', PARTNERS_D_TAG],
          ['alt', 'budgetstr shared-balance partners'],
        ],
      });

      await nostr.event(event, { signal: AbortSignal.timeout(5000) });
      return partners;
    },
    onSuccess: (partners) => {
      queryClient.setQueryData(['budget-partners', user?.pubkey], partners);
      queryClient.invalidateQueries({ queryKey: ['budget-partners', user?.pubkey] });
    },
  });
}
