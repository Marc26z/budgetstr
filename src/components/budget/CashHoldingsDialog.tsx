import { useState } from 'react';
import { Banknote, CreditCard, Loader2, Plus, Trash2 } from 'lucide-react';

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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCashHoldings, useSaveCashHoldings } from '@/hooks/useCashHoldings';
import { useToast } from '@/hooks/useToast';
import {
  CURRENCIES,
  formatAmount,
  newEntryId,
  type CashHolding,
} from '@/lib/budget';

interface CashHoldingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CashHoldingsDialog({ open, onOpenChange }: CashHoldingsDialogProps) {
  const { data: holdings = [], isLoading } = useCashHoldings();
  const { mutateAsync: save, isPending } = useSaveCashHoldings();
  const { toast } = useToast();

  // New-holding form state.
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [paper, setPaper] = useState(true);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedLabel = label.trim();
    const numericAmount = parseFloat(amount);
    if (!trimmedLabel) {
      toast({ title: 'Please enter a label.', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      toast({ title: 'Please enter a valid amount.', variant: 'destructive' });
      return;
    }

    const holding: CashHolding = {
      id: newEntryId(),
      label: trimmedLabel,
      amount: numericAmount,
      currency,
      paper,
    };

    try {
      await save([...holdings, holding]);
      setLabel('');
      setAmount('');
      toast({ title: 'Cash added' });
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
      await save(holdings.filter((h) => h.id !== id));
      toast({ title: 'Removed' });
    } catch (err) {
      toast({
        title: 'Could not remove',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const handleTogglePaper = async (id: string) => {
    try {
      await save(holdings.map((h) => (h.id === id ? { ...h, paper: !h.paper } : h)));
    } catch (err) {
      toast({
        title: 'Could not update',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const handleAmountChange = async (id: string, value: string) => {
    const num = parseFloat(value);
    if (!Number.isFinite(num) || num < 0) return;
    try {
      await save(holdings.map((h) => (h.id === id ? { ...h, amount: num } : h)));
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
            <Banknote className="size-5 text-primary" /> Cash on hand
          </DialogTitle>
          <DialogDescription>
            Track physical or digital cash balances. Toggle "paper money" for
            physical bills and coins.
          </DialogDescription>
        </DialogHeader>

        {/* Add form */}
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="cash-label">Label</Label>
            <Input
              id="cash-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Wallet, Safe, Cash App"
              className="text-base md:text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="cash-amount">Amount</Label>
              <Input
                id="cash-amount"
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

          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              {paper ? (
                <Banknote className="size-4 text-primary" />
              ) : (
                <CreditCard className="size-4 text-muted-foreground" />
              )}
              <Label htmlFor="cash-paper" className="cursor-pointer">
                Paper money
              </Label>
            </div>
            <Switch id="cash-paper" checked={paper} onCheckedChange={setPaper} />
          </div>

          <Button type="submit" className="w-full" disabled={isPending || !label.trim() || !amount}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Plus className="size-4 mr-2" /> Add cash
              </>
            )}
          </Button>
        </form>

        {/* Existing list */}
        <div className="border-t pt-4">
          {isLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : holdings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No cash balances yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {holdings.map((h) => (
                <HoldingRow
                  key={h.id}
                  holding={h}
                  onRemove={() => handleRemove(h.id)}
                  onTogglePaper={() => handleTogglePaper(h.id)}
                  onAmountChange={(value) => handleAmountChange(h.id, value)}
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

function HoldingRow({
  holding,
  onRemove,
  onTogglePaper,
  onAmountChange,
  disabled,
}: {
  holding: CashHolding;
  onRemove: () => void;
  onTogglePaper: () => void;
  onAmountChange: (value: string) => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(holding.amount));

  const startEdit = () => {
    setDraft(String(holding.amount));
    setEditing(true);
  };

  const commitEdit = () => {
    const num = parseFloat(draft);
    if (Number.isFinite(num) && num >= 0 && num !== holding.amount) {
      onAmountChange(draft);
    }
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <button
        type="button"
        onClick={onTogglePaper}
        disabled={disabled}
        title={holding.paper ? 'Paper money — tap to switch to digital' : 'Digital — tap to switch to paper'}
        className={`flex size-9 shrink-0 items-center justify-center rounded-full transition-colors ${
          holding.paper
            ? 'bg-primary/15 text-primary'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        {holding.paper ? <Banknote className="size-4" /> : <CreditCard className="size-4" />}
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{holding.label}</p>
        <p className="text-xs text-muted-foreground">
          {holding.paper ? 'Paper money' : 'Digital'}
        </p>
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
          className="text-sm font-semibold tabular-nums hover:text-primary transition-colors"
        >
          {formatAmount(holding.amount, holding.currency)}
        </button>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${holding.label}`}
        className="text-muted-foreground hover:text-destructive shrink-0 size-8"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
