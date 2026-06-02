import { useState } from 'react';
import { Loader2, Plus, Trash2, TrendingUp } from 'lucide-react';

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
import { useInvestments, useSaveInvestments } from '@/hooks/useInvestments';
import { useToast } from '@/hooks/useToast';
import {
  CURRENCIES,
  INVESTMENT_TYPES,
  formatAmount,
  newEntryId,
  type Investment,
  type InvestmentType,
} from '@/lib/budget';

interface InvestmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvestmentsDialog({ open, onOpenChange }: InvestmentsDialogProps) {
  const { data: investments = [], isLoading } = useInvestments();
  const { mutateAsync: save, isPending } = useSaveInvestments();
  const { toast } = useToast();

  const [label, setLabel] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [costBasis, setCostBasis] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [type, setType] = useState<InvestmentType>('stocks');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedLabel = label.trim();
    const numericValue = parseFloat(currentValue);
    const numericBasis = costBasis.trim() ? parseFloat(costBasis) : undefined;
    if (!trimmedLabel) {
      toast({ title: 'Please enter a label.', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      toast({ title: 'Please enter a valid current value.', variant: 'destructive' });
      return;
    }
    if (numericBasis !== undefined && (!Number.isFinite(numericBasis) || numericBasis < 0)) {
      toast({ title: 'Cost basis must be a valid number.', variant: 'destructive' });
      return;
    }

    const investment: Investment = {
      id: newEntryId(),
      label: trimmedLabel,
      currentValue: numericValue,
      currency,
      type,
      ...(numericBasis !== undefined && { costBasis: numericBasis }),
    };

    try {
      await save([...investments, investment]);
      setLabel('');
      setCurrentValue('');
      setCostBasis('');
      toast({ title: 'Investment added' });
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
      await save(investments.filter((i) => i.id !== id));
      toast({ title: 'Removed' });
    } catch (err) {
      toast({
        title: 'Could not remove',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const handleValueChange = async (id: string, value: string) => {
    const num = parseFloat(value);
    if (!Number.isFinite(num) || num < 0) return;
    try {
      await save(investments.map((i) => (i.id === id ? { ...i, currentValue: num } : i)));
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
            <TrendingUp className="size-5 text-emerald-400" /> Investments
          </DialogTitle>
          <DialogDescription>
            Track brokerage accounts, crypto, retirement, real estate, and more.
            Add a cost basis to see unrealized gain/loss.
          </DialogDescription>
        </DialogHeader>

        {/* Add form */}
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="inv-label">Label</Label>
            <Input
              id="inv-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Vanguard IRA, Coinbase BTC"
              className="text-base md:text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as InvestmentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVESTMENT_TYPES.map((t) => (
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="inv-value">Current value</Label>
              <Input
                id="inv-value"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                placeholder="0.00"
                className="text-base md:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-basis">Cost basis (optional)</Label>
              <Input
                id="inv-basis"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={costBasis}
                onChange={(e) => setCostBasis(e.target.value)}
                placeholder="0.00"
                className="text-base md:text-sm"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isPending || !label.trim() || !currentValue}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Plus className="size-4 mr-2" /> Add investment
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
          ) : investments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No investments yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {investments.map((inv) => (
                <InvestmentRow
                  key={inv.id}
                  investment={inv}
                  onRemove={() => handleRemove(inv.id)}
                  onValueChange={(v) => handleValueChange(inv.id, v)}
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

function InvestmentRow({
  investment,
  onRemove,
  onValueChange,
  disabled,
}: {
  investment: Investment;
  onRemove: () => void;
  onValueChange: (value: string) => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(investment.currentValue));
  const typeLabel = INVESTMENT_TYPES.find((t) => t.id === investment.type)?.label ?? 'Other';

  const startEdit = () => {
    setDraft(String(investment.currentValue));
    setEditing(true);
  };

  const commitEdit = () => {
    const num = parseFloat(draft);
    if (Number.isFinite(num) && num >= 0 && num !== investment.currentValue) {
      onValueChange(draft);
    }
    setEditing(false);
  };

  // Compute P/L if cost basis is set.
  const hasBasis = investment.costBasis !== undefined && investment.costBasis > 0;
  const pnl = hasBasis ? investment.currentValue - (investment.costBasis ?? 0) : 0;
  const pnlPct = hasBasis && (investment.costBasis ?? 0) > 0
    ? (pnl / (investment.costBasis ?? 1)) * 100
    : 0;
  const pnlPositive = pnl >= 0;

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
        <TrendingUp className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{investment.label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{typeLabel}</span>
          {hasBasis && (
            <span className={`text-xs tabular-nums ${pnlPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {pnlPositive ? '+' : ''}
              {formatAmount(pnl, investment.currency)}
              {' · '}
              {pnlPositive ? '+' : ''}
              {pnlPct.toFixed(1)}%
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
          className="text-sm font-semibold tabular-nums hover:text-primary transition-colors"
        >
          {formatAmount(investment.currentValue, investment.currency)}
        </button>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${investment.label}`}
        className="text-muted-foreground hover:text-destructive shrink-0 size-8"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
