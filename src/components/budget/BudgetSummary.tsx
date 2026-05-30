import {
  CalendarClock,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Wallet,
} from 'lucide-react';

import { formatAmount } from '@/lib/budget';
import { useCombinedBudget, type CombinedTotals } from '@/hooks/useCombinedBudget';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';

interface BudgetSummaryProps {
  /** Whether to show the pooled (partner) totals or just the user's own. */
  shared: boolean;
  onSharedChange: (shared: boolean) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Summary cards showing monthly Balance, Income, Expenses, and a yearly-
 * expenses savings field. When the user has shared-balance partners, a toggle
 * lets them switch between their own totals and the pooled totals.
 */
export function BudgetSummary({ shared, onSharedChange }: BudgetSummaryProps) {
  const { user } = useCurrentUser();
  const { totals, ownTotals, hasPartners, partnerCount } = useCombinedBudget(user?.pubkey);

  const active: CombinedTotals = shared && hasPartners ? totals : ownTotals;

  const now = new Date();
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="space-y-3">
      {/* Header row: month name + optional partner toggle */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">{monthLabel}</p>
        </div>
        {hasPartners && (
          <div className="inline-flex rounded-full border bg-card p-0.5">
            <button
              onClick={() => onSharedChange(false)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                !shared ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <User className="size-3.5" /> Just me
            </button>
            <button
              onClick={() => onSharedChange(true)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                shared ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Users className="size-3.5" /> Shared
            </button>
          </div>
        )}
        {hasPartners && (
          <p className="w-full text-xs text-muted-foreground -mt-1">
            {shared
              ? `Combined with ${partnerCount} ${partnerCount === 1 ? 'partner' : 'partners'}`
              : 'Your entries only'}
          </p>
        )}
      </div>

      {/* Main cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Balance — neon green hero card */}
        <div className="rounded-2xl bg-gradient-to-br from-[#39ff14] to-[#14ff8c] text-black p-5 shadow-lg shadow-primary/30 sm:col-span-1">
          <div className="flex items-center gap-2 text-black/70 text-sm font-medium">
            {shared && hasPartners ? <Users className="size-4" /> : <Wallet className="size-4" />}
            {shared && hasPartners ? 'Shared balance' : 'Balance'}
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-2 tabular-nums break-words">
            {formatAmount(active.balance, active.currency)}
          </p>
          <p className="text-xs text-black/55 mt-1">This month</p>
        </div>

        {/* Income */}
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <TrendingUp className="size-4 text-primary" /> Income
          </div>
          <p className="text-xl sm:text-2xl font-semibold mt-2 tabular-nums text-primary break-words">
            {formatAmount(active.income, active.currency)}
          </p>
        </div>

        {/* Expenses */}
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <TrendingDown className="size-4 text-rose-500" /> Expenses
          </div>
          <p className="text-xl sm:text-2xl font-semibold mt-2 tabular-nums text-rose-500 break-words">
            {formatAmount(active.expense, active.currency)}
          </p>
        </div>
      </div>

      {/* Yearly expenses savings — only shown when there are yearly items */}
      {active.yearlySavings > 0 && (
        <div className="rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
              <PiggyBank className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-400">Yearly expenses savings</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Set aside each month for annual bills. These are only deducted from
                your balance in the month they're due.
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Monthly set-aside</p>
                  <p className="text-lg font-semibold tabular-nums text-amber-400">
                    {formatAmount(active.yearlyMonthlySetAside, active.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Annual total</p>
                  <p className="text-lg font-semibold tabular-nums text-amber-400">
                    {formatAmount(active.yearlySavings, active.currency)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
