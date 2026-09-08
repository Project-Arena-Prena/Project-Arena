'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';
import { ArrowUpRight, UserRound } from 'lucide-react';
import { useSessionUser } from './session-provider';
const SignInDialog = dynamic(() => import('./sign-in-dialog'), { ssr: false });

export function SignInTrigger() {
  const user = useSessionUser();
  if (user) return <Link href="/dashboard" prefetch={false} className="sign-in-trigger" aria-label="Your dashboard"><UserRound size={14} aria-hidden="true" /><span>Dashboard</span></Link>;
  return <GuestSignInTrigger />;
}

function GuestSignInTrigger() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return <><Link href="/login" className="sign-in-trigger" onClick={(event) => {
    if (pathname === '/login' || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); setOpen(true);
  }}>Sign in <ArrowUpRight size={13} aria-hidden="true" /></Link>{open ? <SignInDialog onClose={close} /> : null}</>;
}
