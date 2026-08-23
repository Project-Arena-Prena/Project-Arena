'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Countdown } from '@/components/countdown';
import { Button, ButtonLink, EmptyState, Label, Panel, StatusBadge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import type { Arena, Project } from '@/lib/types';

const API_ERRORS: Record<string, string> = {
  arena_full: 'That Arena is full.',
  arena_closed: 'That Arena is not open for entry.',
  already_entered: 'That Project is already entered.',
  auth_required: 'Sign in to enter.',
  forbidden: 'You do not own that Project.',
};

export function EntryFlow({
  arenas,
  projects,
  initialArenaSlug,
  initialProjectId,
}: {
  arenas: Arena[];
  projects: Project[];
  initialArenaSlug?: string;
  initialProjectId?: string;
}) {
  const router = useRouter();
  const [arenaSlug, setArenaSlug] = useState(
    arenas.find((arena) => arena.slug === initialArenaSlug)?.slug ?? arenas[0]?.slug ?? '',
  );
  const [projectId, setProjectId] = useState(
    projects.find((project) => project.id === initialProjectId)?.id ?? projects[0]?.id ?? '',
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => arenas.find((arena) => arena.slug === arenaSlug) ?? null, [arenas, arenaSlug]);
  const project = projects.find((item) => item.id === projectId) ?? null;
  const full = selected ? selected.entrantCount >= selected.entrantCap : true;

  if (arenas.length === 0) {
    return <EmptyState title="No Arenas open yet" hint="The next competition is being prepared." />;
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-6">
        <EmptyState
          title="You haven't created a project yet"
          hint="Create a Project first, then come back to enter."
        />
        <ButtonLink href="/dashboard/projects/new">Create Project</ButtonLink>
      </div>
    );
  }

  async function continueToPayment() {
    if (!selected || !projectId || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arenaSlug: selected.slug, projectId }),
      });
      const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || !payload?.url) {
        setError((payload?.error && API_ERRORS[payload.error]) || 'Checkout failed. Try again.');
        setPending(false);
        return;
      }
      window.location.href = payload.url;
    } catch {
      setError('Network error. Your spot was not confirmed.');
      setPending(false);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-10">
        <section className="flex flex-col gap-4">
          <Label>Select Project</Label>
          <div className="border hairline">
            {projects.map((item) => {
              const active = item.id === projectId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setProjectId(item.id)}
                  className={cn(
                    'flex w-full items-center justify-between px-4 py-3.5 text-left',
                    active ? 'bg-arena/[0.06]' : 'hover:bg-white/[0.03]',
                  )}
                >
                  <span>
                    <span className="block text-sm">{item.name}</span>
                    <span className="label">{item.category}</span>
                  </span>
                  <span className={cn('h-3 w-3 border', active ? 'border-arena bg-arena' : 'border-white/30')} />
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => router.push('/dashboard/projects/new')}
              className="w-full border-t hairline px-4 py-3.5 text-left font-mono text-[10px] uppercase tracking-widest text-bone-dim hover:text-bone"
            >
              Create new Project
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <Label>Arena</Label>
          <div className="border hairline">
            {arenas.map((arena) => {
              const active = arena.slug === arenaSlug;
              const atCap = arena.entrantCount >= arena.entrantCap;
              return (
                <button
                  key={arena.slug}
                  type="button"
                  disabled={atCap}
                  onClick={() => setArenaSlug(arena.slug)}
                  className={cn(
                    'flex w-full flex-col gap-1 px-4 py-3.5 text-left sm:flex-row sm:items-center sm:justify-between',
                    active ? 'bg-arena/[0.06]' : 'hover:bg-white/[0.03]',
                    atCap && 'opacity-40',
                  )}
                >
                  <span className="text-sm">{arena.name}</span>
                  <span className="num text-[11px] text-bone-faint">
                    {arena.entrantCount} / {arena.entrantCap}
                    {atCap ? ' · Full' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {error ? (
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-arena">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </p>
        ) : null}

        <Button
          type="button"
          size="lg"
          disabled={pending || !selected || full}
          onClick={continueToPayment}
          className="w-full sm:w-auto"
        >
          {pending ? 'Reserving' : full ? 'Arena full' : 'Continue to payment'}
        </Button>
      </div>

      <div className="lg:sticky lg:top-24">
        {selected ? (
          <Panel>
            <div className="flex items-center justify-between border-b hairline px-4 py-3">
              <Label>Entry</Label>
              <StatusBadge status={selected.status} />
            </div>
            <div className="px-4 py-4">
              <h2 className="text-xl font-semibold tracking-headline">{selected.name}</h2>
              <p className="mt-2 text-xs text-bone-dim">{selected.theme}</p>
              {selected.eligibilityText ? (
                <p className="mt-3 text-xs text-bone-faint">{selected.eligibilityText}</p>
              ) : null}
            </div>
            <div className="border-t hairline px-4 py-3">
              <div className="flex justify-between">
                <Label>Starts</Label>
                <span className="num text-xs">{formatDate(selected.startsAt)}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <Label>Ends</Label>
                <span className="num text-xs">{formatDate(selected.endsAt)}</span>
              </div>
            </div>
            <div className="flex justify-between border-t hairline px-4 py-3">
              <Label>Entry</Label>
              <span className="num text-sm">
                {selected.entryFeeCents === 0 ? 'Free' : formatMoney(selected.entryFeeCents)}
              </span>
            </div>
            <div className="flex justify-between border-t hairline px-4 py-3">
              <Label>Spots filled</Label>
              <span className="num text-sm">
                {formatNumber(selected.entrantCount)} / {selected.entrantCap}
              </span>
            </div>
            <div className="px-4 py-4">
              <Label>Starts in</Label>
              <div className="mt-2">
                <Countdown target={selected.startsAt} size="sm" showDays />
              </div>
            </div>
            {project ? (
              <div className="border-t hairline px-4 py-3">
                <Label>Project</Label>
                <p className="mt-2 text-sm">{project.name}</p>
              </div>
            ) : null}
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
