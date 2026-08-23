'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Label } from '@/components/ui';
import { PROJECT_CATEGORIES, type Project, type ProjectCategory } from '@/lib/types';
import { cn } from '@/lib/cn';

const INPUT =
  'h-11 w-full border hairline bg-transparent px-3 text-sm text-bone placeholder:text-bone-faint';

export function ProjectForm({ project }: { project?: Project }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ProjectCategory>(project?.category ?? 'Other');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const body = {
      name: String(form.get('name') ?? ''),
      slug: String(form.get('slug') ?? '') || undefined,
      tagline: String(form.get('tagline') ?? ''),
      description: String(form.get('description') ?? ''),
      websiteUrl: String(form.get('websiteUrl') ?? ''),
      category,
      logoUrl: String(form.get('logoUrl') ?? ''),
      xUrl: String(form.get('xUrl') ?? ''),
      githubUrl: String(form.get('githubUrl') ?? ''),
    };
    const url = project ? `/api/projects/${project.id}` : '/api/projects';
    const response = await fetch(url, {
      method: project ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(payload?.error ?? 'Could not save Project');
      return;
    }
    router.push(project ? `/dashboard/projects/${project.id}` : `/dashboard/projects/${payload?.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Field label="Name">
        <input name="name" required maxLength={60} defaultValue={project?.name} className={INPUT} />
      </Field>
      <Field label="Slug" hint="Unique URL">
        <input name="slug" defaultValue={project?.slug} className={cn(INPUT, 'font-mono text-[13px]')} />
      </Field>
      <Field label="Tagline">
        <input name="tagline" required maxLength={140} defaultValue={project?.tagline} className={INPUT} />
      </Field>
      <Field label="Description">
        <textarea
          name="description"
          maxLength={1200}
          rows={4}
          defaultValue={project?.description}
          className={cn(INPUT, 'h-auto py-3')}
        />
      </Field>
      <Field label="Website">
        <input name="websiteUrl" required type="url" defaultValue={project?.url} className={cn(INPUT, 'font-mono text-[13px]')} />
      </Field>
      <div className="flex flex-col gap-2">
        <Label>Category</Label>
        <div className="flex flex-wrap gap-2">
          {PROJECT_CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={cn(
                'h-8 border px-3 font-mono text-[10px] uppercase tracking-widest',
                category === item ? 'border-arena/50 bg-arena/10 text-arena' : 'border-white/15 text-bone-dim',
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <Field label="Logo URL">
        <input name="logoUrl" type="url" defaultValue={project?.logoUrl ?? ''} className={cn(INPUT, 'font-mono text-[13px]')} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="X URL">
          <input name="xUrl" type="url" defaultValue={project?.xUrl ?? ''} className={cn(INPUT, 'font-mono text-[13px]')} />
        </Field>
        <Field label="GitHub URL">
          <input name="githubUrl" type="url" defaultValue={project?.githubUrl ?? ''} className={cn(INPUT, 'font-mono text-[13px]')} />
        </Field>
      </div>
      {error ? <p className="font-mono text-[10px] uppercase tracking-widest text-arena">{error}</p> : null}
      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? 'Saving' : project ? 'Save Project' : 'Create Project'}
      </Button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        {hint ? <span className="num text-[10px] text-bone-faint">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
