import { useMemo } from 'react';
import { CalendarClock, Plus, TrendingDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useDebts } from '@/hooks/useDebts';
import { formatAmount, DEBT_TYPES, type DebtType } from '@/lib/budget';

interface DebtsSummaryCardProps {
  onManage: () => void;
}

/**
 * Mirrors the Balance / Income / Expenses card layout for debts.
 * Hero card shows total debt in a rose gradient. Two side cards show
 * the largest debt categories and the total minimum monthly payment
 * across all debts (so users see what they owe per month at a glance).
 */
export function DebtsSummaryCard({ onManage }: DebtsSummaryCardProps) {
  const { data: debts = [] } = useDebts();

  const summary = useMemo(() => {
    if (debts.length === 0) return null;

    // Most-common currency for the headline.
    const counts = new Map<string, number>();
    for (const d of debts) counts.set(d.currency, (counts.get(d.currency) ?? 0) + 1);
    let currency = 'USD';
    let top = -1;
    for (const [c, n] of counts) {
      if (n > top) { top = n; currency = c; }
    }

    let total = 0;
    let monthlyMin = 0;
    const byType = new Map<DebtType, number>();
    for (const d of debts) {
      if (d.currency !== currency) continue;
      total += d.balance;
      if (typeof d.minPayment === 'number') monthlyMin += d.minPayment;
      byType.set(d.type, (byType.get(d.type) ?? 0) + d.balance);
    }

    const topCategory = [...byType.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      total,
      currency,
      monthlyMin,
      count: debts.filter((d) => d.currency === currency).length,
      topCategory,
    };
  }, [debts]);

  if (!summary || summary.total === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-rose-500/30 bg-rose-500/5 p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-400">
            <TrendingDown className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-rose-400">Debts</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track mortgages, credit cards, and other balances you owe.
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={onManage}>
              <Plus className="size-3.5 mr-1.5" /> Add debt
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const showSplit = summary.monthlyMin > 0 || !!summary.topCategory;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingDown className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">Debts</p>
        </div>
        <button
          onClick={onManage}
          className="text-xs text-primary hover:underline underline-offset-2"
        >
          Manage
        </button>
      </div>

      <div className={`grid grid-cols-1 gap-3 sm:gap-4 ${showSplit ? 'sm:grid-cols-3' : 'sm:grid-cols-1'}`}>
        {/* Hero — total debt, rose gradient */}
        <div className={`rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white p-5 shadow-lg shadow-rose-500/20 ${showSplit ? 'sm:col-span-1' : ''}`}>
          <div className="flex items-center gap-2 text-white/80 text-sm font-medium">
            <TrendingDown className="size-4" /> Total debt
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-2 tabular-nums break-words">
            {formatAmount(summary.total, summary.currency)}
          </p>
          <p className="text-xs text-white/55 mt-1">
            {summary.count} {summary.count === 1 ? 'account' : 'accounts'}
          </p>
        </div>

        {showSplit && summary.topCategory && (
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingDown className="size-4 text-rose-400" />{' '}
              {DEBT_TYPES.find((t) => t.id === summary.topCategory![0])?.label ?? 'Largest'}
            </div>
            <p className="text-xl sm:text-2xl font-semibold mt-2 tabular-nums text-rose-400 break-words">
              {formatAmount(summary.topCategory[1], summary.currency)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {((summary.topCategory[1] / summary.total) * 100).toFixed(0)}% of total
            </p>
          </div>
        )}

        {showSplit && summary.monthlyMin > 0 && (
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <CalendarClock className="size-4 text-amber-400" /> Monthly minimum
            </div>
            <p className="text-xl sm:text-2xl font-semibold mt-2 tabular-nums text-amber-400 break-words">
              {formatAmount(summary.monthlyMin, summary.currency)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">across all debts</p>
          </div>
        )}
      </div>
    </div>
  );
}
