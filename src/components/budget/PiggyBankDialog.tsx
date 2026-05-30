import { useState } from 'react';
import { Loader2, PiggyBank, Plus, Trash2, Zap } from 'lucide-react';

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
import { usePiggyBank, useSavePiggyBank } from '@/hooks/usePiggyBank';
import { useToast } from '@/hooks/useToast';
import {
  PIGGYBANK_PROVIDERS,
  newEntryId,
  type PiggyBankAccount,
} from '@/lib/budget';

interface PiggyBankDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LIGHTNING_RE = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function PiggyBankDialog({ open, onOpenChange }: PiggyBankDialogProps) {
  const { data: accounts = [], isLoading } = usePiggyBank();
  const { mutateAsync: save, isPending } = useSavePiggyBank();
  const { toast } = useToast();

  const [provider, setProvider] = useState<string>('custom');
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');

  const selectedPreset = PIGGYBANK_PROVIDERS.find((p) => p.id === provider);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = address.trim();
    if (!LIGHTNING_RE.test(trimmed)) {
      toast({ title: 'Invalid lightning address', description: 'Enter a valid address like user@domain.com.', variant: 'destructive' });
      return;
    }
    if (accounts.some((a) => a.address === trimmed)) {
      toast({ title: 'Already added', variant: 'destructive' });
      return;
    }

    const account: PiggyBankAccount = {
      id: newEntryId(),
      label: label.trim() || selectedPreset?.label || trimmed,
      address: trimmed,
      provider: provider !== 'custom' ? provider : undefined,
    };

    try {
      await save([...accounts, account]);
      setAddress('');
      setLabel('');
      setProvider('custom');
      toast({ title: 'Account added' });
    } catch (err) {
      toast({ title: 'Could not save', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await save(accounts.filter((a) => a.id !== id));
      toast({ title: 'Account removed' });
    } catch (err) {
      toast({ title: 'Could not remove', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PiggyBank className="size-5 text-amber-400" /> Piggy Bank
          </DialogTitle>
          <DialogDescription>
            Add lightning addresses where you save money. Tap any account to open a payment link or scan a QR code.
          </DialogDescription>
        </DialogHeader>

        {/* Add account form */}
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={(v) => { setProvider(v); setAddress(''); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIGGYBANK_PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pb-address">Lightning address</Label>
            <Input
              id="pb-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={selectedPreset?.placeholder ?? 'user@domain.com'}
              className="font-mono text-base md:text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pb-label">Label (optional)</Label>
            <Input
              id="pb-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. River savings"
              className="text-base md:text-sm"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending || !address.trim()}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <><Plus className="size-4 mr-2" /> Add account</>}
          </Button>
        </form>

        {/* Saved accounts */}
        <div className="border-t pt-4">
          {isLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No accounts added yet. Add a lightning address to start saving.
            </p>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <AccountRow key={account.id} account={account} onRemove={() => handleRemove(account.id)} disabled={isPending} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AccountRow({
  account,
  onRemove,
  disabled,
}: {
  account: PiggyBankAccount;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
        <Zap className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{account.label}</p>
        <p className="text-xs text-muted-foreground truncate font-mono">{account.address}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${account.label}`}
        className="text-muted-foreground hover:text-destructive shrink-0"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
