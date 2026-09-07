'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Label } from '@/components/ui';
import { ProjectLogo } from '@/components/project-logo';
import { PROJECT_CATEGORIES, type Project, type ProjectCategory } from '@/lib/types';
import { cn } from '@/lib/cn';
import { clearProjectPreview, parseProjectPreview, readProjectPreview, serverProjectPreview, subscribeProjectPreview } from '@/lib/project-preview-draft';
import { useHydrated } from '@/lib/use-hydrated';

const INPUT =
  'h-11 w-full border hairline bg-transparent px-3 text-sm text-bone placeholder:text-bone-faint';

export function ProjectForm({ project }: { project?: Project }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const formRef = useRef<HTMLFormElement>(null);
  const savedPreview = useSyncExternalStore(subscribeProjectPreview, readProjectPreview, serverProjectPreview);
  const draft = project ? null : parseProjectPreview(savedPreview);
  const [previewApplied, setPreviewApplied] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ProjectCategory>(project?.category ?? 'Other');
  const [projectName, setProjectName] = useState(project?.name ?? 'Project');
  const [logoUrl, setLogoUrl] = useState(project?.logoUrl ?? '');
  const [logoPending, setLogoPending] = useState(false);

  function applyPreview() {
    if (!draft || !formRef.current) return;
    for (const [key, value] of [['name', draft.name], ['tagline', draft.tagline]]) {
      const field = formRef.current.elements.namedItem(key);
      if (field instanceof HTMLInputElement) field.value = value;
    }
    setProjectName(draft.name);
    setPreviewApplied(true);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || logoPending) return;
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
      logoUrl,
      xUrl: String(form.get('xUrl') ?? ''),
      githubUrl: String(form.get('githubUrl') ?? ''),
    };
    const url = project ? `/api/projects/${project.id}` : '/api/projects';
    try {
      const response = await fetch(url, {
        method: project ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!response.ok) {
        setError(payload?.error ?? 'Could not save Project');
        return;
      }
      if (!project && !payload?.id) {
        setError('Could not confirm the saved Project. Please try again.');
        return;
      }
      if (previewApplied) clearProjectPreview();
      router.push(project ? `/dashboard/projects/${project.id}` : `/dashboard/projects/${payload?.id}`);
      router.refresh();
    } catch {
      setError('Could not reach Project Arena. Your details are still here. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-5">
      {draft && !previewApplied ? (
        <aside className="border border-white/30 bg-ink-900 p-5" aria-label="Saved Project preview">
          <p className="text-sm">Your preview is ready: <strong className="break-words">{draft.name}</strong></p>
          <p className="mt-2 text-xs leading-relaxed text-bone-dim">Use its name and tagline here, then review your details before publishing.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={applyPreview}>Use your preview</Button>
            <Button type="button" variant="ghost" onClick={clearProjectPreview}>Discard preview</Button>
          </div>
        </aside>
      ) : null}
      {previewApplied ? <p role="status" className="text-sm text-bone-dim">Name and tagline added. Review them and add your website to continue.</p> : null}
      <Field label="Name">
        <input
          name="name"
          required
          maxLength={60}
          defaultValue={project?.name}
          onChange={(event) => setProjectName(event.target.value || 'Project')}
          className={INPUT}
        />
      </Field>
      <Field label="Slug" hint="Optional; made from your name">
        <input name="slug" defaultValue={project?.slug} placeholder="Created from your Project name" className={cn(INPUT, 'font-mono text-[13px]')} />
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
              aria-pressed={category === item}
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
      <LogoUpload
        projectName={projectName}
        value={logoUrl}
        onChange={setLogoUrl}
        pending={logoPending}
        setPending={setLogoPending}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="X URL">
          <input name="xUrl" type="url" defaultValue={project?.xUrl ?? ''} className={cn(INPUT, 'font-mono text-[13px]')} />
        </Field>
        <Field label="GitHub URL">
          <input name="githubUrl" type="url" defaultValue={project?.githubUrl ?? ''} className={cn(INPUT, 'font-mono text-[13px]')} />
        </Field>
      </div>
      {error ? <p role="alert" className="font-mono text-[10px] uppercase tracking-widest text-arena">{error}</p> : null}
      <Button type="submit" size="lg" disabled={!hydrated || pending || logoPending} className="w-full sm:w-auto">
        {logoPending ? 'Uploading logo' : pending ? 'Saving' : project ? 'Save Project' : 'Create Project'}
      </Button>
    </form>
  );
}

function LogoUpload({
  projectName,
  value,
  onChange,
  pending,
  setPending,
}: {
  projectName: string;
  value: string;
  onChange: (value: string) => void;
  pending: boolean;
  setPending: (value: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo must be 2 MB or smaller');
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Use PNG, JPG, WebP, or GIF');
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setPending(true);
    setError(null);

    try {
      const body = new FormData();
      body.set('logo', file);
      const response = await fetch('/api/projects/logo', { method: 'POST', body });
      const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;

      if (response.ok && payload?.url) {
        onChange(payload.url);
      } else if (payload?.error === 'invalid_file') {
        setError('Logo must be 2 MB or smaller');
      } else if (payload?.error === 'unsupported_image') {
        setError('Use PNG, JPG, WebP, or GIF');
      } else if (payload?.error === 'rate_limited') {
        setError('Too many uploads. Wait a minute and try again');
      } else {
        setError('Could not upload logo');
      }
    } catch {
      setError('Could not upload logo');
    } finally {
      setPreview(null);
      URL.revokeObjectURL(localPreview);
      setPending(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const imageUrl = preview ?? value;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <Label>Project logo</Label>
        <span className="num text-[10px] text-bone-faint">PNG, JPG, WebP, GIF · 2 MB</span>
      </div>
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          if (!pending) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file && !pending) void upload(file);
        }}
        className={cn(
          'flex min-h-32 flex-col items-start gap-5 border border-dashed p-5 transition-colors sm:flex-row sm:items-center',
          dragging ? 'border-arena bg-arena/5' : 'border-white/15 bg-ink-900/40',
        )}
      >
        <ProjectLogo name={projectName} logoUrl={imageUrl || null} size="lg" />
        <div className="flex flex-1 flex-col items-start gap-2">
          <p className="text-sm text-bone-dim">Drop your logo here or choose a file.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
              {pending ? 'Uploading' : value ? 'Replace logo' : 'Choose logo'}
            </Button>
            {value ? (
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => onChange('')}>
                Remove
              </Button>
            ) : null}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          disabled={pending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>
      {error ? <p className="font-mono text-[10px] uppercase tracking-widest text-arena">{error}</p> : null}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between">
        <Label>{label}</Label>
        {hint ? <span className="num text-[10px] text-bone-faint">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}
