'use client';

import { AnimatePresence } from 'framer-motion';
import type { Standing } from '@/lib/types';
import { ProjectCard } from './project-card';

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
      <AnimatePresence initial={false}>
        {standings.map((s, i) => (
          <ProjectCard
            key={s.project.slug}
            standing={s}
            arenaSlug={arenaSlug}
            live={live}
            interactive={interactive && !compact}
            champion={!live && s.rank === 1}
            index={i}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
