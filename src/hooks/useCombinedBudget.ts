import { useMemo } from 'react';

import { useBudgetEntries } from '@/hooks/useBudgetEntries';
import { useSharedEntries } from '@/hooks/useSharedEntries';
import { usePartners } from '@/hooks/usePartners';
import {
  monthlyContribution,
  type BudgetEntry,
  type EntryType,
  type Recurrence,
  type SharedEntry,
} from '@/lib/budget';

export interface CombinedTotals {
  /** Income attributable to the current month. */
  income: number;
  /** Expenses attributable to the current month (excludes deferred yearly). */
  expense: number;
  /** income − expense for the current month. */
  balance: number;
  /** Total of all yearly expense amounts (the annual lump sums). */
  yearlySavings: number;
  /** Suggested monthly set-aside to cover yearly expenses (yearlySavings / 12). */
  yearlyMonthlySetAside: number;
  currency: string;
}

/**
 * A unified item for the combined balance. Wraps either an entry the user owns
 * or one shared by a confirmed partner.
 */
export interface CombinedItem {
  key: string;
  type: EntryType;
  amount: number;
  currency: string;
  date: string;
  recurrence: Recurrence;
  /** hex pubkey of whoever the entry belongs to (self or partner). */
  ownerPubkey: string;
  /** True when the item came from a partner rather than the current user. */
  isPartner: boolean;
}

/**
 * Merge the current user's own entries with entries shared by confirmed
 * partners into a single combined dataset, and compute month-based pooled
 * totals.
 *
 * Only entries shared by people on the partners list are pooled — one-off
 * shares from non-partners are ignored so the balance can't be inflated by
 * arbitrary inbound shares.
 */
export function useCombinedBudget(selfPubkey: string | undefined) {
  const { data: ownEntries = [], isLoading: ownLoading } = useBudgetEntries();
  const { data: sharedEntries = [], isLoading: sharedLoading } = useSharedEntries();
  const { data: partners = [], isLoading: partnersLoading } = usePartners();

  const partnerPubkeys = useMemo(
    () => new Set(partners.map((p) => p.pubkey)),
    [partners],
  );

  // Entries shared by confirmed partners only.
  const partnerEntries = useMemo(
    () => sharedEntries.filter((e) => partnerPubkeys.has(e.sharerPubkey)),
    [sharedEntries, partnerPubkeys],
  );

  const items = useMemo<CombinedItem[]>(() => {
    const own: CombinedItem[] = ownEntries.map((e: BudgetEntry) => ({
      key: `self:${e.id}`,
      type: e.type,
      amount: e.amount,
      currency: e.currency,
      date: e.date,
      recurrence: e.recurrence ?? 'none',
      ownerPubkey: selfPubkey ?? '',
      isPartner: false,
    }));

    // De-duplicate partner entries by (sharer, entryId) — already handled in
    // useSharedEntries, but guard again here.
    const seen = new Set<string>();
    const partner: CombinedItem[] = [];
    for (const e of partnerEntries as SharedEntry[]) {
      const dedupeKey = `${e.sharerPubkey}:${e.entryId}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      partner.push({
        key: `partner:${dedupeKey}`,
        type: e.type,
        amount: e.amount,
        currency: e.currency,
        date: e.date,
        recurrence: e.recurrence ?? 'none',
        ownerPubkey: e.sharerPubkey,
        isPartner: true,
      });
    }

    return [...own, ...partner];
  }, [ownEntries, partnerEntries, selfPubkey]);

  const totals = useMemo<CombinedTotals>(() => computeTotals(items), [items]);
  const ownTotals = useMemo<CombinedTotals>(
    () => computeTotals(items.filter((i) => !i.isPartner)),
    [items],
  );

  return {
    totals,
    ownTotals,
    hasPartners: partners.length > 0,
    partnerCount: partners.length,
    partnerEntryCount: partnerEntries.length,
    isLoading: ownLoading || sharedLoading || partnersLoading,
  };
}

/**
 * Compute month-based income/expense/balance using the most common currency.
 *
 * - Income and one-time/daily/weekly/monthly expenses are summed for the
 *   current calendar month.
 * - Yearly expenses are NOT subtracted from the balance unless they fall due
 *   this month; instead their annual lump sums are aggregated into
 *   `yearlySavings` (with a suggested monthly set-aside).
 */
function computeTotals(items: CombinedItem[]): CombinedTotals {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.currency, (counts.get(i.currency) ?? 0) + 1);

  let currency = 'USD';
  let top = -1;
  for (const [cur, n] of counts) {
    if (n > top) {
      top = n;
      currency = cur;
    }
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  let income = 0;
  let expense = 0;
  let yearlySavings = 0;

  for (const i of items) {
    if (i.currency !== currency) continue;

    // Aggregate all yearly expenses into the savings figure regardless of
    // whether they're due this month.
    if (i.type === 'expense' && i.recurrence === 'yearly') {
      yearlySavings += i.amount;
    }

    const contribution = monthlyContribution(i, year, month);
    if (contribution === 0) continue;

    if (i.type === 'income') income += contribution;
    else expense += contribution;
  }

  return {
    income,
    expense,
    balance: income - expense,
    yearlySavings,
    yearlyMonthlySetAside: yearlySavings / 12,
    currency,
  };
}
