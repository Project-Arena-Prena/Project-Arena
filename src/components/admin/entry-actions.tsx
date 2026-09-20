'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function EntryActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: 'approve' | 'reject') {
    const reason = action === 'reject' ? window.prompt('Rejection reason (optional)') ?? '' : undefined;
    setPending(true);
    setError(null);
    const response = await fetch(`/api/admin/entries/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(
        payload?.error?.includes('founding_free_approvals_pending')
          ? 'Approve the reserved free entries first.'
          : payload?.error ?? 'Entry update failed.',
      );
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => act('approve')}
        className="inline-flex h-8 items-center border border-live/30 px-3 font-mono text-[10px] uppercase tracking-widest text-live"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => act('reject')}
        className="inline-flex h-8 items-center border border-arena/30 px-3 font-mono text-[10px] uppercase tracking-widest text-arena"
      >
        Reject
      </button>
      {error ? <span className="block max-w-48 text-[10px] text-arena">{error}</span> : null}
    </>
  );
}
