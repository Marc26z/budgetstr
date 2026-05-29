import { useSeoMeta } from '@unhead/react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { BudgetLogin } from '@/components/budget/BudgetLogin';
import { BudgetDashboard } from '@/components/budget/BudgetDashboard';

const Index = () => {
  const { user } = useCurrentUser();

  useSeoMeta({
    title: 'budgetstr — Private, Encrypted Budgeting on Nostr',
    description:
      'Track your budget privately with end-to-end (NIP-44) encryption, log in with a key from your password manager, and securely share entries with people you trust.',
  });

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-muted/40 to-background px-4 py-12">
        <BudgetLogin />
      </div>
    );
  }

  return <BudgetDashboard />;
};

export default Index;
