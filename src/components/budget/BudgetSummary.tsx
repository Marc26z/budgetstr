import { Users, TrendingDown, TrendingUp, User, Wallet } from 'lucide-react';

import { formatAmount } from '@/lib/budget';
import { useCombinedBudget, type CombinedTotals } from '@/hooks/useCombinedBudget';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';

interface BudgetSummaryProps {
  /** Whether to show the pooled (partner) totals or just the user's own. */
  shared: boolean;
  onSharedChange: (shared: boolean) => void;
}

/**
 * Summary cards showing Balance, Income and Expenses. When the user has
 * shared-balance partners, a toggle lets them switch between their own totals
 * and the pooled totals that combine both partners' income and expenses.
 */
export function BudgetSummary({ shared, onSharedChange }: BudgetSummaryProps) {
  const { user } = useCurrentUser();
  const { totals, ownTotals, hasPartners, partnerCount } = useCombinedBudget(user?.pubkey);

  const active: CombinedTotals = shared && hasPartners ? totals : ownTotals;

  return (
    <div className="space-y-3">
      {hasPartners && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {shared
              ? `Combined with ${partnerCount} ${partnerCount === 1 ? 'partner' : 'partners'}`
              : 'Your balance only'}
          </p>
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
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-[#39ff14] to-[#14ff8c] text-black p-5 shadow-lg shadow-primary/30 sm:col-span-1">
          <div className="flex items-center gap-2 text-black/70 text-sm font-medium">
            {shared && hasPartners ? <Users className="size-4" /> : <Wallet className="size-4" />}
            {shared && hasPartners ? 'Shared balance' : 'Balance'}
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-2 tabular-nums break-words">
            {formatAmount(active.balance, active.currency)}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <TrendingUp className="size-4 text-primary" /> Income
          </div>
          <p className="text-xl sm:text-2xl font-semibold mt-2 tabular-nums text-primary break-words">
            {formatAmount(active.income, active.currency)}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <TrendingDown className="size-4 text-rose-500" /> Expenses
          </div>
          <p className="text-xl sm:text-2xl font-semibold mt-2 tabular-nums text-rose-500 break-words">
            {formatAmount(active.expense, active.currency)}
          </p>
        </div>
      </div>
    </div>
  );
}
