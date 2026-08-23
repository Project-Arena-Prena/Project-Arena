import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { runClock } from '@/lib/arena-clock';
import { createAdminClient } from '@/lib/supabase/server';
import { Container, Label, Panel } from '@/components/ui';
import { DryRunButton } from '@/components/admin/dry-run-button';
import { formatNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Arena clock dry-run' };

export default async function AdminDryRunPage() {
  await requireAdmin('/admin/dry-run');
  const preview = runClock();
  const db = Boolean(createAdminClient());

  return (
    <Container className="py-12">
      <Label>Operations</Label>
      <h1 className="mt-3 text-4xl font-semibold tracking-headline">Arena clock dry-run</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-bone-dim">
        Prove the full competition clock without waiting on real dates: draft → registration → live →
        finished, freeze ranks, assign Champion, move Arena Rating. Money is not involved.
      </p>

      <Panel className="mt-8 p-6">
        <Label>In-process clock</Label>
        <p className="mt-3 font-mono text-xs uppercase tracking-widest text-bone-dim">
          {preview.phases.join(' → ')}
        </p>
        <p className="mt-4 text-sm">
          Champion {preview.champion.project} · #{String(preview.champion.rank).padStart(2, '0')} · +
          {preview.champion.ratingChange} rating
        </p>
        <div className="mt-6 border-t hairline pt-4">
          {preview.results.map((row) => (
            <div key={row.project} className="flex items-center justify-between py-2">
              <span className="text-sm">
                #{String(row.rank).padStart(2, '0')} {row.project}
              </span>
              <span className="num text-sm text-bone-dim">
                {formatNumber(row.score)} pts · {row.ratingChange > 0 ? '+' : ''}
                {row.ratingChange}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-8">
        <DryRunButton database={db} />
        <p className="mt-4 max-w-xl text-xs leading-relaxed text-bone-faint">
          {db
            ? 'This will create an unlisted DRY RUN Arena, three dummy Projects, score them, freeze the board, and write Arena Rating history.'
            : 'Supabase is not configured in this environment. The in-process clock still runs. After schema.sql is applied, this button will execute the same sequence against the database.'}
        </p>
      </div>
    </Container>
  );
}
