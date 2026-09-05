import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ProjectLogo } from '@/components/project-logo';
import { Label } from '@/components/ui';
import { formatDate, formatNumber, formatRank } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { ArenaResult } from '@/lib/types';

function ChampionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-[68px] flex-col gap-1.5 lg:items-end">
      <Label>{label}</Label>
      <span className="num text-base leading-none text-bone sm:text-lg">{value}</span>
    </div>
  );
}

export function ChampionRow({ result, featured = false }: { result: ArenaResult; featured?: boolean }) {
  const { arena, champion, runnersUp } = result;
  const { project } = champion;

  return (
    <article
      className={cn(
        'relative border-b hairline transition-colors duration-200 last:border-b-0',
        featured ? 'bg-gold/[0.03] hover:bg-gold/[0.05]' : 'hover:bg-white/[0.02]',
      )}
    >
      {featured ? (
        <>
          <span className="absolute inset-y-0 left-0 w-px bg-gold" aria-hidden />
          <span
            className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gold/[0.07] blur-2xl"
            aria-hidden
          />
        </>
      ) : null}

      <div
        className={cn(
          'relative grid gap-x-10 gap-y-6 px-5 sm:px-7 lg:grid-cols-[188px_minmax(0,1fr)_auto]',
          featured ? 'py-9 sm:py-12' : 'py-8 sm:py-10',
        )}
      >
        <div className="flex flex-col gap-2.5">
          <span className="font-mono text-[11px] uppercase tracking-widest text-bone-dim">
            {arena.name}
          </span>
          <Label>{formatDate(arena.endsAt)}</Label>
          <span className="mt-1 inline-flex w-fit items-center gap-1.5 border border-gold/25 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-gold">
            Champion
          </span>
        </div>

        <div className="flex min-w-0 items-start gap-4 sm:gap-5">
          <ProjectLogo name={project.name} logoUrl={project.logoUrl} size={featured ? 'lg' : 'md'} />
          <div className="min-w-0 flex-1">
            <h3
              className={cn(
                'font-semibold tracking-headline',
                featured ? 'text-4xl sm:text-5xl' : 'text-2xl sm:text-3xl',
              )}
            >
              <Link
                href={`/project/${project.slug}`}
                className="text-bone transition-colors duration-200 hover:text-arena"
              >
                {project.name}
              </Link>
            </h3>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-bone-dim">{project.tagline}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <Label>{project.category}</Label>
              <span className="text-bone-faint/50" aria-hidden>
                /
              </span>
              <Label>@{project.builder.handle}</Label>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-9 gap-y-5 lg:justify-end">
          <ChampionStat label="Final score" value={formatNumber(champion.score)} />
          <ChampionStat label="Project visits" value={formatNumber(champion.clicks)} />
          <ChampionStat label="Supporters" value={formatNumber(champion.supporters)} />
          <ChampionStat label="Field" value={formatNumber(arena.entrantCount)} />
        </div>

        <div className="flex flex-col gap-3 border-t hairline pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8 lg:col-span-3">
          {runnersUp.length > 0 ? (
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
              <Label>Runners-up</Label>
              {runnersUp.map((row, i) => (
                <span key={row.project.slug} className="flex items-center gap-2">
                  {i > 0 ? (
                    <span className="text-bone-faint/50" aria-hidden>
                      ·
                    </span>
                  ) : null}
                  <span className="num text-[11px] text-bone-faint">{formatRank(row.rank)}</span>
                  <Link
                    href={`/project/${row.project.slug}`}
                    className="truncate text-xs text-bone-dim transition-colors duration-200 hover:text-bone"
                  >
                    {row.project.name}
                  </Link>
                </span>
              ))}
            </div>
          ) : (
            <Label>No runners-up recorded</Label>
          )}

          <Link
            href={`/arena/${arena.slug}`}
            className="group/link inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-bone-dim transition-colors duration-200 hover:text-bone"
          >
            View Arena
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/link:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
