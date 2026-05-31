import { useState } from 'react';
import { Inbox, Plus, Wallet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useBudgetEntries } from '@/hooks/useBudgetEntries';
import { useSharedEntries } from '@/hooks/useSharedEntries';
import type { BudgetEntry } from '@/lib/budget';

import { BudgetHeader } from './BudgetHeader';
import { BudgetSummary } from './BudgetSummary';
import { EntryCard } from './EntryCard';
import { SharedEntryCard } from './SharedEntryCard';
import { EntryFormDialog } from './EntryFormDialog';
import { ShareDialog } from './ShareDialog';
import { ContactsDialog } from './ContactsDialog';
import { PartnersDialog } from './PartnersDialog';
import { PiggyBankDialog } from './PiggyBankDialog';
import { PiggyBankCard } from './PiggyBankCard';
import { CategoriesDialog } from './CategoriesDialog';
import { CategoryBudgetCards } from './CategoryBudgetCards';

export function BudgetDashboard() {
  const { data: entries = [], isLoading } = useBudgetEntries();
  const { data: sharedEntries = [], isLoading: sharedLoading } = useSharedEntries();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetEntry | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharingEntry, setSharingEntry] = useState<BudgetEntry | null>(null);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [partnersOpen, setPartnersOpen] = useState(false);
  const [piggyBankOpen, setPiggyBankOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [sharedBalance, setSharedBalance] = useState(true);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (entry: BudgetEntry) => {
    setEditing(entry);
    setFormOpen(true);
  };

  const openShare = (entry: BudgetEntry) => {
    setSharingEntry(entry);
    setShareOpen(true);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <BudgetHeader
        onManageContacts={() => setContactsOpen(true)}
        onManagePartners={() => setPartnersOpen(true)}
        onManagePiggyBank={() => setPiggyBankOpen(true)}
        onManageCategories={() => setCategoriesOpen(true)}
      />

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6 pb-28">
        <BudgetSummary shared={sharedBalance} onSharedChange={setSharedBalance} />
        <CategoryBudgetCards shared={sharedBalance} onManageCategories={() => setCategoriesOpen(true)} />
        <PiggyBankCard onManageAccounts={() => setPiggyBankOpen(true)} />

        <Tabs defaultValue="mine" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-xs">
            <TabsTrigger value="mine">My entries</TabsTrigger>
            <TabsTrigger value="shared">
              Shared with me
              {sharedEntries.length > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/15 text-primary px-1.5 text-xs">
                  {sharedEntries.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* My entries */}
          <TabsContent value="mine" className="mt-4 space-y-3">
            {isLoading ? (
              <EntrySkeletons />
            ) : entries.length === 0 ? (
              <EmptyState
                icon={<Wallet className="size-6 text-muted-foreground" />}
                title="No entries yet"
                description="Add your first income or expense to start tracking your budget. Everything is encrypted end-to-end."
                action={
                  <Button onClick={openNew}>
                    <Plus className="size-4 mr-2" /> Add entry
                  </Button>
                }
              />
            ) : (
              entries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} onEdit={openEdit} onShare={openShare} />
              ))
            )}
          </TabsContent>

          {/* Shared with me */}
          <TabsContent value="shared" className="mt-4 space-y-3">
            {sharedLoading ? (
              <EntrySkeletons />
            ) : sharedEntries.length === 0 ? (
              <EmptyState
                icon={<Inbox className="size-6 text-muted-foreground" />}
                title="Nothing shared with you"
                description="When someone shares a budget entry with you, it'll appear here — decrypted just for you."
              />
            ) : (
              sharedEntries.map((entry) => (
                <SharedEntryCard key={entry.eventId} entry={entry} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Floating add button */}
      <button
        onClick={openNew}
        aria-label="Add entry"
        className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-[#39ff14] to-[#14ff8c] text-black shadow-lg shadow-primary/40 transition-transform hover:scale-105 active:scale-95"
      >
        <Plus className="size-7" />
      </button>

      <EntryFormDialog open={formOpen} onOpenChange={setFormOpen} entry={editing} />
      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        entry={sharingEntry}
        onManageContacts={() => setContactsOpen(true)}
      />
      <ContactsDialog open={contactsOpen} onOpenChange={setContactsOpen} />
      <PartnersDialog open={partnersOpen} onOpenChange={setPartnersOpen} />
      <PiggyBankDialog open={piggyBankOpen} onOpenChange={setPiggyBankOpen} />
      <CategoriesDialog open={categoriesOpen} onOpenChange={setCategoriesOpen} />
    </div>
  );
}

function EntrySkeletons() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border bg-card p-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-card/50 py-12 px-6 text-center">
      <div className="inline-flex items-center justify-center size-12 rounded-full bg-muted mb-4">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1.5">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
