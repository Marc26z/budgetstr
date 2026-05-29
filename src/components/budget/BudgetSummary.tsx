import { useMemo } from 'react';
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';

import { formatAmount, type BudgetEntry } from '@/lib/budget';

/**
 * Summary cards. Totals are computed per-currency since entries may mix
 * currencies; we display the dominant currency and fall back gracefully.
 */
export function BudgetSummary({ entries }: { entries: BudgetEntry[] }) {
  const { income, expense, balance, currency } = useMemo(() => {
    // Pick the most-used currency for the headline figure.
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.currency, (counts.get(e.currency) ?? 0) + 1);
    let topCurrency = 'USD';
    let top = -1;
    for (const [cur, n] of counts) {
      if (n > top) {
        top = n;
        topCurrency = cur;
      }
    }

    let income = 0;
    let expense = 0;
    for (const e of entries) {
      if (e.currency !== topCurrency) continue;
      if (e.type === 'income') income += e.amount;
      else expense += e.amount;
    }

    return { income, expense, balance: income - expense, currency: topCurrency };
  }, [entries]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      <div className="rounded-2xl bg-gradient-to-br from-[#39ff14] to-[#14ff8c] text-black p-5 shadow-lg shadow-primary/30 sm:col-span-1">
        <div className="flex items-center gap-2 text-black/70 text-sm font-medium">
          <Wallet className="size-4" /> Balance
        </div>
        <p className="text-2xl sm:text-3xl font-bold mt-2 tabular-nums break-words">
          {formatAmount(balance, currency)}
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <TrendingUp className="size-4 text-primary" /> Income
        </div>
        <p className="text-xl sm:text-2xl font-semibold mt-2 tabular-nums text-primary break-words">
          {formatAmount(income, currency)}
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <TrendingDown className="size-4 text-rose-500" /> Expenses
        </div>
        <p className="text-xl sm:text-2xl font-semibold mt-2 tabular-nums text-rose-500 break-words">
          {formatAmount(expense, currency)}
        </p>
      </div>
    </div>
  );
}
