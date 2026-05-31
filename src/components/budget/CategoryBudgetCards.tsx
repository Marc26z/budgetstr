import { Tag } from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import { useCategories } from '@/hooks/useCategories';
import { useCombinedBudget } from '@/hooks/useCombinedBudget';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { formatAmount } from '@/lib/budget';
import { cn } from '@/lib/utils';

interface CategoryBudgetCardsProps {
  shared: boolean;
  onManageCategories: () => void;
}

/**
 * Per-category budget progress cards. For each category that has a budget set,
 * shows a progress bar of spent vs budgeted for the current month.
 */
export function CategoryBudgetCards({ shared, onManageCategories }: CategoryBudgetCardsProps) {
  const { user } = useCurrentUser();
  const { data: categories = [] } = useCategories();
  const { totals, ownTotals, hasPartners } = useCombinedBudget(user?.pubkey);

  const active = shared && hasPartners ? totals : ownTotals;
  const spending = active.categorySpending;

  // Only show categories that have a budget > 0.
  const budgeted = categories.filter((c) => c.budget > 0 && c.currency === active.currency);

  if (budgeted.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Tag className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">Category budgets</p>
        </div>
        <button
          onClick={onManageCategories}
          className="text-xs text-primary hover:underline underline-offset-2"
        >
          Edit
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {budgeted.map((cat) => {
          const spent = spending.get(cat.name) ?? 0;
          const pct = cat.budget > 0 ? Math.min((spent / cat.budget) * 100, 100) : 0;
          const overBudget = spent > cat.budget;
          const remaining = cat.budget - spent;

          return (
            <div key={cat.name} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{cat.name}</p>
                <span
                  className={cn(
                    'text-xs font-medium tabular-nums',
                    overBudget ? 'text-rose-500' : 'text-muted-foreground',
                  )}
                >
                  {formatAmount(spent, cat.currency)} / {formatAmount(cat.budget, cat.currency)}
                </span>
              </div>

              <Progress
                value={pct}
                className={cn('h-2', overBudget && '[&>div]:bg-rose-500')}
              />

              <p
                className={cn(
                  'text-xs tabular-nums',
                  overBudget ? 'text-rose-500' : 'text-muted-foreground',
                )}
              >
                {overBudget
                  ? `${formatAmount(Math.abs(remaining), cat.currency)} over budget`
                  : `${formatAmount(remaining, cat.currency)} remaining`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
