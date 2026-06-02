import { useState } from 'react';
import { Loader2, Plus, Trash2, TrendingDown } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebts, useSaveDebts } from '@/hooks/useDebts';
import { useToast } from '@/hooks/useToast';
import {
  CURRENCIES,
  DEBT_TYPES,
  formatAmount,
  newEntryId,
  type Debt,
  type DebtType,
} from '@/lib/budget';

interface DebtsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DebtsDialog({ open, onOpenChange }: DebtsDialogProps) {
  const { data: debts = [], isLoading } = useDebts();
  const { mutateAsync: save, isPending } = useSaveDebts();
  const { toast } = useToast();

  const [label, setLabel] = useState('');
  const [balance, setBalance] = useState('');
  const [apr, setApr] = useState('');
  const [minPayment, setMinPayment] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [type, setType] = useState<DebtType>('credit_card');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedLabel = label.trim();
    const numericBalance = parseFloat(balance);
    const numericApr = apr.trim() ? parseFloat(apr) : undefined;
    const numericMin = minPayment.trim() ? parseFloat(minPayment) : undefined;
    if (!trimmedLabel) {
      toast({ title: 'Please enter a label.', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(numericBalance) || numericBalance < 0) {
      toast({ title: 'Please enter a valid balance.', variant: 'destructive' });
      return;
    }
    if (numericApr !== undefined && (!Number.isFinite(numericApr) || numericApr < 0)) {
      toast({ title: 'APR must be a valid number.', variant: 'destructive' });
      return;
    }
    if (numericMin !== undefined && (!Number.isFinite(numericMin) || numericMin < 0)) {
      toast({ title: 'Minimum payment must be a valid number.', variant: 'destructive' });
      return;
    }

    const debt: Debt = {
      id: newEntryId(),
      label: trimmedLabel,
      balance: numericBalance,
      currency,
      type,
      ...(numericApr !== undefined && { apr: numericApr }),
      ...(numericMin !== undefined && { minPayment: numericMin }),
    };

    try {
      await save([...debts, debt]);
      setLabel('');
      setBalance('');
      setApr('');
      setMinPayment('');
      toast({ title: 'Debt added' });
    } catch (err) {
      toast({
        title: 'Could not save',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await save(debts.filter((d) => d.id !== id));
      toast({ title: 'Removed' });
    } catch (err) {
      toast({
        title: 'Could not remove',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const handleBalanceChange = async (id: string, value: string) => {
    const num = parseFloat(value);
    if (!Number.isFinite(num) || num < 0) return;
    try {
      await save(debts.map((d) => (d.id === id ? { ...d, balance: num } : d)));
    } catch (err) {
      toast({
        title: 'Could not update',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="size-5 text-rose-400" /> Debts
          </DialogTitle>
          <DialogDescription>
            Track mortgages, credit cards, student loans, and other balances
            you owe. Optional APR and minimum payment fields help estimate
            monthly obligations.
          </DialogDescription>
        </DialogHeader>

        {/* Add form */}
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="debt-label">Label</Label>
            <Input
              id="debt-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Chase Visa, Mortgage"
              className="text-base md:text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as DebtType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEBT_TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <div className="space-y-2">
            <Label htmlFor="debt-balance">Balance owed</Label>
            <Input
              id="debt-balance"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0.00"
              className="text-base md:text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="debt-apr">APR % (optional)</Label>
              <Input
                id="debt-apr"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={apr}
                onChange={(e) => setApr(e.target.value)}
                placeholder="0.00"
                className="text-base md:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-min">Min payment (optional)</Label>
              <Input
                id="debt-min"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={minPayment}
                onChange={(e) => setMinPayment(e.target.value)}
                placeholder="0.00"
                className="text-base md:text-sm"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isPending || !label.trim() || !balance}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Plus className="size-4 mr-2" /> Add debt
              </>
            )}
          </Button>
        </form>

        {/* List */}
        <div className="border-t pt-4">
          {isLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : debts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No debts yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {debts.map((d) => (
                <DebtRow
                  key={d.id}
                  debt={d}
                  onRemove={() => handleRemove(d.id)}
                  onBalanceChange={(v) => handleBalanceChange(d.id, v)}
                  disabled={isPending}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DebtRow({
  debt,
  onRemove,
  onBalanceChange,
  disabled,
}: {
  debt: Debt;
  onRemove: () => void;
  onBalanceChange: (value: string) => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(debt.balance));
  const typeLabel = DEBT_TYPES.find((t) => t.id === debt.type)?.label ?? 'Other';

  const startEdit = () => {
    setDraft(String(debt.balance));
    setEditing(true);
  };

  const commitEdit = () => {
    const num = parseFloat(draft);
    if (Number.isFinite(num) && num >= 0 && num !== debt.balance) {
      onBalanceChange(draft);
    }
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-400">
        <TrendingDown className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{debt.label}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-muted-foreground">{typeLabel}</span>
          {debt.apr !== undefined && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {debt.apr.toFixed(2)}% APR
            </span>
          )}
          {debt.minPayment !== undefined && debt.minPayment > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              · {formatAmount(debt.minPayment, debt.currency)}/mo
            </span>
          )}
        </div>
      </div>

      {editing ? (
        <Input
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
            if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
          }}
          className="w-28 text-right h-8 text-sm"
        />
      ) : (
        <button
          type="button"
          onClick={startEdit}
          className="text-sm font-semibold tabular-nums text-rose-400 hover:opacity-80 transition-colors"
        >
          {formatAmount(debt.balance, debt.currency)}
        </button>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${debt.label}`}
        className="text-muted-foreground hover:text-destructive shrink-0 size-8"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
