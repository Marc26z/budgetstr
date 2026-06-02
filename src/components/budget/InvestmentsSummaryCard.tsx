import { useMemo } from 'react';
import { Plus, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useInvestments } from '@/hooks/useInvestments';
import { formatAmount, INVESTMENT_TYPES, type InvestmentType } from '@/lib/budget';

interface InvestmentsSummaryCardProps {
  onManage: () => void;
}

/**
 * Mirrors the Balance / Income / Expenses card layout for investments.
 * Hero card shows total invested in an emerald gradient; an optional row
 * of mini breakdown cards shows the largest investment categories.
 */
export function InvestmentsSummaryCard({ onManage }: InvestmentsSummaryCardProps) {
  const { data: investments = [] } = useInvestments();

  const summary = useMemo(() => {
    if (investments.length === 0) return null;

    // Pick the most-common currency for the headline figure.
    const counts = new Map<string, number>();
    for (const i of investments) counts.set(i.currency, (counts.get(i.currency) ?? 0) + 1);
    let currency = 'USD';
    let top = -1;
    for (const [c, n] of counts) {
      if (n > top) { top = n; currency = c; }
    }

    let total = 0;
    let totalBasis = 0;
    let hasAnyBasis = false;
    const byType = new Map<InvestmentType, number>();
    for (const inv of investments) {
      if (inv.currency !== currency) continue;
      total += inv.currentValue;
      if (typeof inv.costBasis === 'number' && inv.costBasis > 0) {
        totalBasis += inv.costBasis;
        hasAnyBasis = true;
      } else {
        // Fall back to currentValue so we don't penalize items without a basis
        // when computing aggregate P/L.
        totalBasis += inv.currentValue;
      }
      byType.set(inv.type, (byType.get(inv.type) ?? 0) + inv.currentValue);
    }

    const pnl = hasAnyBasis ? total - totalBasis : 0;
    const pnlPct = hasAnyBasis && totalBasis > 0 ? (pnl / totalBasis) * 100 : 0;

    // Top 2 categories by value (for the optional breakdown row).
    const topCategories = [...byType.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);

    return {
      total,
      currency,
      pnl,
      pnlPct,
      hasAnyBasis,
      count: investments.filter((i) => i.currency === currency).length,
      topCategories,
    };
  }, [investments]);

  if (!summary || summary.total === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5 p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <TrendingUp className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-emerald-400">Investments</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track brokerage, crypto, retirement, and real estate balances. Add a cost basis to see gains.
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={onManage}>
              <Plus className="size-3.5 mr-1.5" /> Add investment
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const showBreakdown = summary.topCategories.length > 1;
  const positive = summary.pnl >= 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">Investments</p>
        </div>
        <button
          onClick={onManage}
          className="text-xs text-primary hover:underline underline-offset-2"
        >
          Manage
        </button>
      </div>

      <div className={`grid grid-cols-1 gap-3 sm:gap-4 ${showBreakdown ? 'sm:grid-cols-3' : 'sm:grid-cols-1'}`}>
        {/* Hero — total invested, emerald gradient */}
        <div className={`rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white p-5 shadow-lg shadow-emerald-500/20 ${showBreakdown ? 'sm:col-span-1' : ''}`}>
          <div className="flex items-center gap-2 text-white/80 text-sm font-medium">
            <TrendingUp className="size-4" /> Total invested
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-2 tabular-nums break-words">
            {formatAmount(summary.total, summary.currency)}
          </p>
          {summary.hasAnyBasis ? (
            <p className={`text-xs mt-1 tabular-nums flex items-center gap-1 ${positive ? 'text-white/90' : 'text-rose-200'}`}>
              {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {positive ? '+' : ''}
              {formatAmount(summary.pnl, summary.currency)}
              {' · '}
              {positive ? '+' : ''}
              {summary.pnlPct.toFixed(1)}%
            </p>
          ) : (
            <p className="text-xs text-white/55 mt-1">
              {summary.count} {summary.count === 1 ? 'account' : 'accounts'}
            </p>
          )}
        </div>

        {showBreakdown && summary.topCategories.map(([typeId, value]) => {
          const label = INVESTMENT_TYPES.find((t) => t.id === typeId)?.label ?? typeId;
          return (
            <div key={typeId} className="rounded-2xl border bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <TrendingUp className="size-4 text-emerald-400" /> {label}
              </div>
              <p className="text-xl sm:text-2xl font-semibold mt-2 tabular-nums text-emerald-400 break-words">
                {formatAmount(value, summary.currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {((value / summary.total) * 100).toFixed(0)}% of portfolio
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
