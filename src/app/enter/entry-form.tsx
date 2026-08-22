'use client';

import { useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { Countdown } from '@/components/countdown';
import { Button, EmptyState, Label, Panel, Rule, StatusBadge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatMoney, formatNumber } from '@/lib/format';
import { PROJECT_CATEGORIES } from '@/lib/types';
import type { Arena, ProjectCategory } from '@/lib/types';

const TAGLINE_MAX = 140;
const DESCRIPTION_MAX = 1200;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const API_ERRORS: Record<string, string> = {
  invalid_body: 'Entry rejected. Check the fields above.',
  arena_not_found: 'That Arena no longer exists.',
  arena_ended: 'That Arena has ended. Pick another.',
  arena_full: 'That Arena is full. Pick another.',
};

const INPUT =
  'h-11 w-full border hairline bg-transparent px-3 text-sm text-bone placeholder:text-bone-faint transition-colors duration-200 focus:border-arena/50 focus-visible:ring-arena/70 focus-visible:ring-offset-0';

type FieldKey = 'arenaSlug' | 'projectName' | 'url' | 'tagline' | 'category' | 'builderEmail' | 'xUrl' | 'githubUrl';
type Errors = Partial<Record<FieldKey, string>>;

function slotsLeft(arena: Arena): number {
  return Math.max(0, arena.entrantCap - arena.entrantCount);
}

function feeLabel(arena: Arena): string {
  return arena.entryFeeCents === 0 ? 'Free' : formatMoney(arena.entryFeeCents);
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function pickInitialSlug(arenas: Arena[], preferred?: string): string {
  const wanted = arenas.find((a) => a.slug === preferred && slotsLeft(a) > 0);
  const open = arenas.find((a) => slotsLeft(a) > 0);
  return wanted?.slug ?? open?.slug ?? arenas[0]?.slug ?? '';
}

function SectionRule({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="num text-[10px] tracking-widest text-arena">{index}</span>
      <Label className="text-bone-dim">{title}</Label>
      <Rule className="flex-1" />
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="label">
          {label}
        </label>
        {hint}
      </div>
      {children}
      {error ? (
        <p className="font-mono text-[10px] uppercase tracking-widest text-arena">{error}</p>
      ) : null}
    </div>
  );
}

function EntryBrief({ arena }: { arena: Arena | null }) {
  if (!arena) {
    return (
      <Panel className="p-4">
        <Label>Entry Brief</Label>
        <p className="mt-3 text-sm text-bone-dim">Select an Arena to see the brief.</p>
      </Panel>
    );
  }

  const left = slotsLeft(arena);
  const isLive = arena.status === 'live';

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3 border-b hairline px-4 py-3">
        <Label>Entry Brief</Label>
        <StatusBadge status={arena.status} />
      </div>

      <div className="flex flex-col gap-2 px-4 py-4">
        {arena.number > 0 ? <Label>Arena #{arena.number.toString().padStart(3, '0')}</Label> : null}
        <h2 className="text-xl font-semibold leading-tight tracking-headline">{arena.name}</h2>
        <p className="text-xs leading-relaxed text-bone-dim">{arena.theme}</p>
      </div>

      <div className="border-t hairline">
        <div className="flex items-baseline justify-between gap-4 border-b hairline px-4 py-3">
          <Label>Entry Fee</Label>
          <span className="num text-sm text-bone">{feeLabel(arena).toUpperCase()}</span>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-b hairline px-4 py-3">
          <Label>Slots Left</Label>
          <span className="flex items-baseline gap-1.5">
            <span className={cn('num text-sm', left === 0 || left <= 5 ? 'text-arena' : 'text-bone')}>
              {formatNumber(left)}
            </span>
            <span className="num text-[10px] text-bone-faint">of {arena.entrantCap}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 py-4">
        <Label>{isLive ? 'Ends In' : 'Starts In'}</Label>
        <Countdown target={isLive ? arena.endsAt : arena.startsAt} size="sm" showDays />
      </div>

      <div className="border-t hairline px-4 py-3">
        <Label>Champion Takes</Label>
        <p className="mt-2 text-xs leading-relaxed text-bone-dim">{arena.prize}</p>
      </div>
    </Panel>
  );
}

export function EntryForm({ arenas, initialArenaSlug }: { arenas: Arena[]; initialArenaSlug?: string }) {
  const uid = useId();
  const [arenaSlug, setArenaSlug] = useState(() => pickInitialSlug(arenas, initialArenaSlug));
  const [projectName, setProjectName] = useState('');
  const [url, setUrl] = useState('');
  const [tagline, setTagline] = useState('');
  const [category, setCategory] = useState<ProjectCategory | ''>('');
  const [description, setDescription] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [xUrl, setXUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [builderEmail, setBuilderEmail] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (arenas.length === 0) {
    return <EmptyState title="No open Arenas" hint="Entries reopen when the next Arena is scheduled." />;
  }

  const selected = arenas.find((a) => a.slug === arenaSlug) ?? null;

  function clear(key: FieldKey) {
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
    setFormError(null);
  }

  function validate(): Errors {
    const next: Errors = {};
    if (!arenaSlug) next.arenaSlug = 'Select an Arena';
    if (!projectName.trim()) next.projectName = 'Project name required';
    if (!url.trim()) next.url = 'URL required';
    else if (!isHttpUrl(url)) next.url = 'Must be a full http(s) URL';
    if (!tagline.trim()) next.tagline = 'Tagline required';
    else if (tagline.trim().length > TAGLINE_MAX) next.tagline = `Max ${TAGLINE_MAX} characters`;
    if (!category) next.category = 'Pick one category';
    if (!builderEmail.trim()) next.builderEmail = 'Email required';
    else if (!EMAIL_RE.test(builderEmail.trim())) next.builderEmail = 'Enter a valid email';
    if (xUrl.trim() && !isHttpUrl(xUrl)) next.xUrl = 'Must be a full http(s) URL';
    if (githubUrl.trim() && !isHttpUrl(githubUrl)) next.githubUrl = 'Must be a full http(s) URL';
    return next;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const next = validate();
    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      setFormError('Entry incomplete.');
      return;
    }

    setFormError(null);
    setPending(true);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arenaSlug,
          projectName: projectName.trim(),
          tagline: tagline.trim(),
          url: url.trim(),
          category,
          description: description.trim() || undefined,
          logoName: logoFile?.name,
          xUrl: xUrl.trim() || undefined,
          githubUrl: githubUrl.trim() || undefined,
          builderEmail: builderEmail.trim(),
        }),
      });

      const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;

      if (!response.ok || !payload?.url) {
        const code = payload?.error;
        setFormError((code && API_ERRORS[code]) || 'Entry failed. Try again.');
        setPending(false);
        return;
      }

      window.location.href = payload.url;
    } catch {
      setFormError('Network error. Your project was not entered.');
      setPending(false);
    }
  }

  const submitLabel = pending
    ? 'Processing'
    : selected && selected.entryFeeCents > 0
      ? `Enter — ${formatMoney(selected.entryFeeCents)}`
      : 'Enter Arena';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14"
    >
      <form onSubmit={onSubmit} noValidate className="flex min-w-0 flex-col gap-10">
        <div className="flex flex-col gap-4">
          <SectionRule index="01" title="Arena" />
          <div className="border hairline">
            {arenas.map((arena, index) => {
              const left = slotsLeft(arena);
              const full = left === 0;
              const isSelected = arena.slug === arenaSlug;
              return (
                <button
                  key={arena.slug}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={full}
                  onClick={() => {
                    setArenaSlug(arena.slug);
                    clear('arenaSlug');
                  }}
                  className={cn(
                    'relative flex w-full flex-col gap-2 px-4 py-3.5 text-left transition-colors duration-200 sm:flex-row sm:items-center sm:justify-between sm:gap-4',
                    index > 0 && 'border-t hairline',
                    isSelected ? 'bg-arena/[0.06]' : 'hover:bg-white/[0.03]',
                    full && 'cursor-not-allowed opacity-40 hover:bg-transparent',
                  )}
                >
                  {isSelected ? (
                    <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-arena" />
                  ) : null}
                  <span className="flex min-w-0 items-center gap-3">
                    <StatusBadge status={arena.status} />
                    <span className="truncate text-sm text-bone">{arena.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-5">
                    <span className="num text-[11px] text-bone-dim">{feeLabel(arena).toUpperCase()}</span>
                    <span className={cn('num text-[11px]', full ? 'text-arena' : 'text-bone-faint')}>
                      {full ? 'Full' : `${left} Slots`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {errors.arenaSlug ? (
            <p className="font-mono text-[10px] uppercase tracking-widest text-arena">{errors.arenaSlug}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          <SectionRule index="02" title="Project" />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id={`${uid}-name`} label="Project Name" error={errors.projectName}>
              <input
                id={`${uid}-name`}
                value={projectName}
                onChange={(e) => {
                  setProjectName(e.target.value);
                  clear('projectName');
                }}
                maxLength={60}
                placeholder="Drift"
                autoComplete="off"
                className={cn(INPUT, errors.projectName && 'border-arena/50')}
              />
            </Field>

            <Field id={`${uid}-url`} label="URL" error={errors.url}>
              <input
                id={`${uid}-url`}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  clear('url');
                }}
                inputMode="url"
                maxLength={300}
                placeholder="https://"
                autoComplete="off"
                className={cn(INPUT, 'font-mono text-[13px]', errors.url && 'border-arena/50')}
              />
            </Field>
          </div>

          <Field
            id={`${uid}-tagline`}
            label="Tagline"
            error={errors.tagline}
            hint={
              <span
                className={cn(
                  'num text-[10px]',
                  tagline.length >= TAGLINE_MAX ? 'text-arena' : 'text-bone-faint',
                )}
              >
                {tagline.length}/{TAGLINE_MAX}
              </span>
            }
          >
            <input
              id={`${uid}-tagline`}
              value={tagline}
              onChange={(e) => {
                setTagline(e.target.value);
                clear('tagline');
              }}
              maxLength={TAGLINE_MAX}
              placeholder="One line. What it does, who it is for."
              autoComplete="off"
              className={cn(INPUT, errors.tagline && 'border-arena/50')}
            />
          </Field>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <Label>Category</Label>
              <span className="num text-[10px] text-bone-faint">Select one</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PROJECT_CATEGORIES.map((item) => {
                const active = category === item;
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setCategory(item);
                      clear('category');
                    }}
                    className={cn(
                      'h-8 border px-3 font-mono text-[10px] uppercase tracking-widest transition-colors duration-200',
                      active
                        ? 'border-arena/50 bg-arena/10 text-arena'
                        : 'border-white/15 text-bone-dim hover:border-white/40 hover:text-bone',
                    )}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            {errors.category ? (
              <p className="font-mono text-[10px] uppercase tracking-widest text-arena">{errors.category}</p>
            ) : null}
          </div>

          <Field
            id={`${uid}-description`}
            label="Description"
            hint={<span className="num text-[10px] text-bone-faint">Optional</span>}
          >
            <textarea
              id={`${uid}-description`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={DESCRIPTION_MAX}
              rows={4}
              placeholder="Context for spectators. What you built, what is different."
              className={cn(INPUT, 'h-auto resize-none py-3 leading-relaxed')}
            />
          </Field>

          <Field
            id={`${uid}-logo`}
            label="Logo Upload"
            hint={<span className="num text-[10px] text-bone-faint">PNG, JPG, WEBP · 1MB</span>}
          >
            <label
              htmlFor={`${uid}-logo`}
              className="flex min-h-20 cursor-pointer items-center justify-between gap-4 border border-dashed hairline px-4 py-3 text-sm text-bone-dim transition-colors hover:border-white/30 hover:text-bone"
            >
              <span>{logoFile ? logoFile.name : 'Choose project mark'}</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-arena">Browse</span>
              <input
                id={`${uid}-logo`}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </Field>
        </div>

        <div className="flex flex-col gap-5">
          <SectionRule index="03" title="Builder" />
          <Field
            id={`${uid}-email`}
            label="Email"
            error={errors.builderEmail}
            hint={<span className="num text-[10px] text-bone-faint">Receipt + result</span>}
          >
            <input
              id={`${uid}-email`}
              value={builderEmail}
              onChange={(e) => {
                setBuilderEmail(e.target.value);
                clear('builderEmail');
              }}
              inputMode="email"
              maxLength={200}
              placeholder="you@domain.com"
              autoComplete="email"
              className={cn(INPUT, 'font-mono text-[13px]', errors.builderEmail && 'border-arena/50')}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id={`${uid}-x`} label="X URL" error={errors.xUrl} hint={<span className="num text-[10px] text-bone-faint">Optional</span>}>
              <input
                id={`${uid}-x`}
                value={xUrl}
                onChange={(event) => { setXUrl(event.target.value); clear('xUrl'); }}
                inputMode="url"
                placeholder="https://x.com/"
                className={cn(INPUT, 'font-mono text-[13px]', errors.xUrl && 'border-arena/50')}
              />
            </Field>
            <Field id={`${uid}-github`} label="GitHub URL" error={errors.githubUrl} hint={<span className="num text-[10px] text-bone-faint">Optional</span>}>
              <input
                id={`${uid}-github`}
                value={githubUrl}
                onChange={(event) => { setGithubUrl(event.target.value); clear('githubUrl'); }}
                inputMode="url"
                placeholder="https://github.com/"
                className={cn(INPUT, 'font-mono text-[13px]', errors.githubUrl && 'border-arena/50')}
              />
            </Field>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Rule />
          {formError ? (
            <p
              role="alert"
              className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-arena"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {formError}
            </p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-sm text-xs leading-relaxed text-bone-faint">
              {selected && selected.entryFeeCents > 0
                ? 'Payment is handled by Stripe. Your slot is held on the grid once checkout clears.'
                : 'No fee for this Arena. Your slot is held on the grid once the entry clears.'}
            </p>
            <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
              {submitLabel}
            </Button>
          </div>
        </div>
      </form>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <EntryBrief arena={selected} />
      </div>
    </motion.div>
  );
}
