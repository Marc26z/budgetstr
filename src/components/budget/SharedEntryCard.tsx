import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatAmount, type SharedEntry } from '@/lib/budget';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';

export function SharedEntryCard({ entry }: { entry: SharedEntry }) {
  const author = useAuthor(entry.sharerPubkey);
  const meta = author.data?.metadata;
  const name = meta?.name || meta?.display_name || genUserName(entry.sharerPubkey);
  const isExpense = entry.type === 'expense';

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
          isExpense
            ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
            : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
        }`}
      >
        {isExpense ? <ArrowUpRight className="size-5" /> : <ArrowDownLeft className="size-5" />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{entry.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{entry.date}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
            {entry.category}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Avatar className="size-4">
            <AvatarImage src={meta?.picture} alt={name} />
            <AvatarFallback className="text-[8px]">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">Shared by {name}</span>
        </div>
      </div>

      <div className="text-right">
        <p
          className={`font-semibold tabular-nums ${
            isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {isExpense ? '-' : '+'}
          {formatAmount(entry.amount, entry.currency)}
        </p>
      </div>
    </div>
  );
}
