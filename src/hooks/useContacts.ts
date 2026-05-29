import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { CONTACTS_D_TAG, type Contact } from '@/lib/budget';

const APP_DATA_KIND = 30078;

function isContactArray(value: unknown): value is Contact[] {
  return (
    Array.isArray(value) &&
    value.every(
      (c) =>
        typeof c === 'object' &&
        c !== null &&
        typeof (c as Record<string, unknown>).pubkey === 'string',
    )
  );
}

/** Fetch and decrypt the user's private contacts list. */
export function useContacts() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery<Contact[]>({
    queryKey: ['budget-contacts', user?.pubkey],
    enabled: !!user,
    queryFn: async (c) => {
      if (!user) return [];
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const [event] = await nostr.query(
        [
          {
            kinds: [APP_DATA_KIND],
            authors: [user.pubkey],
            '#d': [CONTACTS_D_TAG],
            limit: 1,
          },
        ],
        { signal },
      );

      if (!event || !event.content) return [];

      try {
        const plaintext = await user.signer.nip44!.decrypt(user.pubkey, event.content);
        const parsed: unknown = JSON.parse(plaintext);
        return isContactArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    staleTime: 30_000,
  });
}

/** Persist the full contacts list (encrypted to self). */
export function useSaveContacts() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contacts: Contact[]) => {
      if (!user) throw new Error('You must be logged in.');
      if (!user.signer.nip44) {
        throw new Error('Your signer does not support NIP-44 encryption.');
      }

      const ciphertext = await user.signer.nip44.encrypt(
        user.pubkey,
        JSON.stringify(contacts),
      );

      const event = await user.signer.signEvent({
        kind: APP_DATA_KIND,
        content: ciphertext,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', CONTACTS_D_TAG],
          ['alt', 'NoteBudget private contacts'],
        ],
      });

      await nostr.event(event, { signal: AbortSignal.timeout(5000) });
      return contacts;
    },
    onSuccess: (contacts) => {
      queryClient.setQueryData(['budget-contacts', user?.pubkey], contacts);
      queryClient.invalidateQueries({ queryKey: ['budget-contacts', user?.pubkey] });
    },
  });
}
