import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';

interface ContactNameProps {
  pubkey: string;
  /** Optional user-assigned label that takes precedence over profile metadata. */
  label?: string;
  className?: string;
}

/** Render a friendly display name for a pubkey, preferring a saved label. */
export function ContactName({ pubkey, label, className }: ContactNameProps) {
  const author = useAuthor(pubkey);
  const name =
    label?.trim() ||
    author.data?.metadata?.name ||
    author.data?.metadata?.display_name ||
    genUserName(pubkey);

  return <span className={className}>{name}</span>;
}
