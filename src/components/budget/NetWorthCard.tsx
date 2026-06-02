import { useMemo } from 'react';
import { Sparkles, Wallet, TrendingUp, TrendingDown } from 'lucide-react';

import { useCashHoldings } from '@/hooks/useCashHoldings';
import { useInvestments } from '@/hooks/useInvestments';
import { useDebts } from '@/hooks/useDebts';
import { formatAmount } from '@/lib/budget';

/**
 * Combined net-worth headline card. Aggregates the user's cash holdings,
 * investment values, and debts (in their dominant currency) into a single
 * "Net worth" figure: cash + investments - debts.
 *
 * The card is hidden until the user has tracked at least one asset or debt.
 */
export function NetWorthCard() {
  const { data: cash = [] } = useCashHoldings();
  const { data: investments = [] } = useInvestments();
  const { data: debts = [] } = useDebts();

  const summary = useMemo(() => {
    // Pool everything to find the dominant currency across asset types.
    const counts = new Map<string, number>();
    for (const c of cash) counts.set(c.currency, (counts.get(c.currency) ?? 0) + 1);
    for (const i of investments) counts.set(i.currency, (counts.get(i.currency) ?? 0) + 1);
    for (const d of debts) counts.set(d.currency, (counts.get(d.currency) ?? 0) + 1);

    if (counts.size === 0) return null;

    let currency = 'USD';
    let top = -1;
    for (const [c, n] of counts) {
      if (n > top) { top = n; currency = c; }
    }

    let cashTotal = 0;
    for (const c of cash) {
      if (c.currency === currency) cashTotal += c.amount;
    }
    let investTotal = 0;
    for (const i of investments) {
      if (i.currency === currency) investTotal += i.currentValue;
    }
    let debtTotal = 0;
    for (const d of debts) {
      if (d.currency === currency) debtTotal += d.balance;
    }

    return {
      currency,
      cashTotal,
      investTotal,
      debtTotal,
      assets: cashTotal + investTotal,
      netWorth: cashTotal + investTotal - debtTotal,
    };
  }, [cash, investments, debts]);

  if (!summary) return null;

  const positive = summary.netWorth >= 0;

  return (
    <div className={`rounded-2xl p-5 shadow-lg ${
      positive
        ? 'bg-gradient-to-br from-primary to-cyan-600 shadow-primary/30'
        : 'bg-gradient-to-br from-rose-500 to-pink-600 shadow-rose-500/30'
    } text-white`}>
      <div className="flex items-center gap-2 text-white/80 text-sm font-medium">
        <Sparkles className="size-4" /> Net worth
      </div>
      <p className="text-3xl sm:text-4xl font-bold mt-2 tabular-nums break-words">
        {formatAmount(summary.netWorth, summary.currency)}
      </p>
      <p className="text-xs text-white/60 mt-1">
        Assets − liabilities
      </p>

      {/* Breakdown row */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3 pt-4 border-t border-white/15">
        <BreakdownItem
          icon={<Wallet className="size-3.5" />}
          label="Cash"
          value={formatAmount(summary.cashTotal, summary.currency)}
        />
        <BreakdownItem
          icon={<TrendingUp className="size-3.5" />}
          label="Investments"
          value={formatAmount(summary.investTotal, summary.currency)}
        />
        <BreakdownItem
          icon={<TrendingDown className="size-3.5" />}
          label="Debts"
          value={`-${formatAmount(summary.debtTotal, summary.currency)}`}
          negative
        />
      </div>
    </div>
  );
}

function BreakdownItem({
  icon,
  label,
  value,
  negative,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/60">
        {icon}
        {label}
      </div>
      <p className={`text-sm sm:text-base font-semibold tabular-nums mt-0.5 break-words ${negative ? 'text-white/90' : ''}`}>
        {value}
      </p>
    </div>
  );
}
