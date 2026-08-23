import type { Metadata } from 'next';
import { requireBuilder } from '@/lib/auth';
import { Container, Label } from '@/components/ui';
import { ProjectForm } from '@/components/dashboard/project-form';

export const metadata: Metadata = { title: 'Create Project' };

export default async function NewProjectPage() {
  await requireBuilder('/dashboard/projects/new');
  return (
    <Container className="py-12">
      <Label>New Project</Label>
      <h1 className="mt-4 text-4xl font-semibold tracking-headline">Create your Project</h1>
      <div className="mt-10 max-w-2xl">
        <ProjectForm />
      </div>
    </Container>
  );
}
