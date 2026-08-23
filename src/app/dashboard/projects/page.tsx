import type { Metadata } from 'next';
import Link from 'next/link';
import { requireBuilder } from '@/lib/auth';
import { getOwnedProjects } from '@/lib/builder-queries';
import { ButtonLink, Container, EmptyState, Label, Panel, SectionHeader } from '@/components/ui';
import { formatNumber } from '@/lib/format';

export const metadata: Metadata = { title: 'Projects' };

export default async function ProjectsPage() {
  const ctx = await requireBuilder('/dashboard/projects');
  const owned = await getOwnedProjects(ctx.builder.id);

  return (
    <>
      <section className="border-b hairline">
        <Container className="flex flex-col gap-6 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Label>Projects</Label>
            <h1 className="mt-4 text-4xl font-semibold tracking-headline">Manage Projects</h1>
          </div>
          <ButtonLink href="/dashboard/projects/new">Create Project</ButtonLink>
        </Container>
      </section>
      <Container className="pt-10">
        <SectionHeader title="Roster" />
        {owned.length === 0 ? (
          <EmptyState title="You haven't created a project yet" hint="Create a Project, then enter an Arena." />
        ) : (
          <Panel>
            {owned.map(({ project }) => (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="flex items-center justify-between gap-4 border-b hairline px-5 py-4 last:border-b-0 hover:bg-white/[0.025]"
              >
                <div>
                  <p className="text-[15px] font-medium">{project.name}</p>
                  <p className="text-xs text-bone-faint">{project.tagline}</p>
                </div>
                <span className="num text-sm text-bone-dim">{formatNumber(project.arenaRating)}</span>
              </Link>
            ))}
          </Panel>
        )}
      </Container>
    </>
  );
}
