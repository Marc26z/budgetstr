import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  CATEGORIES_D_TAG,
  DEFAULT_CATEGORIES,
  type CategoryBudget,
} from '@/lib/budget';

const APP_DATA_KIND = 30078;

function isCategoryArray(value: unknown): value is CategoryBudget[] {
  return (
    Array.isArray(value) &&
    value.every(
      (c) =>
        typeof c === 'object' &&
        c !== null &&
        typeof (c as Record<string, unknown>).name === 'string',
    )
  );
}

/** Build the initial category list from defaults (no budgets set). */
function defaultCategoryList(): CategoryBudget[] {
  return DEFAULT_CATEGORIES.map((name) => ({
    name,
    budget: 0,
    currency: 'USD',
  }));
}

/** Fetch and decrypt the user's category budgets. Falls back to defaults. */
export function useCategories() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery<CategoryBudget[]>({
    queryKey: ['categories', user?.pubkey],
    enabled: !!user,
    queryFn: async (c) => {
      if (!user) return defaultCategoryList();
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const [event] = await nostr.query(
        [
          {
            kinds: [APP_DATA_KIND],
            authors: [user.pubkey],
            '#d': [CATEGORIES_D_TAG],
            limit: 1,
          },
        ],
        { signal },
      );

      if (!event || !event.content) return defaultCategoryList();

      try {
        const plaintext = await user.signer.nip44!.decrypt(user.pubkey, event.content);
        const parsed: unknown = JSON.parse(plaintext);
        return isCategoryArray(parsed) ? parsed : defaultCategoryList();
      } catch {
        return defaultCategoryList();
      }
    },
    staleTime: 30_000,
  });
}

/** Persist the full categories list (encrypted to self). */
export function useSaveCategories() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categories: CategoryBudget[]) => {
      if (!user) throw new Error('You must be logged in.');
      if (!user.signer.nip44) {
        throw new Error('Your signer does not support NIP-44 encryption.');
      }

      const ciphertext = await user.signer.nip44.encrypt(
        user.pubkey,
        JSON.stringify(categories),
      );

      const event = await user.signer.signEvent({
        kind: APP_DATA_KIND,
        content: ciphertext,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', CATEGORIES_D_TAG],
          ['alt', 'budgetstr category budgets'],
        ],
      });

      await nostr.event(event, { signal: AbortSignal.timeout(5000) });
      return categories;
    },
    onSuccess: (categories) => {
      queryClient.setQueryData(['categories', user?.pubkey], categories);
      queryClient.invalidateQueries({ queryKey: ['categories', user?.pubkey] });
    },
  });
}
