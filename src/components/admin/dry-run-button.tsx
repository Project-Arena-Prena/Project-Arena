'use client';

import { useState } from 'react';
import { Button, Panel } from '@/components/ui';

interface Report {
  ok?: boolean;
  database?: boolean;
  hint?: string;
  error?: string;
  clock?: { phases: string[]; champion: string };
  arena?: {
    arenaSlug: string;
    phases: string[];
    champion: string;
    frozen: boolean;
    field: Array<{ name: string; rank: number; score: number; ratingChange: number | null }>;
  };
}

export function DryRunButton({ database }: { database: boolean }) {
  const [pending, setPending] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  async function run() {
    setPending(true);
    setReport(null);
    const response = await fetch('/api/admin/dry-run', { method: 'POST' });
    const payload = (await response.json().catch(() => null)) as Report | null;
    setReport(payload ?? { error: 'no_response' });
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Button type="button" size="lg" disabled={pending} onClick={run} className="w-full sm:w-auto">
        {pending ? 'Running clock' : database ? 'Run database clock' : 'Run in-process clock'}
      </Button>
      {report ? (
        <Panel className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest">
            {report.ok !== false ? 'Clock passed' : 'Clock failed'}
          </p>
          {report.error ? (
            <p className="mt-3 text-sm text-arena">{report.error}</p>
          ) : null}
          {report.hint ? <p className="mt-3 text-sm text-bone-dim">{report.hint}</p> : null}
          {report.arena ? (
            <div className="mt-4 text-sm text-bone-dim">
              <p>
                {report.arena.arenaSlug} · {report.arena.phases.join(' → ')} · Champion {report.arena.champion}
              </p>
              <ul className="mt-3 flex flex-col gap-1">
                {report.arena.field.map((row) => (
                  <li key={row.name} className="num">
                    #{String(row.rank).padStart(2, '0')} {row.name} · {row.score} pts ·{' '}
                    {row.ratingChange == null ? '—' : `${row.ratingChange > 0 ? '+' : ''}${row.ratingChange}`}
                  </li>
                ))}
              </ul>
            </div>
          ) : report.clock ? (
            <p className="mt-3 text-sm text-bone-dim">
              {report.clock.phases.join(' → ')} · Champion {report.clock.champion}
            </p>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}
