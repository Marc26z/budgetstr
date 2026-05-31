import { useEffect, useState } from 'react';
import { GripVertical, Loader2, Plus, Tag, Trash2 } from 'lucide-react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCategories, useSaveCategories } from '@/hooks/useCategories';
import { useToast } from '@/hooks/useToast';
import { CURRENCIES, type CategoryBudget } from '@/lib/budget';

interface CategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoriesDialog({ open, onOpenChange }: CategoriesDialogProps) {
  const { data: saved = [], isLoading } = useCategories();
  const { mutateAsync: save, isPending } = useSaveCategories();
  const { toast } = useToast();

  // Local editable copy of the list.
  const [cats, setCats] = useState<CategoryBudget[]>([]);
  const [newName, setNewName] = useState('');

  // Sync from server whenever dialog opens.
  useEffect(() => {
    if (open && saved.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCats(saved.map((c) => ({ ...c })));
    }
  }, [open, saved]);

  const handleAddCategory = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (cats.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: 'Category already exists', variant: 'destructive' });
      return;
    }
    setCats((prev) => [...prev, { name: trimmed, budget: 0, currency: 'USD' }]);
    setNewName('');
  };

  const handleRemove = (name: string) => {
    setCats((prev) => prev.filter((c) => c.name !== name));
  };

  const handleBudgetChange = (name: string, value: string) => {
    const num = parseFloat(value);
    setCats((prev) =>
      prev.map((c) =>
        c.name === name ? { ...c, budget: Number.isFinite(num) && num >= 0 ? num : 0 } : c,
      ),
    );
  };

  const handleCurrencyChange = (name: string, currency: string) => {
    setCats((prev) =>
      prev.map((c) => (c.name === name ? { ...c, currency } : c)),
    );
  };

  const handleSave = async () => {
    try {
      await save(cats);
      toast({ title: 'Categories saved' });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Could not save',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="size-5 text-primary" /> Categories &amp; Budgets
          </DialogTitle>
          <DialogDescription>
            Add custom categories and set a monthly budget for each. Expenses are tracked against these budgets.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Add category */}
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
                placeholder="New category name…"
                className="flex-1 text-base md:text-sm"
              />
              <Button type="button" size="icon" onClick={handleAddCategory} disabled={!newName.trim()}>
                <Plus className="size-4" />
              </Button>
            </div>

            {/* Category list */}
            <div className="space-y-2 max-h-[50vh] overflow-y-auto -mx-1 px-1">
              {cats.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No categories. Add one above.
                </p>
              )}
              {cats.map((cat) => (
                <div
                  key={cat.name}
                  className="flex items-center gap-2 rounded-lg border bg-card p-3"
                >
                  <GripVertical className="size-4 text-muted-foreground/50 shrink-0 hidden sm:block" />

                  {/* Name */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{cat.name}</p>
                  </div>

                  {/* Budget amount */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      value={cat.budget || ''}
                      onChange={(e) => handleBudgetChange(cat.name, e.target.value)}
                      placeholder="0"
                      className="w-20 text-right text-sm h-8"
                    />
                    <Select value={cat.currency} onValueChange={(v) => handleCurrencyChange(cat.name, v)}>
                      <SelectTrigger className="w-[70px] h-8 text-xs">
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

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(cat.name)}
                    className="text-muted-foreground hover:text-destructive shrink-0 size-8"
                    aria-label={`Remove ${cat.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isPending}>
                {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
