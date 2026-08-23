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
      <section className="border-b hairline">
        <Container className="flex flex-col gap-5 py-10 sm:py-14">
          <Label>Enter</Label>
          <h1 className="max-w-3xl text-[34px] font-semibold leading-[0.95] tracking-headline sm:text-5xl">
            Enter the Arena
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-bone-dim sm:text-base">
            Money buys a slot and a chance to be seen. It does not buy rank, votes, or Champion.
          </p>
          {canceled ? (
            <div className="flex items-center gap-2.5 border border-arena/30 bg-arena/[0.06] px-3 py-2.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-arena" />
              <p className="font-mono text-[10px] uppercase tracking-widest text-bone-dim">
                Payment not completed. Your Arena spot has not been confirmed.
              </p>
            </div>
          ) : null}
        </Container>
      </section>
      <Container className="py-10">
        <EntryFlow
          arenas={selectable}
          projects={owned.map((item) => item.project)}
          initialArenaSlug={arena}
          initialProjectId={project}
        />
      </Container>
    </div>
  );
}
