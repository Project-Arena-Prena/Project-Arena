import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { listAdminProjects } from '@/lib/admin-queries';
import { Container, Label, Panel } from '@/components/ui';
import { formatNumber } from '@/lib/format';

export const metadata: Metadata = { title: 'Admin Projects' };

export default async function AdminProjectsPage() {
  await requireAdmin('/admin/projects');
  const projects = await listAdminProjects();
  return (
    <Container className="py-12">
      <Label>Projects</Label>
      <h1 className="mt-3 text-4xl font-semibold tracking-headline">Directory</h1>
      <Panel className="mt-8">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/project/${project.slug}`}
            className="flex items-center justify-between border-b hairline px-5 py-4 last:border-b-0 hover:bg-white/[0.02]"
          >
            <div>
              <p className="text-sm">{project.name}</p>
              <p className="label">{project.category}</p>
            </div>
            <span className="num text-sm">{formatNumber(project.arenaRating)}</span>
          </Link>
        ))}
      </Panel>
    </Container>
  );
}
