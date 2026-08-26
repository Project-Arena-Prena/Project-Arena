import Image from 'next/image';
import { cn } from '@/lib/cn';

export function ArenaMark({ className }: { className?: string }) {
  return (
    <Image
      src="/project-arena-symbol.png"
      alt=""
      width={512}
      height={512}
      sizes="36px"
      className={cn('object-contain brightness-0 invert', className)}
      aria-hidden
    />
  );
}
