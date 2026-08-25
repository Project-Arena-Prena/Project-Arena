'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight, ChevronDown, ChevronUp, Minus } from 'lucide-react';
import type { Standing } from '@/lib/types';
import { cn } from '@/lib/cn';
import { formatNumber, formatRank } from '@/lib/format';
import { getVisitorId } from '@/lib/visitor';
import { ImpressionTracker } from './impression-tracker';
import { ProjectLogo } from './project-logo';
import { SupportButton } from './support-button';

function Movement({ value }: { value: number }) {
  if (value === 0) return <span className="inline-flex items-center gap-1 text-bone-faint"><Minus className="h-3 w-3" /> 0</span>;
  const up = value > 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5', up ? 'text-gain' : 'text-danger')}>
      {up ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      {Math.abs(value)}
    </span>
  );
}

export function ProjectCard({
  standing,
  arenaSlug,
  live = false,
  interactive = true,
  champion = false,
  index = 0,
}: {
  standing: Standing;
  arenaSlug: string;
  live?: boolean;
  interactive?: boolean;
  champion?: boolean;
  index?: number;
}) {
  const [score, setScore] = useState(standing.score);
  const trending = live && standing.momentum >= 3;
  const visitHref = `/go/${standing.project.slug}?arena=${encodeURIComponent(arenaSlug)}`;

  return (
    <motion.article
      layout={live}
      initial={{ opacity: 0, y: 7 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.018, 0.28), ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'group relative min-h-[116px] border-b hairline px-4 py-5 transition-colors hover:bg-white/[0.03] sm:px-5',
        standing.rank === 1 && 'bg-[#0c0705]',
      )}
    >
      {standing.rank === 1 ? <span className="absolute inset-y-0 left-0 w-0.5 bg-arena/80" aria-hidden /> : null}
      {live ? <ImpressionTracker projectSlug={standing.project.slug} arenaSlug={arenaSlug} /> : null}

      <div className="grid grid-cols-[42px_1fr] gap-x-3 gap-y-4 md:grid-cols-[54px_48px_minmax(0,1fr)_118px_62px_168px] md:items-center md:gap-x-4">
        <div className="flex flex-col gap-1.5 self-start md:self-center">
          <span className={cn('num text-lg leading-none', standing.rank === 1 ? 'text-arena' : 'text-bone')}>
            {formatRank(standing.rank)}
          </span>
          <span className="num text-[10px] uppercase tracking-widest"><Movement value={standing.momentum} /></span>
        </div>

        <ProjectLogo name={standing.project.name} logoUrl={standing.project.logoUrl} />

        <div className="col-span-2 min-w-0 md:col-span-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/project/${standing.project.slug}`} className="text-lg font-semibold tracking-tight text-bone transition-colors hover:text-arena">
              {standing.project.name}
            </Link>
            {champion ? <span className="border border-gold/40 bg-gold/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-gold">Champion</span> : null}
            {trending ? <span className="border border-arena/35 bg-arena/[0.08] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-arena">Trending</span> : null}
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-bone-dim">{standing.project.tagline}</p>
          <span className="mt-2 inline-block font-mono text-[9px] uppercase tracking-widest text-bone-faint">{standing.project.category}</span>
        </div>

        <div className="flex flex-col gap-1 md:items-end">
          <span className="label">Score</span>
          <span className="num text-lg text-arena">{formatNumber(score)} <span className="text-[9px] text-bone-faint">PTS</span></span>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="label">Move</span>
          <span className="num text-xs"><Movement value={standing.momentum} /></span>
        </div>

        {interactive ? (
          <div className="col-span-2 flex gap-2 md:col-span-1 md:justify-end">
            <SupportButton
              projectSlug={standing.project.slug}
              arenaSlug={arenaSlug}
              initialSupporters={standing.supporters}
              onScoreChange={(delta) => setScore((current) => current + delta)}
            />
            <a
              href={visitHref}
              target="_blank"
              rel="noopener noreferrer nofollow"
              onClick={() => getVisitorId()}
              className="inline-flex h-8 items-center justify-center gap-1.5 border border-white/15 px-3 font-mono text-[10px] uppercase tracking-widest text-bone-dim transition-colors hover:border-white/40 hover:text-bone md:hidden"
            >
              Visit <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        ) : null}
      </div>

      <div className="mt-3 hidden items-center gap-5 border-t hairline pt-3 md:flex">
        <span className="label">{formatNumber(standing.supporters)} supporters</span>
        <span className="label">{formatNumber(standing.clicks)} unique visits</span>
        <span className="label">{standing.share.toFixed(1)}% of Arena score</span>
      </div>
    </motion.article>
  );
}
