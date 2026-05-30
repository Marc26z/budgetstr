import type { NostrEvent } from '@nostrify/nostrify';

/** Addressable kind for an owner-private budget entry (NIP-44 encrypted to self). */
export const BUDGET_ENTRY_KIND = 34529;
/** Regular kind for a budget entry shared with another user (NIP-44 encrypted to recipient). */
export const SHARED_ENTRY_KIND = 1431;
/** NIP-78 application-data identifier for the private contacts list. */
export const CONTACTS_D_TAG = 'notebudget/contacts';
/** NIP-78 application-data identifier for the private shared-balance partners list. */
export const PARTNERS_D_TAG = 'budgetstr/partners';

export type EntryType = 'expense' | 'income';

/** How often an entry repeats. `none` is a one-off entry. */
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

/** Recurrence options for the picker, in display order. */
export const RECURRENCES: { value: Recurrence; label: string; short: string }[] = [
  { value: 'none', label: 'One-time', short: 'Once' },
  { value: 'daily', label: 'Daily', short: 'Daily' },
  { value: 'weekly', label: 'Weekly', short: 'Weekly' },
  { value: 'monthly', label: 'Monthly', short: 'Monthly' },
  { value: 'yearly', label: 'Yearly', short: 'Yearly' },
];

/** Human-readable label for a recurrence value. */
export function recurrenceLabel(recurrence: Recurrence): string {
  return RECURRENCES.find((r) => r.value === recurrence)?.short ?? 'Once';
}

/** The decrypted JSON payload stored inside an entry's content. */
export interface BudgetEntryPayload {
  title: string;
  amount: number;
  currency: string;
  type: EntryType;
  category: string;
  note: string;
  date: string; // ISO date (yyyy-mm-dd)
  createdAt: number; // unix seconds
  /** How often this entry repeats. Defaults to 'none' for legacy entries. */
  recurrence?: Recurrence;
}

/** A decrypted budget entry owned by the current user. */
export interface BudgetEntry extends BudgetEntryPayload {
  id: string; // the `d` tag identifier
  event: NostrEvent;
}

/** Extra fields present in a shared entry payload. */
export interface SharedEntryPayload extends BudgetEntryPayload {
  entryId: string;
  sharedBy: string; // npub of sharer
}

/** A decrypted entry that was shared with the current user. */
export interface SharedEntry extends SharedEntryPayload {
  eventId: string;
  sharerPubkey: string; // hex pubkey of the author of the shared event
  event: NostrEvent;
}

export interface Contact {
  pubkey: string; // hex
  name?: string;
}

/**
 * A shared-balance partner (e.g. a spouse). When you add a partner, every
 * entry you create is automatically shared with them, and their entries are
 * pooled into your combined balance, income, and expense totals.
 */
export interface Partner {
  pubkey: string; // hex
  name?: string;
}

/** Common currencies for the picker. */
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'BTC', 'SATS'] as const;

/** Suggested categories. */
export const CATEGORIES = [
  'Food',
  'Housing',
  'Transport',
  'Utilities',
  'Health',
  'Entertainment',
  'Shopping',
  'Salary',
  'Gift',
  'Other',
] as const;

/** Format a money amount for display. */
export function formatAmount(amount: number, currency: string): string {
  if (currency === 'SATS') {
    return `${Math.round(amount).toLocaleString()} sats`;
  }
  if (currency === 'BTC') {
    return `₿${amount.toLocaleString(undefined, { maximumFractionDigits: 8 })}`;
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

/** Generate a UUID for entry identifiers. */
export function newEntryId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Monthly budget math
// ---------------------------------------------------------------------------

/** The minimal shape needed to compute a monthly contribution. */
export interface RecurringLike {
  amount: number;
  date: string; // ISO start/anchor date (yyyy-mm-dd)
  recurrence?: Recurrence;
}

/** Number of days in the given month (0-indexed month). */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Parse a `yyyy-mm-dd` string into a local Date (midnight). Returns null if invalid. */
export function parseEntryDate(date: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) {
    const d = new Date(date);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * How much a (possibly recurring) entry contributes to the given month.
 *
 * Rules:
 * - `none`: counts only if the entry's date falls within the month.
 * - `daily`: amount × number of days in the month (only once the anchor date
 *   has started, i.e. not for months before the entry began).
 * - `weekly`: amount × number of weekly occurrences that land in the month.
 * - `monthly`: amount once per month (once the anchor month has begun).
 * - `yearly`: amount only in the anniversary month (its "due date"); 0 in all
 *   other months. Yearly items are otherwise handled via the savings field.
 *
 * `year` is the full year, `month` is 0-indexed (0 = January).
 */
export function monthlyContribution(
  entry: RecurringLike,
  year: number,
  month: number,
): number {
  const recurrence = entry.recurrence ?? 'none';
  const start = parseEntryDate(entry.date);
  if (!start) return 0;

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month, daysInMonth(year, month));

  // Nothing recurs before it begins.
  const startsAfterMonth = start > monthEnd;

  switch (recurrence) {
    case 'none':
      return start >= monthStart && start <= monthEnd ? entry.amount : 0;

    case 'daily': {
      if (startsAfterMonth) return 0;
      // Count days in the month on/after the anchor date.
      const from = start > monthStart ? start : monthStart;
      const days = Math.floor((monthEnd.getTime() - from.getTime()) / 86_400_000) + 1;
      return entry.amount * Math.max(0, days);
    }

    case 'weekly': {
      if (startsAfterMonth) return 0;
      // Count weekly anniversaries (every 7 days from the anchor) in the month.
      let occurrences = 0;
      const cursor = new Date(start);
      // Fast-forward to the first occurrence within or after the month start.
      if (cursor < monthStart) {
        const weeks = Math.ceil((monthStart.getTime() - cursor.getTime()) / (7 * 86_400_000));
        cursor.setDate(cursor.getDate() + weeks * 7);
      }
      while (cursor <= monthEnd) {
        occurrences++;
        cursor.setDate(cursor.getDate() + 7);
      }
      return entry.amount * occurrences;
    }

    case 'monthly':
      return startsAfterMonth ? 0 : entry.amount;

    case 'yearly': {
      // Only counts in its anniversary (due) month, and not before it began.
      if (startsAfterMonth) return 0;
      return start.getMonth() === month ? entry.amount : 0;
    }

    default:
      return 0;
  }
}

/** Type guard for a decoded entry payload. */
export function isBudgetEntryPayload(value: unknown): value is BudgetEntryPayload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.title === 'string' &&
    typeof v.amount === 'number' &&
    typeof v.currency === 'string' &&
    (v.type === 'expense' || v.type === 'income') &&
    typeof v.date === 'string'
  );
}
