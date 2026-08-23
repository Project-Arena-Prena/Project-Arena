'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RefundButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function refund() {
    const reason = window.prompt('Refund reason', 'administrative exception');
    if (!reason) return;
    setPending(true);
    await fetch(`/api/admin/payments/${id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    setPending(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={refund}
      className="h-8 border border-white/15 px-3 font-mono text-[10px] uppercase tracking-widest text-bone-dim"
    >
      Refund
    </button>
  );
}
