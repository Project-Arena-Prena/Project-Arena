'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui';
import { saveProjectPreview } from '@/lib/project-preview-draft';
import { useHydrated } from '@/lib/use-hydrated';

export function ProjectPreview() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [error, setError] = useState(false);
  const [navigating, startTransition] = useTransition();
  function proceed(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saveProjectPreview(name, tagline)) { setError(true); return; }
    startTransition(() => router.push('/dashboard/projects/new'));
  }
  return (
    <section id="project-preview" className="project-preview" aria-labelledby="preview-title">
      <div data-reveal="rise">
        <p className="founding-eyebrow">Your work / In view</p>
        <h2 id="preview-title" className="statement mt-6">See your Project<br /><em>on the stage.</em></h2>
        <p className="founding-copy mt-6">Try your name and tagline. No account needed to preview.</p>
        <noscript><p className="mt-4 text-sm text-bone-dim">Enable JavaScript for the live preview, or <a className="underline" href="/dashboard/projects/new">create your Project</a>.</p><style>{'.project-preview form { display:none; }'}</style></noscript>
        <form onSubmit={proceed} aria-busy={navigating} className="mt-8 flex flex-col gap-5">
          <label className="preview-field">Project name
            <input name="preview-name" disabled={!hydrated} required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" placeholder="What did you build?" />
          </label>
          <label className="preview-field">One-line description
            <input name="preview-tagline" disabled={!hydrated} required maxLength={140} value={tagline} onChange={(event) => setTagline(event.target.value)} autoComplete="off" placeholder="What can people do with it?" />
          </label>
          {error ? <p role="alert" className="text-sm text-bone-dim">This browser could not save your preview. Allow site storage and try again. Your text is still here.</p> : null}
          <Button type="submit" size="lg" disabled={!hydrated || navigating} className="self-start">{navigating ? 'Continuing' : 'Continue with this Project'} <ArrowUpRight size={16} /></Button>
          <p className="text-xs leading-relaxed text-bone-faint">Your preview is kept in this browser for 24 hours so you can review it after sign-in.</p>
        </form>
      </div>
      <div className="preview-stage" data-reveal="depth">
        <svg className="preview-arch" viewBox="0 0 360 440" fill="none" aria-hidden="true"><path d="M20 440V180a160 160 0 01320 0v260M44 440V180a136 136 0 01272 0v260" stroke="currentColor" /></svg>
        <div className="preview-card">
          <p className="founding-eyebrow">Project preview</p>
          <div className="preview-monogram" aria-hidden="true">{name.trim().slice(0, 1).toUpperCase() || 'P'}</div>
          <h3>{name.trim() || 'Your Project'}</h3>
          <p>{tagline.trim() || 'Your work, in your words.'}</p>
          <span className="preview-card-rule" aria-hidden="true" />
          <p className="preview-disclosure">Preview only. Your Project is published after you save it.</p>
        </div>
      </div>
    </section>
  );
}
