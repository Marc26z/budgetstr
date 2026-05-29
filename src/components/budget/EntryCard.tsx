import { useState } from 'react';
import { MoreVertical, Pencil, Share2, Trash2, ArrowDownLeft, ArrowUpRight, Repeat } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatAmount, recurrenceLabel, type BudgetEntry } from '@/lib/budget';
import { useDeleteEntry } from '@/hooks/useEntryMutations';
import { useToast } from '@/hooks/useToast';

interface EntryCardProps {
  entry: BudgetEntry;
  onEdit: (entry: BudgetEntry) => void;
  onShare: (entry: BudgetEntry) => void;
}

export function EntryCard({ entry, onEdit, onShare }: EntryCardProps) {
  const { mutateAsync: deleteEntry, isPending } = useDeleteEntry();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isExpense = entry.type === 'expense';

  const handleDelete = async () => {
    try {
      await deleteEntry(entry);
      toast({ title: 'Entry deleted' });
      setConfirmOpen(false);
    } catch (err) {
      toast({
        title: 'Could not delete',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
          isExpense
            ? 'bg-rose-500/15 text-rose-500'
            : 'bg-primary/15 text-primary'
        }`}
      >
        {isExpense ? <ArrowUpRight className="size-5" /> : <ArrowDownLeft className="size-5" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{entry.title}</p>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-xs text-muted-foreground">{entry.date}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
            {entry.category}
          </Badge>
          {entry.recurrence && entry.recurrence !== 'none' && (
            <Badge className="text-[10px] px-1.5 py-0 font-normal gap-0.5 bg-primary/15 text-primary border-transparent hover:bg-primary/15">
              <Repeat className="size-2.5" />
              {recurrenceLabel(entry.recurrence)}
            </Badge>
          )}
        </div>
        {entry.note && (
          <p className="text-xs text-muted-foreground truncate mt-1">{entry.note}</p>
        )}
      </div>

      <div className="text-right">
        <p
          className={`font-semibold tabular-nums ${
            isExpense ? 'text-rose-500' : 'text-primary'
          }`}
        >
          {isExpense ? '-' : '+'}
          {formatAmount(entry.amount, entry.currency)}
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0" aria-label="Entry actions">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onShare(entry)}>
            <Share2 className="size-4 mr-2" /> Share
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(entry)}>
            <Pencil className="size-4 mr-2" /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setConfirmOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              "{entry.title}" will be permanently removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
