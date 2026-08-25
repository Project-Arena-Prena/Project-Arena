import type { Metadata } from 'next';
import { AlertCircle } from 'lucide-react';
import { redirect } from 'next/navigation';
import { EntryFlow } from './entry-flow';
import { Container, Label } from '@/components/ui';
import { getSessionUser } from '@/lib/supabase/server';
import { getBuilder } from '@/lib/auth';
import { getOwnedProjects } from '@/lib/builder-queries';
import { getArenas } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Enter',
  description: 'Select a Project, pay the entry, and wait for review. Rank is never for sale.',
};

export default async function EnterPage({
  searchParams,
}: {
  searchParams: Promise<{ arena?: string; project?: string; canceled?: string }>;
}) {
  const user = await getSessionUser();
  const { arena, project, canceled } = await searchParams;
  if (!user) {
    const next = `/enter${arena ? `?arena=${arena}` : ''}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const ctx = await getBuilder();
  const owned = ctx ? await getOwnedProjects(ctx.builder.id) : [];
  const { live, upcoming } = await getArenas();
  const selectable = [...upcoming.filter((item) => item.status === 'registration'), ...live.filter((item) => item.status === 'registration')];

  return (
    <div className="pb-20">
      <Container className="grid gap-12 py-12 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-20 lg:py-20">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <Label className="text-arena">Builder entry</Label>
          <h1 className="mt-5 text-[clamp(3.5rem,7vw,5.8rem)] font-semibold uppercase leading-[0.82] tracking-[-0.075em]">
            Enter the Arena
          </h1>
          <p className="mt-7 max-w-sm text-sm leading-relaxed text-bone-dim sm:text-base">
            Put your Project in front of people looking for something worth discovering.
          </p>
          <div className="mt-8 border-y border-white/30 py-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-bone-faint">
              Entry buys a place on the grid
            </p>
            <p className="mt-2 text-xs leading-relaxed text-bone-dim">
              Payment never buys rank, support, or Champion status. Results are earned live.
            </p>
          </div>
          {canceled ? (
            <div className="mt-5 flex items-start gap-2.5 border border-arena/40 bg-arena/[0.06] px-3 py-3">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-arena" />
              <p className="font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-bone-dim">
                Payment not completed. Your Arena spot has not been confirmed.
              </p>
            </div>
          ) : null}
        </aside>

        <div className="min-w-0">
          <EntryFlow
            arenas={selectable}
            projects={owned.map((item) => item.project)}
            initialArenaSlug={arena}
            initialProjectId={project}
          />
        </div>
      </Container>
    </div>
  );
}
