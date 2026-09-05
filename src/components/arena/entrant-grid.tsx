import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { ProjectLogo } from '@/components/project-logo';
import { Reveal } from '@/components/reveal';
import { Label } from '@/components/ui';
import type { Project } from '@/lib/types';

export function EntrantGrid({ entrants }: { entrants: Project[] }) {
  return (
    <div className="overflow-hidden border hairline bg-ink-900/60">
      <div className="-ml-px -mt-px grid sm:grid-cols-2 lg:grid-cols-3">
        {entrants.map((project, index) => (
          <Reveal key={project.slug} delay={(index % 3) * 0.045} direction="scale" className="h-full">
            <Link
              href={`/project/${project.slug}`}
              className="group relative flex min-h-[176px] min-w-0 flex-col gap-4 overflow-hidden border-l border-t hairline bg-ink-900/30 px-4 py-5 transition-[background-color,border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.035] sm:px-5"
            >
              <span className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-gradient-to-r from-arena to-transparent transition-transform duration-500 group-hover:scale-x-100" aria-hidden />
              <div className="flex items-start justify-between gap-4">
                <ProjectLogo name={project.name} logoUrl={project.logoUrl} size="md" />
                <ArrowUpRight className="h-4 w-4 text-bone-faint transition-[color,transform] duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-arena" aria-hidden />
              </div>
              <div className="mt-auto min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[15px] font-medium tracking-tight text-bone transition-colors duration-200 group-hover:text-arena">
                    {project.name}
                  </span>
                  <Label className="shrink-0">{project.category}</Label>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-bone-faint">
                  {project.tagline}
                </p>
                <Label className="mt-3 block">@{project.builder.handle}</Label>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
