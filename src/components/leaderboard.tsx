'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, ChevronDown, ChevronUp, Minus } from 'lucide-react';
import type { Standing } from '@/lib/types';
import { formatCompact, formatNumber, formatRank } from '@/lib/format';
import { cn } from '@/lib/cn';
import { SupportButton } from './support-button';

function Momentum({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-bone-faint">
        <Minus className="h-3 w-3" />
      </span>
    );
  }
  const up = value > 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 num text-[11px]', up ? 'text-gain' : 'text-arena')}>
      {up ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      {Math.abs(value)}
    </span>
  );
}

function rankColor(rank: number) {
  if (rank === 1) return 'text-gold';
  if (rank <= 3) return 'text-bone';
  return 'text-bone-dim';
}

export function Leaderboard({
  standings,
  arenaSlug,
  live = false,
  compact = false,
  interactive = true,
}: {
  standings: Standing[];
  arenaSlug: string;
  live?: boolean;
  compact?: boolean;
  interactive?: boolean;
}) {
  return (
    <div className="w-full">
      <div
        className={cn(
          'hidden items-center gap-4 border-b hairline px-4 py-2.5 md:grid',
          compact
            ? 'grid-cols-[42px_1fr_86px_86px]'
            : 'grid-cols-[42px_44px_1fr_96px_96px_110px_128px]',
        )}
      >
        <span className="label">Pos</span>
        {!compact ? <span className="label">Mv</span> : null}
        <span className="label">Project</span>
        <span className="label text-right">Supporters</span>
        <span className="label text-right">Visits</span>
        {!compact ? <span className="label text-right">Share</span> : null}
        {!compact ? <span className="label text-right">Action</span> : null}
      </div>

      <AnimatePresence initial={false}>
        {standings.map((s, i) => (
          <motion.div
            key={s.project.slug}
            layout={live}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(i * 0.015, 0.3), ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'group relative grid items-center gap-x-4 gap-y-2 border-b hairline px-4 py-3.5 transition-colors duration-200 hover:bg-white/[0.025]',
              compact
                ? 'grid-cols-[36px_1fr_auto] md:grid-cols-[42px_1fr_86px_86px]'
                : 'grid-cols-[36px_1fr_auto] md:grid-cols-[42px_44px_1fr_96px_96px_110px_128px]',
              s.rank === 1 && 'bg-gold/[0.045]',
            )}
          >
            {s.rank === 1 ? <span className="absolute inset-y-0 left-0 w-px bg-gold/70" aria-hidden /> : null}

            <span className={cn('num text-sm', rankColor(s.rank))}>{formatRank(s.rank)}</span>

            {!compact ? (
              <span className="hidden md:block">
                <Momentum value={s.momentum} />
              </span>
            ) : null}

            <div className="flex min-w-0 flex-col gap-0.5">
              <Link
                href={`/project/${s.project.slug}`}
                className="truncate text-[15px] font-medium tracking-tight text-bone transition-colors hover:text-arena"
              >
                {s.project.name}
              </Link>
              <span className="truncate text-xs text-bone-faint">
                <span className="font-mono uppercase tracking-widest text-bone-faint">{s.project.category}</span>
                <span className="mx-1.5 text-bone-faint/50">/</span>
                {s.project.tagline}
              </span>
            </div>

            <span className="hidden num text-right text-sm text-bone-dim md:block">
              {formatNumber(s.supporters)}
            </span>
            <span className="hidden num text-right text-sm text-bone-dim md:block">
              {formatNumber(s.clicks)}
            </span>

            {!compact ? (
              <div className="hidden items-center justify-end gap-2 md:flex">
                <div className="h-1 w-14 bg-white/[0.06]">
                  <div
                    className={cn('h-full', s.rank === 1 ? 'bg-gold' : 'bg-bone-faint')}
                    style={{ width: `${Math.min(100, s.share * 6)}%` }}
                  />
                </div>
                <span className="num text-xs text-bone-faint">{s.share.toFixed(1)}%</span>
              </div>
            ) : null}

            {!compact && interactive ? (
              <div className="hidden justify-end md:flex">
                <SupportButton
                  projectSlug={s.project.slug}
                  projectUrl={s.project.url}
                  arenaSlug={arenaSlug}
                  initialSupporters={s.supporters}
                />
              </div>
            ) : null}

            {/* Mobile summary column */}
            <div className="flex items-center justify-end gap-3 md:hidden">
              <span className="num text-xs text-bone-faint">{formatCompact(s.supporters)}</span>
              {interactive && !compact ? (
                <SupportButton
                  projectSlug={s.project.slug}
                  projectUrl={s.project.url}
                  arenaSlug={arenaSlug}
                  initialSupporters={s.supporters}
                  compact
                />
              ) : (
                <ArrowUpRight className="h-3.5 w-3.5 text-bone-faint" />
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
