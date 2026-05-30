import { useState } from 'react';
import { ExternalLink, PiggyBank, Plus, QrCode, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { QRCodeCanvas } from '@/components/ui/qrcode';
import { usePiggyBank } from '@/hooks/usePiggyBank';
import type { PiggyBankAccount } from '@/lib/budget';

interface PiggyBankCardProps {
  onManageAccounts: () => void;
}

/**
 * Dashboard card showing the user's piggy bank lightning accounts with:
 * - Clickable `lightning:` link to pay (opens the system lightning handler)
 * - QR code button to scan with a wallet
 */
export function PiggyBankCard({ onManageAccounts }: PiggyBankCardProps) {
  const { data: accounts = [] } = usePiggyBank();
  const [qrAccount, setQrAccount] = useState<PiggyBankAccount | null>(null);

  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/5 p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
            <PiggyBank className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-400">Piggy Bank</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add lightning addresses (River, Strike, Cash App, Alby Hub) to save toward your yearly expenses.
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={onManageAccounts}>
              <Plus className="size-3.5 mr-1.5" /> Add account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PiggyBank className="size-5 text-amber-400" />
            <p className="text-sm font-medium text-amber-400">Piggy Bank</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onManageAccounts} className="text-xs text-muted-foreground h-7 px-2">
            Manage
          </Button>
        </div>

        <div className="space-y-2">
          {accounts.map((account) => (
            <AccountItem
              key={account.id}
              account={account}
              onShowQr={() => setQrAccount(account)}
            />
          ))}
        </div>
      </div>

      {/* QR Code dialog */}
      <Dialog open={!!qrAccount} onOpenChange={(open) => { if (!open) setQrAccount(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center text-sm">
              {qrAccount?.label}
            </DialogTitle>
          </DialogHeader>
          {qrAccount && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="rounded-xl bg-white p-4">
                <QRCodeCanvas
                  value={`lightning:${qrAccount.address}`}
                  size={200}
                  level="M"
                />
              </div>
              <p className="text-xs text-muted-foreground font-mono text-center break-all">
                {qrAccount.address}
              </p>
              <a
                href={`lightning:${qrAccount.address}`}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Zap className="size-4" /> Open in wallet
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AccountItem({
  account,
  onShowQr,
}: {
  account: PiggyBankAccount;
  onShowQr: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3 sm:p-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
        <Zap className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{account.label}</p>
        <a
          href={`lightning:${account.address}`}
          className="text-xs text-primary hover:underline underline-offset-2 font-mono truncate block mt-0.5"
          title={`Pay ${account.address}`}
        >
          {account.address}
          <ExternalLink className="size-3 inline-block ml-1 -mt-0.5" />
        </a>
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={onShowQr}
        className="shrink-0 size-9"
        aria-label={`Show QR for ${account.label}`}
        title="Show QR code"
      >
        <QrCode className="size-4" />
      </Button>
    </div>
  );
}
