import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { Container, Label } from '@/components/ui';
import { ArenaForm } from '@/components/admin/arena-form';

export const metadata: Metadata = { title: 'Create Arena' };

export default async function NewArenaPage() {
  await requireAdmin('/admin/arenas/new');
  return (
    <Container className="py-12">
      <Label>New Arena</Label>
      <h1 className="mt-3 text-4xl font-semibold tracking-headline">Create Arena</h1>
      <div className="mt-10 max-w-2xl">
        <ArenaForm />
      </div>
    </Container>
  );
}
