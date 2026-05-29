import { KeyRound, Users } from 'lucide-react';

import { LoginArea } from '@/components/auth/LoginArea';
import { Button } from '@/components/ui/button';

interface BudgetHeaderProps {
  onManageContacts: () => void;
}

export function BudgetHeader({ onManageContacts }: BudgetHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-3xl px-4 h-16 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
            <KeyRound className="size-5" />
          </div>
          <span className="font-bold text-lg tracking-tight">NoteBudget</span>
        </div>

        <div className="flex items-center gap-1.5">
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
