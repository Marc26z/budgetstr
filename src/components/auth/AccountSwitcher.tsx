import { useState } from 'react';
import { ChevronDown, KeyRound, LogOut, QrCode, UserIcon, UserPlus } from 'lucide-react';
import { useNostrLogin } from '@nostrify/react/login';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { useLoggedInAccounts, type Account } from '@/hooks/useLoggedInAccounts';
import { genUserName } from '@/lib/genUserName';
import { NpubQrDialog } from '@/components/budget/NpubQrDialog';
import { RevealNsecDialog } from '@/components/budget/RevealNsecDialog';

interface AccountSwitcherProps {
  onAddAccountClick: () => void;
}

/**
 * Pull a retrievable nsec out of the active login, if any.
 *
 * Only `type === 'nsec'` logins carry a recoverable bech32 secret key in
 * `login.data.nsec`. Bunker logins store a *client* nsec used for NIP-46
 * transport — exposing that would not give the user their account key, so
 * we deliberately skip it. Extension logins never expose the private key.
 */
function getActiveNsec(login: unknown): string | null {
  if (!login || typeof login !== 'object') return null;
  const l = login as { type?: string; data?: { nsec?: unknown } };
  if (l.type !== 'nsec') return null;
  const nsec = l.data?.nsec;
  return typeof nsec === 'string' ? nsec : null;
}

export function AccountSwitcher({ onAddAccountClick }: AccountSwitcherProps) {
  const { currentUser, otherUsers, isLoading, setLogin, removeLogin } = useLoggedInAccounts();
  const { logins } = useNostrLogin();
  const [qrOpen, setQrOpen] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);

  if (!currentUser) return null;

  // The current login is always the first entry; if it's an nsec login we
  // can offer "Reveal my secret key", otherwise that menu item is hidden.
  const activeNsec = getActiveNsec(logins[0]);

  const getDisplayName = (account: Account): string => {
    return account.metadata.name ?? genUserName(account.pubkey);
  }

  // While the metadata query is in-flight and we don't yet have a name,
  // we don't want to flash a generated animal name / its first letter.
  const isCurrentUserPending = isLoading && !currentUser.metadata.name;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button className='flex items-center gap-2 h-10 p-1 pr-2.5 rounded-full hover:bg-accent transition-all text-foreground'>
          <Avatar className='w-8 h-8'>
            <AvatarImage
              src={currentUser.metadata.picture}
              alt={isCurrentUserPending ? '' : getDisplayName(currentUser)}
            />
            <AvatarFallback>
              {isCurrentUserPending ? (
                <Skeleton className='size-full rounded-full' />
              ) : (
                getDisplayName(currentUser).charAt(0)
              )}
            </AvatarFallback>
          </Avatar>
          <ChevronDown className='w-4 h-4 text-muted-foreground' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-56 p-2 animate-scale-in'>
        <div className='font-medium text-sm px-2 py-1.5'>Switch Account</div>
        {otherUsers.map((user) => {
          const isPending = isLoading && !user.metadata.name;
          return (
            <DropdownMenuItem
              key={user.id}
              onClick={() => setLogin(user.id)}
              className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
            >
              <Avatar className='w-8 h-8'>
                <AvatarImage
                  src={user.metadata.picture}
                  alt={isPending ? '' : getDisplayName(user)}
                />
                <AvatarFallback>
                  {isPending ? (
                    <Skeleton className='size-full rounded-full' />
                  ) : (
                    getDisplayName(user)?.charAt(0) || <UserIcon />
                  )}
                </AvatarFallback>
              </Avatar>
              <div className='flex-1 truncate'>
                {isPending ? (
                  <Skeleton className='h-4 w-24' />
                ) : (
                  <p className='text-sm font-medium'>{getDisplayName(user)}</p>
                )}
              </div>
              {user.id === currentUser.id && <div className='w-2 h-2 rounded-full bg-primary'></div>}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setQrOpen(true)}
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
        >
          <QrCode className='w-4 h-4' />
          <span>Share my npub</span>
        </DropdownMenuItem>
        {activeNsec && (
          <DropdownMenuItem
            onClick={() => setRevealOpen(true)}
            className='flex items-center gap-2 cursor-pointer p-2 rounded-md text-amber-400 focus:text-amber-300'
          >
            <KeyRound className='w-4 h-4' />
            <span>Reveal my secret key</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={onAddAccountClick}
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
        >
          <UserPlus className='w-4 h-4' />
          <span>Add another account</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => removeLogin(currentUser.id)}
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md text-red-500'
        >
          <LogOut className='w-4 h-4' />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>

      <NpubQrDialog open={qrOpen} onOpenChange={setQrOpen} pubkey={currentUser.pubkey} />
      {activeNsec && (
        <RevealNsecDialog open={revealOpen} onOpenChange={setRevealOpen} nsec={activeNsec} />
      )}
    </DropdownMenu>
  );
}
