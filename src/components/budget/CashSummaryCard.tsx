import { useMemo } from 'react';
import { Banknote, CreditCard, Plus, Wallet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCashHoldings } from '@/hooks/useCashHoldings';
import { formatAmount } from '@/lib/budget';

interface CashSummaryCardProps {
  onManage: () => void;
}

/**
 * Mirrors the Balance / Income / Expenses card layout but for the user's
 * cash holdings (physical paper money + digital cash). The hero card shows
 * the total in the dominant currency; two side cards break it down into
 * paper vs digital subtotals when both are present.
 */
export function CashSummaryCard({ onManage }: CashSummaryCardProps) {
  const { data: holdings = [] } = useCashHoldings();

  const summary = useMemo(() => {
    if (holdings.length === 0) {
      return null;
    }

    // Pick the most-common currency for the headline figure.
    const counts = new Map<string, number>();
    for (const h of holdings) counts.set(h.currency, (counts.get(h.currency) ?? 0) + 1);
    let currency = 'USD';
    let top = -1;
    for (const [c, n] of counts) {
      if (n > top) { top = n; currency = c; }
    }

    let paper = 0;
    let digital = 0;
    let paperCount = 0;
    let digitalCount = 0;
    for (const h of holdings) {
      if (h.currency !== currency) continue;
      if (h.paper) {
        paper += h.amount;
        paperCount++;
      } else {
        digital += h.amount;
        digitalCount++;
      }
    }

    return {
      total: paper + digital,
      paper,
      digital,
      paperCount,
      digitalCount,
      currency,
    };
  }, [holdings]);

  // Empty state — visually a dashed card consistent with other "no items yet"
  // states throughout the app.
  if (!summary || summary.total === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-primary/20 bg-card/50 p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Wallet className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Cash on hand</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track physical paper money or digital cash balances alongside your budget.
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={onManage}>
              <Plus className="size-3.5 mr-1.5" /> Add cash
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const showSplit = summary.paperCount > 0 && summary.digitalCount > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">Cash on hand</p>
        </div>
        <button
          onClick={onManage}
          className="text-xs text-primary hover:underline underline-offset-2"
        >
          Manage
        </button>
      </div>

      <div className={`grid grid-cols-1 gap-3 sm:gap-4 ${showSplit ? 'sm:grid-cols-3' : 'sm:grid-cols-1'}`}>
        {/* Hero — total cash on hand. Mirrors the Balance card style but in
            an indigo/blue gradient so it visually pairs with the teal Balance
            card without competing with it. */}
        <div className={`rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white p-5 shadow-lg shadow-indigo-500/20 ${showSplit ? 'sm:col-span-1' : ''}`}>
          <div className="flex items-center gap-2 text-white/80 text-sm font-medium">
            <Wallet className="size-4" /> Total cash
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-2 tabular-nums break-words">
            {formatAmount(summary.total, summary.currency)}
          </p>
          <p className="text-xs text-white/55 mt-1">
            {holdings.length} {holdings.length === 1 ? 'account' : 'accounts'}
          </p>
        </div>

        {showSplit && (
          <>
            <div className="rounded-2xl border bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Banknote className="size-4 text-primary" /> Paper money
              </div>
              <p className="text-xl sm:text-2xl font-semibold mt-2 tabular-nums text-primary break-words">
                {formatAmount(summary.paper, summary.currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.paperCount} {summary.paperCount === 1 ? 'stash' : 'stashes'}
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <CreditCard className="size-4 text-indigo-400" /> Digital
              </div>
              <p className="text-xl sm:text-2xl font-semibold mt-2 tabular-nums text-indigo-400 break-words">
                {formatAmount(summary.digital, summary.currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.digitalCount} {summary.digitalCount === 1 ? 'account' : 'accounts'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
