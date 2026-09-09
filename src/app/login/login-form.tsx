'use client';

import { useState } from 'react';
import { Button, ButtonLink, Label, Panel } from '@/components/ui';
import { useSessionUser } from '@/components/auth/session-provider';
import { safeInternalPath } from '@/lib/validation';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export function LoginForm({ next, errorCode, embedded = false }: { next: string; errorCode?: string; embedded?: boolean }) {
  const user = useSessionUser();
  const destination = safeInternalPath(next, '/dashboard');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    errorCode ? 'Sign in failed. Request a new code.' : null,
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || user) return;
    if (!isSupabaseConfigured) {
      setError('Sign-in is temporarily unavailable. Please try again later.');
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
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(destination)}`,
        },
      });
      if (authError) throw authError;
      setSent(true);
    } catch {
      setError('Could not send the code. Try again in a minute.');
    } finally {
      setPending(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (pending || user) return;
    if (!isSupabaseConfigured) {
      setError('Sign-in is temporarily unavailable. Please try again later.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'email',
      });
      if (authError) throw authError;
      window.location.assign(destination);
    } catch {
      setError('That code is invalid or expired. Request a new one.');
    } finally {
      setPending(false);
    }
  }

  if (user) return <div className="flex flex-col gap-5">
    <p className="text-sm leading-relaxed text-bone-dim">You’re signed in. Continue with your account.</p>
    <ButtonLink href={destination} size="lg">Continue</ButtonLink>
  </div>;

  if (sent) {
    return (
      <form onSubmit={verify} className="max-w-lg">
        <Panel className={embedded ? "sign-in-form-fields flex flex-col gap-5" : "flex flex-col gap-5 p-6 sm:p-8"}>
          <div>
            <Label>Check your email</Label>
            <h2 className="mt-4 text-2xl font-semibold tracking-headline">Enter your sign-in code.</h2>
            <p className="mt-3 text-sm leading-relaxed text-bone-dim">
              We sent a one-time code to {email}. It expires shortly and can only be used once.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="otp" className="label">
              Six-digit code
            </label>
            <input
              id="otp"
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="h-12 w-full border hairline bg-transparent px-3 font-mono text-lg tracking-[0.35em] text-bone placeholder:text-bone-faint"
            />
          </div>
          {error ? <p role="alert" className="font-mono text-[10px] uppercase tracking-widest text-arena">{error}</p> : null}
          <Button type="submit" size="lg" disabled={pending || otp.length !== 6} className="w-full sm:w-auto">
            {pending ? 'Verifying' : 'Verify and sign in'}
          </Button>
          <button
            type="button"
            className="w-fit font-mono text-[10px] uppercase tracking-widest text-bone-dim hover:text-bone"
            onClick={() => {
              setSent(false);
              setOtp('');
              setError(null);
            }}
          >
            Use a different email
          </button>
        </Panel>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-lg">
      <Panel className={embedded ? "sign-in-form-fields flex flex-col gap-5" : "flex flex-col gap-5 p-6 sm:p-8"}>
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
        {error ? <p role="alert" className="font-mono text-[10px] uppercase tracking-widest text-arena">{error}</p> : null}
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? 'Sending' : 'Send sign-in code'}
        </Button>
        <p className="text-xs leading-relaxed text-bone-faint">
          One code. No password. Visitors and supporters stay anonymous.
        </p>
      </Panel>
    </form>
  );
}

