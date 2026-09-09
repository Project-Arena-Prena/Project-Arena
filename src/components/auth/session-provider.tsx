'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export type SessionUser = { id: string; email?: string } | null;
const SessionContext = createContext<SessionUser>(null);

/** Display state only. Protected data and actions still verify the user on the server. */
export function SessionProvider({ initialUser, children }: { initialUser: SessionUser; children: ReactNode }) {
  const [user, setUser] = useState(initialUser);
  const currentId = useRef(initialUser?.id ?? null);
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let refresh: ReturnType<typeof setTimeout> | undefined;
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ? { id: session.user.id, email: session.user.email } : null;
      setUser(nextUser);
      if (currentId.current !== (nextUser?.id ?? null)) {
        currentId.current = nextUser?.id ?? null;
        // Keep server components in sync, outside Supabase's synchronous auth callback.
        clearTimeout(refresh);
        refresh = setTimeout(() => router.refresh(), 0);
      }
    });
    return () => { clearTimeout(refresh); subscription.unsubscribe(); };
  }, [router]);

  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSessionUser() { return useContext(SessionContext); }
