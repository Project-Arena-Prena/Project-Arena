import Image from 'next/image';
import { cn } from '@/lib/cn';

export function ProjectLogo({
  name,
  logoUrl,
  size = 'md',
}: {
  name: string;
  logoUrl: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = { sm: 'h-9 w-9 text-xs', md: 'h-12 w-12 text-sm', lg: 'h-20 w-20 text-xl' }[size];

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden border hairline bg-ink-800 font-mono font-semibold uppercase text-bone',
        sizeClass,
      )}
      aria-hidden
    >
      {logoUrl ? (
        <Image src={logoUrl} alt="" fill sizes={size === 'lg' ? '80px' : size === 'md' ? '48px' : '36px'} className="object-cover" />
      ) : (
        name.slice(0, 2)
      )}
    </span>
  );
}
