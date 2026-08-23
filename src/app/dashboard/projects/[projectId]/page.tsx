import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireBuilder, builderOwnsProject } from '@/lib/auth';
import { getBuilderEntries, getOwnedProject } from '@/lib/builder-queries';
import { ButtonLink, Container, EmptyState, Label, Panel, StatusBadge } from '@/components/ui';
import { ProjectForm } from '@/components/dashboard/project-form';
import { formatNumber, formatRank } from '@/lib/format';

export const metadata: Metadata = { title: 'Edit Project' };

export default async function ProjectEditPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await requireBuilder(`/dashboard/projects/${projectId}`);
  if (!(await builderOwnsProject(ctx.builder.id, projectId)) && !ctx.isAdmin) notFound();
  const project = await getOwnedProject(ctx.builder.id, projectId);
  if (!project) notFound();
  const entries = (await getBuilderEntries(ctx.builder.id)).filter((item) => item.project.id === projectId);

  return (
    <Container className="py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Label>Project</Label>
          <h1 className="mt-3 text-4xl font-semibold tracking-headline">{project.name}</h1>
          <p className="mt-2 num text-sm text-bone-dim">Arena Rating {formatNumber(project.arenaRating)}</p>
        </div>
        <ButtonLink href={`/project/${project.slug}`} variant="secondary">
          Public profile
        </ButtonLink>
      </div>

      <div className="mt-10 max-w-2xl">
        <ProjectForm project={project} />
      </div>

      <div className="mt-16">
        <Label>Arena history</Label>
        <h2 className="mt-2 text-2xl font-semibold tracking-headline">Entries</h2>
        {entries.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="No Arenas yet" hint="Enter this Project in an Arena to start a record." />
          </div>
        ) : (
          <Panel className="mt-6">
            {entries.map((item) => (
              <div key={item.entry.id} className="flex flex-wrap items-center justify-between gap-4 border-b hairline px-5 py-4 last:border-b-0">
                <div>
                  <p className="text-sm">{item.arena.name}</p>
                  <div className="mt-2">
                    <StatusBadge status={item.entry.status} />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {item.entry.finalRank || item.entry.currentRank ? (
                    <span className="num text-sm">
                      #{formatRank(item.entry.finalRank ?? item.entry.currentRank ?? 0)}
                    </span>
                  ) : null}
                  <ButtonLink
                    href={`/dashboard/projects/${projectId}/arenas/${item.arena.id}`}
                    variant="secondary"
                    size="sm"
                  >
                    Performance
                  </ButtonLink>
                </div>
              </div>
            ))}
          </Panel>
        )}
      </div>
    </Container>
  );
}
