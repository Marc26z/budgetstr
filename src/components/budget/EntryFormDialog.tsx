import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CURRENCIES,
  RECURRENCES,
  DEFAULT_CATEGORIES,
  type BudgetEntry,
  type BudgetEntryPayload,
  type EntryType,
  type Recurrence,
} from '@/lib/budget';
import { useCategories } from '@/hooks/useCategories';
import { useSaveEntry } from '@/hooks/useEntryMutations';
import { useToast } from '@/hooks/useToast';

interface EntryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog edits an existing entry. */
  entry?: BudgetEntry | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export function EntryFormDialog({ open, onOpenChange, entry }: EntryFormDialogProps) {
  const { mutateAsync: saveEntry, isPending } = useSaveEntry();
  const { data: userCategories } = useCategories();
  const { toast } = useToast();

  // Use the user's custom categories if available, fall back to defaults.
  const categoryNames = userCategories && userCategories.length > 0
    ? userCategories.map((c) => c.name)
    : [...DEFAULT_CATEGORIES];

  const [type, setType] = useState<EntryType>('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<string>('USD');
  const [category, setCategory] = useState<string>('Other');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('none');

  // Reset form whenever the dialog opens (or the entry being edited changes).
  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setType(entry?.type ?? 'expense');
    setTitle(entry?.title ?? '');
    setAmount(entry ? String(entry.amount) : '');
    setCurrency(entry?.currency ?? 'USD');
    setCategory(entry?.category ?? 'Other');
    setDate(entry?.date ?? today());
    setNote(entry?.note ?? '');
    setRecurrence(entry?.recurrence ?? 'none');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, entry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (!title.trim()) {
      toast({ title: 'Please enter a title.', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast({ title: 'Please enter a valid amount.', variant: 'destructive' });
      return;
    }

    const payload: BudgetEntryPayload = {
      title: title.trim(),
      amount: numericAmount,
      currency,
      type,
      category,
      note: note.trim(),
      date,
      createdAt: entry?.createdAt ?? Math.floor(Date.now() / 1000),
      recurrence,
    };

    try {
      await saveEntry({ id: entry?.id, payload });
      toast({ title: entry ? 'Entry updated' : 'Entry added' });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Could not save entry',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry ? 'Edit entry' : 'New entry'}</DialogTitle>
          <DialogDescription>
            Your entry is encrypted end-to-end before it's saved.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`h-11 rounded-lg border text-sm font-medium transition-colors ${
                type === 'expense'
                  ? 'border-rose-500 bg-rose-500/15 text-rose-400'
                  : 'border-input text-muted-foreground hover:bg-accent'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`h-11 rounded-lg border text-sm font-medium transition-colors ${
                type === 'income'
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-input text-muted-foreground hover:bg-accent'
              }`}
            >
              Income
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry-title">Title</Label>
            <Input
              id="entry-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Groceries"
              className="text-base md:text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="entry-amount">Amount</Label>
              <Input
                id="entry-amount"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="text-base md:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryNames.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-date">Date</Label>
              <Input
                id="entry-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-base md:text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Repeats</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {RECURRENCES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRecurrence(r.value)}
                  className={`h-9 rounded-lg border text-xs font-medium transition-colors ${
                    recurrence === r.value
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-input text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {r.short}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry-note">Note (optional)</Label>
            <Textarea
              id="entry-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note…"
              rows={2}
              className="resize-none text-base md:text-sm"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Save entry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
