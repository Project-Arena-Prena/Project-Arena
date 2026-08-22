import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ButtonLink, Container, Label, Rule } from '@/components/ui';

export default function NotFound() {
  return (
    <Container className="flex min-h-[70vh] flex-col justify-center py-24">
      <div className="flex flex-col gap-6 border-l hairline pl-6 sm:pl-8">
        <div className="flex items-baseline gap-4">
          <span className="num text-5xl leading-none text-bone-faint sm:text-6xl">404</span>
          <Label>No Signal</Label>
        </div>

        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold tracking-headline sm:text-6xl">Off the board.</h1>
          <Rule className="max-w-md" />
          <p className="max-w-md text-sm leading-relaxed text-bone-dim">
            Nothing runs at this address. The page was never scheduled, or it left the grid.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <ButtonLink href="/" variant="secondary">
            <ArrowLeft className="h-3.5 w-3.5" />
            Home
          </ButtonLink>
          <Link
            href="/arenas"
            className="font-mono text-[11px] uppercase tracking-widest text-bone-faint transition-colors duration-200 hover:text-bone"
          >
            All Arenas
          </Link>
        </div>
      </div>
    </Container>
  );
}
