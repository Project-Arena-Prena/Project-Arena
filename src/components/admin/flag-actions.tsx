'use client';

import { useRouter } from 'next/navigation';

export function FlagActions({ id }: { id: string }) {
  const router = useRouter();
  async function setStatus(status: 'reviewed' | 'ignored' | 'confirmed') {
    await fetch(`/api/admin/fraud/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }
  return (
    <div className="flex gap-2">
      {(['reviewed', 'ignored', 'confirmed'] as const).map((status) => (
        <button
          key={status}
          type="button"
          onClick={() => setStatus(status)}
          className="h-8 border border-white/15 px-2 font-mono text-[9px] uppercase tracking-widest text-bone-dim"
        >
          {status}
        </button>
      ))}
    </div>
  );
}
