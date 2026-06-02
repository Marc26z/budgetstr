import { Heart, PiggyBank, Tag, TrendingDown, TrendingUp, Users, Wallet } from 'lucide-react';

import { LoginArea } from '@/components/auth/LoginArea';
import { Button } from '@/components/ui/button';

interface BudgetHeaderProps {
  onManageContacts: () => void;
  onManagePartners: () => void;
  onManagePiggyBank: () => void;
  onManageCategories: () => void;
  onManageCash: () => void;
  onManageInvestments: () => void;
  onManageDebts: () => void;
}

export function BudgetHeader({
  onManageContacts,
  onManagePartners,
  onManagePiggyBank,
  onManageCategories,
  onManageCash,
  onManageInvestments,
  onManageDebts,
}: BudgetHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-3xl px-4 h-16 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.jpg"
            alt="budgetstr"
            className="size-9 rounded-xl object-cover shadow-sm shadow-primary/20"
          />
          <span className="font-bold text-lg tracking-tight text-primary drop-shadow-[0_0_8px_rgba(45,212,191,0.35)]">budgetstr</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onManageCash}
            aria-label="Cash on hand"
            title="Cash on hand"
          >
            <Wallet className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onManageInvestments}
            aria-label="Investments"
            title="Investments"
          >
            <TrendingUp className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onManageDebts}
            aria-label="Debts"
            title="Debts"
          >
            <TrendingDown className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onManageCategories}
            aria-label="Categories"
            title="Categories & budgets"
          >
            <Tag className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onManagePiggyBank}
            aria-label="Piggy bank"
            title="Piggy bank"
          >
            <PiggyBank className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onManagePartners}
            aria-label="Shared balance"
            title="Shared balance"
          >
            <Heart className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onManageContacts}
            aria-label="Manage people"
            title="People"
          >
            <Users className="size-5" />
          </Button>
          <LoginArea className="max-w-44" />
        </div>
      </div>
    </header>
  );
}
