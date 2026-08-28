'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { ArrowRight, Radio } from 'lucide-react';
import { useRef } from 'react';
import { ArenaStage, type ArenaStageArena, type ArenaStageStanding } from './arena-stage';
import { RomanHeroBackdrop } from './roman-hero-backdrop';
import { ButtonLink, Container, LiveDot } from '@/components/ui';

export function CinematicHomeHero({
  arena,
  standings,
}: {
  arena: ArenaStageArena | null;
  standings: ArenaStageStanding[];
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 24,
    mass: 0.28,
  });

  const backdropScale = useTransform(progress, [0, 1], [1, 1.12]);
  const backdropY = useTransform(progress, [0, 1], ['0%', '-3.5%']);
  const copyY = useTransform(progress, [0, 0.72, 1], ['0%', '-2.5%', '-5%']);
  const quietLines = useTransform(progress, [0, 0.42, 0.8], [1, 0.72, 0.42]);
  const accentGlow = useTransform(progress, [0, 0.46, 1], [0.52, 0.82, 1]);
  const stageOpacity = useTransform(progress, [0, 0.08, 0.22, 0.9, 1], [0.18, 0.42, 1, 1, 0.55]);
  const stageX = useTransform(progress, [0, 0.24, 1], ['9%', '0%', '-2%']);
  const stageY = useTransform(progress, [0, 0.55, 1], ['5%', '0%', '-4%']);
  const railScale = useTransform(progress, [0, 1], [0, 1]);

  return (
    <section ref={sectionRef} className="cinematic-hero relative border-b hairline" aria-labelledby="home-hero-title">
      <div className="cinematic-hero__stage relative flex overflow-hidden bg-[#050403]">
        <motion.div
          className="absolute -inset-[5%] will-change-transform"
          style={reduceMotion ? undefined : { scale: backdropScale, y: backdropY }}
          aria-hidden="true"
        >
          <RomanHeroBackdrop />
        </motion.div>

        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_48%,transparent_0%,rgba(5,4,3,0.2)_40%,rgba(5,4,3,0.82)_100%)]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-35 [background:linear-gradient(110deg,transparent_48%,rgba(232,80,2,0.08)_48.2%,transparent_48.6%)]"
          aria-hidden="true"
        />

        <span className="absolute right-5 top-24 z-20 hidden items-center gap-3 font-mono text-[8px] uppercase tracking-[0.2em] text-white/45 sm:flex lg:right-8">
          <span>Field I</span>
          <span className="h-px w-12 bg-white/30" aria-hidden="true" />
          <span>Public competition</span>
        </span>

        <Container className="relative z-10 grid w-full items-center gap-12 pb-24 pt-24 sm:pb-24 sm:pt-24 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.72fr)] lg:gap-14 xl:gap-20">
          <motion.div className="min-w-0" style={reduceMotion ? undefined : { y: copyY }}>
            <div className="mb-7 flex items-center gap-4 sm:mb-9">
              <Image
                src="/project-arena-logo.png"
                alt="Project Arena"
                width={1536}
                height={1024}
                priority
                sizes="(min-width: 640px) 144px, 112px"
                className="h-16 w-auto object-contain brightness-0 invert sm:h-20"
              />
              <span className="h-px w-12 bg-white/40" aria-hidden="true" />
              <span className="hidden font-mono text-[8px] uppercase tracking-[0.18em] text-bone-faint sm:block">
                Where projects compete for attention
              </span>
            </div>

            <h1
              id="home-hero-title"
              className="font-display max-w-[850px] text-[clamp(3.65rem,8.5vw,7rem)] font-semibold uppercase leading-[0.78] tracking-[-0.065em] text-bone"
            >
              <motion.span className="block" style={reduceMotion ? undefined : { opacity: quietLines }}>
                The internet
              </motion.span>
              <motion.span className="block" style={reduceMotion ? undefined : { opacity: quietLines }}>
                is building.
              </motion.span>
              <motion.span
                className="relative block text-arena [text-shadow:0_0_42px_rgba(232,80,2,0.14)]"
                style={reduceMotion ? undefined : { opacity: accentGlow }}
              >
                See what&apos;s winning.
              </motion.span>
            </h1>

            <p className="mt-7 max-w-xl text-sm leading-relaxed text-bone sm:mt-8 sm:text-[17px]">
              Discover projects competing for attention, support the ones you believe in, or enter
              your own.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <ButtonLink
                href={arena ? `/arena/${arena.slug}` : '/arenas'}
                size="lg"
                className="group w-full sm:w-auto"
              >
                <Radio className="h-4 w-4" /> Watch live
              </ButtonLink>
              <ButtonLink
                href="/enter"
                variant="secondary"
                size="lg"
                className="group w-full border-white/60 bg-[#050403]/35 sm:w-auto"
              >
                Enter the Arena
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </ButtonLink>
            </div>
          </motion.div>

          <motion.div
            className="hidden lg:block"
            style={reduceMotion ? undefined : { opacity: stageOpacity, x: stageX, y: stageY }}
          >
            <ArenaStage arena={arena} standings={standings} />
          </motion.div>
        </Container>

        <Container className="absolute inset-x-0 bottom-5 z-20 sm:bottom-6">
          <div className="relative grid min-h-14 grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-y border-white/25 py-2 font-mono text-[8px] uppercase tracking-[0.14em] text-white/70 sm:grid-cols-[1fr_1fr_auto] sm:px-4 sm:text-[9px]">
            <motion.span
              className="absolute inset-x-0 -top-px h-px origin-left bg-gradient-to-r from-arena via-arena/60 to-transparent"
              style={reduceMotion ? undefined : { scaleX: railScale }}
              aria-hidden="true"
            />
            <span className="inline-flex items-center gap-2">
              <LiveDot /> Gate open · {arena?.name ?? 'Next Arena'}
            </span>
            <span className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
              {arena ? `${arena.entrantCount} projects · 48 hours · one champion` : 'Registration is open'}
            </span>
            <Link
              href={arena ? `/arena/${arena.slug}` : '/arenas'}
              className="group col-start-2 row-start-1 inline-flex items-center gap-2 font-bold text-bone sm:col-start-auto"
            >
              <span className="hidden sm:inline">Enter race control</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </Container>

        <div className="absolute bottom-[88px] left-8 z-20 hidden items-center gap-3 font-mono text-[8px] uppercase tracking-[0.18em] text-bone-faint xl:flex">
          <span className="inline-flex h-8 w-5 items-start justify-center rounded-full border border-white/25 pt-1.5">
            <motion.span
              className="h-1 w-1 rounded-full bg-arena"
              animate={reduceMotion ? undefined : { y: [0, 12, 0], opacity: [1, 0.3, 1] }}
              transition={{ duration: 2.2, ease: 'easeInOut', repeat: Infinity }}
            />
          </span>
          Scroll to enter
        </div>
      </div>
    </section>
  );
}
