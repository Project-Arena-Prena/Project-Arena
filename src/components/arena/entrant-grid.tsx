import Link from 'next/link';
import { Label } from '@/components/ui';
import type { Project } from '@/lib/types';

export function EntrantGrid({ entrants }: { entrants: Project[] }) {
  return (
    <div className="overflow-hidden border hairline bg-ink-900/60">
      <div className="-ml-px -mt-px grid sm:grid-cols-2 lg:grid-cols-3">
        {entrants.map((project) => (
          <div
            key={project.slug}
            className="flex min-w-0 flex-col gap-2 border-l border-t hairline px-4 py-4 transition-colors duration-200 hover:bg-white/[0.025]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <Link
                href={`/project/${project.slug}`}
                className="truncate text-[15px] font-medium tracking-tight text-bone transition-colors duration-200 hover:text-arena"
              >
                {project.name}
              </Link>
              <Label className="shrink-0">{project.category}</Label>
            </div>
            <p className="line-clamp-2 text-xs leading-relaxed text-bone-faint">{project.tagline}</p>
            <Label>@{project.builder.handle}</Label>
          </div>
        ))}
      </div>
    </div>
  );
}
