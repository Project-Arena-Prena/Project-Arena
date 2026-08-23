import { ArrowUpRight } from 'lucide-react';
import type { Arena, Standing } from '@/lib/types';
import { formatNumber, formatRank } from '@/lib/format';
import { shareText, xIntentUrl } from '@/lib/share';
import { siteUrl } from '@/lib/stripe';
import { ProjectLogo } from './project-logo';

export function ShareResultCard({ standing, arena }: { standing: Standing; arena: Arena }) {
  const endLabel = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date(arena.endsAt));
  const url = `${siteUrl()}/arena/${arena.slug}`;
  const text = shareText(arena.status === 'finished' ? (standing.rank === 1 ? 'champion' : 'final') : 'live', {
    projectName: standing.project.name,
    arenaName: arena.name,
    rank: standing.rank,
    field: arena.entrantCount,
    url,
  });
  const intent = xIntentUrl(text);

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
      <div className="relative aspect-[1.91/1] min-h-[260px] overflow-hidden border hairline bg-ink-900 p-6 sm:p-8">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-center justify-between gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-bone">Project Arena</span>
            <span className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-live">
              <span className="h-1.5 w-1.5 rounded-full bg-live" /> Live result
            </span>
          </div>

          <div className="flex items-end justify-between gap-6">
            <div className="flex min-w-0 items-center gap-4">
              <ProjectLogo name={standing.project.name} logoUrl={standing.project.logoUrl} size="lg" />
              <div className="min-w-0">
                <p className="label">Currently</p>
                <p className="mt-2 truncate text-3xl font-semibold tracking-headline text-bone sm:text-5xl">{standing.project.name}</p>
                <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-bone-faint">{arena.name}</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="num text-5xl leading-none text-arena sm:text-7xl">{formatRank(standing.rank)}</p>
              <p className="mt-3 font-mono text-[9px] uppercase tracking-widest text-bone-dim">{formatNumber(standing.score)} points</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t hairline pt-4">
            <span className="font-mono text-[9px] uppercase tracking-widest text-bone-faint">Ends {endLabel}</span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-bone-faint">projectarena.xyz</span>
          </div>
        </div>
      </div>

      <a
        href={intent}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-12 items-center justify-center gap-2 border border-white/15 font-mono text-[10px] uppercase tracking-widest text-bone transition-colors hover:border-white/40 hover:bg-white/[0.03]"
      >
        Share on X <ArrowUpRight className="h-3.5 w-3.5" />
      </a>
    </section>
  );
}
