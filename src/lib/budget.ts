import type { NostrEvent } from '@nostrify/nostrify';

/** Addressable kind for an owner-private budget entry (NIP-44 encrypted to self). */
export const BUDGET_ENTRY_KIND = 34529;
/** Regular kind for a budget entry shared with another user (NIP-44 encrypted to recipient). */
export const SHARED_ENTRY_KIND = 1431;
/** NIP-78 application-data identifier for the private contacts list. */
export const CONTACTS_D_TAG = 'notebudget/contacts';

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
