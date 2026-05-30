import { Heart, KeyRound, Users } from 'lucide-react';

import { LoginArea } from '@/components/auth/LoginArea';
import { Button } from '@/components/ui/button';

interface BudgetHeaderProps {
  onManageContacts: () => void;
  onManagePartners: () => void;
}

export function BudgetHeader({ onManageContacts, onManagePartners }: BudgetHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-3xl px-4 h-16 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#39ff14] to-[#14ff8c] text-black shadow-sm shadow-primary/30">
            <KeyRound className="size-5" />
          </div>
          <span className="font-bold text-lg tracking-tight text-primary drop-shadow-[0_0_8px_rgba(57,255,20,0.4)]">budgetstr</span>
        </div>

        <div className="flex items-center gap-1.5">
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
