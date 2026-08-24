'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ChevronDown, ChevronUp, Minus } from 'lucide-react';
import { Countdown } from '@/components/countdown';
import { ProjectLogo } from '@/components/project-logo';
import { formatNumber, formatRank } from '@/lib/format';
import { cn } from '@/lib/cn';

export interface ArenaStageStanding {
  rank: number;
  slug: string;
  name: string;
  category: string;
  logoUrl: string | null;
  score: number;
  share: number;
  momentum: number;
}

export interface ArenaStageArena {
  slug: string;
  name: string;
  endsAt: string;
  entrantCount: number;
}

function Movement({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-bone-faint">
        <Minus className="h-3 w-3" />
        <span>0</span>
      </span>
    );
  }

  const gaining = value > 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5', gaining ? 'text-live' : 'text-arena')}>
      {gaining ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      <span>{Math.abs(value)}</span>
    </span>
  );
}

export function ArenaStage({
  arena,
  standings,
}: {
  arena: ArenaStageArena | null;
  standings: ArenaStageStanding[];
}) {
  const reduceMotion = useReducedMotion();
  const leaderScore = Math.max(standings[0]?.score ?? 1, 1);

  return (
    <motion.div
      initial={reduceMotion ? false : { y: 18, rotateX: 1.5 }}
      animate={{ y: 0, rotateX: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto w-full max-w-[560px] [perspective:1000px] lg:max-w-none"
    >
      <div
        className="pointer-events-none absolute -inset-8 bg-[radial-gradient(circle_at_60%_45%,rgba(255,75,31,0.14),transparent_62%)] blur-2xl"
        aria-hidden
      />
      <div className="relative overflow-hidden border border-white/[0.12] bg-ink-900/90 shadow-[0_32px_100px_rgba(0,0,0,0.48)] backdrop-blur-sm">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-20" aria-hidden />
        <motion.span
          className="pointer-events-none absolute left-0 top-0 h-px w-1/3 bg-gradient-to-r from-transparent via-arena to-transparent"
          animate={reduceMotion ? undefined : { x: ['-100%', '400%'] }}
          transition={{ duration: 4.5, ease: 'linear', repeat: Infinity, repeatDelay: 1.5 }}
          aria-hidden
        />

        <div className="relative flex items-center justify-between gap-4 border-b hairline px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
              <motion.span
                className="absolute inset-0 rounded-full bg-live"
                animate={reduceMotion ? undefined : { scale: [1, 1.8, 1], opacity: [1, 0.2, 1] }}
                transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity }}
              />
              <span className="absolute inset-0 rounded-full bg-live" />
            </span>
            <span className="truncate font-mono text-[10px] uppercase tracking-widest text-bone">
              {arena?.name ?? 'Next Arena assembling'}
            </span>
          </div>
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-live">
            {arena ? 'Live now' : 'Entries open'}
          </span>
        </div>

        {arena ? (
          <>
            <div className="relative flex items-end justify-between gap-4 border-b hairline px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-2">
                <span className="label">Time remaining</span>
                <Countdown target={arena.endsAt} size="sm" />
              </div>
              <div className="hidden flex-col items-end gap-1 sm:flex">
                <span className="num text-xl leading-none text-bone">{formatNumber(arena.entrantCount)}</span>
                <span className="label">Projects</span>
              </div>
            </div>

            <div className="relative px-2 py-2 sm:px-3">
              <div className="flex items-center justify-between px-2 py-2">
                <span className="label">Live standings</span>
                <span className="label">Score</span>
              </div>
              <div className="space-y-1">
                {standings.map((standing, index) => {
                  const relativeScore = Math.max(18, (standing.score / leaderScore) * 100);
                  return (
                    <motion.div
                      key={standing.slug}
                      initial={reduceMotion ? false : { x: 16 }}
                      animate={{ x: 0 }}
                      transition={{
                        duration: 0.5,
                        delay: 0.18 + index * 0.07,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className={cn(
                        'group relative overflow-hidden border px-3 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.025]',
                        index === 0
                          ? 'border-gold/25 bg-gold/[0.045]'
                          : 'border-white/[0.06] bg-ink-950/35',
                      )}
                    >
                      <div
                        className="pointer-events-none absolute inset-y-0 left-0 bg-white/[0.025]"
                        style={{ width: `${relativeScore}%` }}
                        aria-hidden
                      >
                        <motion.span
                          className={cn(
                            'absolute inset-y-0 right-0 w-px origin-bottom',
                            index === 0 ? 'bg-gold/45' : 'bg-arena/30',
                          )}
                          initial={reduceMotion ? false : { scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{ duration: 0.45, delay: 0.3 + index * 0.07 }}
                        />
                      </div>

                      <Link
                        href={`/project/${standing.slug}`}
                        className="relative grid grid-cols-[28px_36px_minmax(0,1fr)_auto] items-center gap-2.5"
                      >
                        <span
                          className={cn(
                            'num text-sm',
                            index === 0 ? 'text-gold' : 'text-bone-dim',
                          )}
                        >
                          {formatRank(standing.rank)}
                        </span>
                        <ProjectLogo name={standing.name} logoUrl={standing.logoUrl} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium tracking-tight text-bone transition-colors group-hover:text-arena">
                            {standing.name}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-[8px] uppercase tracking-widest text-bone-faint">
                            {standing.category} · {standing.share.toFixed(1)}%
                          </span>
                        </span>
                        <span className="flex flex-col items-end gap-1">
                          <span className="num text-xs text-bone">{formatNumber(standing.score)}</span>
                          <span className="num text-[9px]">
                            <Movement value={standing.momentum} />
                          </span>
                        </span>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <Link
              href={`/arena/${arena.slug}`}
              className="group relative flex items-center justify-between border-t hairline px-4 py-4 font-mono text-[10px] uppercase tracking-widest text-bone transition-colors hover:bg-white/[0.03] sm:px-5"
            >
              Watch the rankings move
              <ArrowUpRight className="h-3.5 w-3.5 text-bone-dim transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </>
        ) : (
          <div className="relative flex min-h-[390px] flex-col justify-between p-5 sm:p-7">
            <div>
              <span className="label">The field is forming</span>
              <p className="mt-4 max-w-sm text-2xl font-semibold tracking-headline text-bone sm:text-3xl">
                Put your project on the next live leaderboard.
              </p>
            </div>
            <Link
              href="/arenas"
              className="group flex items-center justify-between border-t hairline pt-5 font-mono text-[10px] uppercase tracking-widest text-bone"
            >
              Explore upcoming Arenas
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
}
