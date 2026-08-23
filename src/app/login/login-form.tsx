'use client';

import { useState } from 'react';
import { Button, Label, Panel } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export function LoginForm({ next, errorCode }: { next: string; errorCode?: string }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    errorCode ? 'Sign in failed. Request a new link.' : null,
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!isSupabaseConfigured) {
      setError('Auth is not configured in this environment.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (authError) throw authError;
      setSent(true);
    } catch {
      setError('Could not send the link. Try again in a minute.');
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <Panel className="max-w-lg p-6 sm:p-8">
        <Label>Check your email</Label>
        <h2 className="mt-4 text-2xl font-semibold tracking-headline">The link is on its way.</h2>
        <p className="mt-3 text-sm leading-relaxed text-bone-dim">
          Open the magic link we sent to {email}. It signs you in and takes you to your dashboard.
        </p>
      </Panel>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-lg">
      <Panel className="flex flex-col gap-5 p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@domain.com"
            autoComplete="email"
            className="h-11 w-full border hairline bg-transparent px-3 font-mono text-[13px] text-bone placeholder:text-bone-faint"
          />
        </div>
        {error ? <p className="font-mono text-[10px] uppercase tracking-widest text-arena">{error}</p> : null}
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? 'Sending' : 'Send magic link'}
        </Button>
        <p className="text-xs leading-relaxed text-bone-faint">
          One click. No password. Visitors and supporters stay anonymous.
        </p>
      </Panel>
    </form>
  );
}
