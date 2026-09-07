'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';
const SignInDialog = dynamic(() => import('./sign-in-dialog'), { ssr: false });

export function SignInTrigger() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return <><Link href="/login" className="sign-in-trigger" onClick={(event) => {
    if (pathname === '/login' || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); setOpen(true);
  }}>Sign in</Link>{open ? <SignInDialog onClose={close} /> : null}</>;
}
