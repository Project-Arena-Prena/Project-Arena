'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Label } from '@/components/ui';
import type { Arena } from '@/lib/types';
import { cn } from '@/lib/cn';

const INPUT = 'h-11 w-full border hairline bg-transparent px-3 text-sm text-bone';

function isoLocal(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function ArenaForm({ arena }: { arena?: Arena }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const body = {
      name: String(form.get('name')),
      slug: String(form.get('slug')),
      number: Number(form.get('number') || 0),
      description: String(form.get('description') || ''),
      category: String(form.get('category') || 'Open'),
      startsAt: new Date(String(form.get('startsAt'))).toISOString(),
      endsAt: new Date(String(form.get('endsAt'))).toISOString(),
      registrationOpensAt: form.get('registrationOpensAt')
        ? new Date(String(form.get('registrationOpensAt'))).toISOString()
        : undefined,
      registrationClosesAt: form.get('registrationClosesAt')
        ? new Date(String(form.get('registrationClosesAt'))).toISOString()
        : undefined,
      maxEntries: Number(form.get('maxEntries') || 32),
      entryPrice: Math.round(Number(form.get('entryPrice') || 0) * 100),
      eligibilityText: String(form.get('eligibilityText') || ''),
      status: arena ? undefined : 'draft',
    };
    const response = await fetch(arena ? `/api/admin/arenas/${arena.id}` : '/api/admin/arenas', {
      method: arena ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(payload?.error ?? 'Save failed');
      return;
    }
    router.push(arena ? `/admin/arenas/${arena.id}` : `/admin/arenas/${payload.id}`);
    router.refresh();
  }

  async function run(action: string) {
    if (!arena) return;
    setPending(true);
    await fetch(`/api/admin/arenas/${arena.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Field label="Name">
        <input name="name" required defaultValue={arena?.name} className={INPUT} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Slug">
          <input name="slug" required defaultValue={arena?.slug} className={cn(INPUT, 'font-mono text-[13px]')} />
        </Field>
        <Field label="Number">
          <input name="number" type="number" defaultValue={arena?.number ?? 0} className={INPUT} />
        </Field>
      </div>
      <Field label="Category">
        <input name="category" defaultValue={arena?.category ?? 'Open'} className={INPUT} />
      </Field>
      <Field label="Description">
        <textarea name="description" rows={3} defaultValue={arena?.theme} className={cn(INPUT, 'h-auto py-3')} />
      </Field>
      <Field label="Eligibility">
        <textarea name="eligibilityText" rows={3} defaultValue={arena?.eligibilityText} className={cn(INPUT, 'h-auto py-3')} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Starts (UTC)">
          <input name="startsAt" type="datetime-local" required defaultValue={isoLocal(arena?.startsAt)} className={INPUT} />
        </Field>
        <Field label="Ends (UTC)">
          <input name="endsAt" type="datetime-local" required defaultValue={isoLocal(arena?.endsAt)} className={INPUT} />
        </Field>
        <Field label="Registration opens">
          <input name="registrationOpensAt" type="datetime-local" defaultValue={isoLocal(arena?.registrationOpensAt)} className={INPUT} />
        </Field>
        <Field label="Registration closes">
          <input name="registrationClosesAt" type="datetime-local" defaultValue={isoLocal(arena?.registrationClosesAt)} className={INPUT} />
        </Field>
        <Field label="Capacity">
          <input name="maxEntries" type="number" defaultValue={arena?.entrantCap ?? 32} className={INPUT} />
        </Field>
        <Field label="Entry price (USD)">
          <input
            name="entryPrice"
            type="number"
            step="1"
            defaultValue={arena ? Math.round(arena.entryFeeCents / 100) : 29}
            className={INPUT}
          />
        </Field>
      </div>
      {error ? <p className="font-mono text-[10px] uppercase tracking-widest text-arena">{error}</p> : null}
      <Button type="submit" disabled={pending} size="lg">
        {pending ? 'Saving' : 'Save Arena'}
      </Button>
      {arena ? (
        <div className="flex flex-wrap gap-2 pt-4">
          {[
            ['open_registration', 'Open registration'],
            ['close_registration', 'Close registration'],
            ['start', 'Start Arena'],
            ['go_live_now', 'Go live now'],
            ['end', 'End Arena'],
            ['finish_now', 'Finish now'],
            ['cancel', 'Cancel Arena'],
            ['duplicate', 'Duplicate'],
          ].map(([action, label]) => (
            <button
              key={action}
              type="button"
              disabled={pending}
              onClick={() => run(action)}
              className="h-8 border border-white/15 px-3 font-mono text-[10px] uppercase tracking-widest text-bone-dim hover:text-bone"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
