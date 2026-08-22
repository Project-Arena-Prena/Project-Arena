import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ButtonLink, Container, Label } from '@/components/ui';

export default function ArenaNotFound() {
  return (
    <Container className="flex min-h-[60vh] flex-col justify-center py-24">
      <div className="flex flex-col gap-5 border-l hairline pl-6 sm:pl-8">
        <Label>Error 404</Label>
        <h1 className="text-4xl font-semibold tracking-headline sm:text-6xl">Arena Not Found</h1>
        <p className="max-w-md text-sm leading-relaxed text-bone-dim">
          No Arena runs under that address. It was never scheduled, or the slug changed.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <ButtonLink href="/arenas" variant="secondary">
            <ArrowLeft className="h-3.5 w-3.5" />
            All Arenas
          </ButtonLink>
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-widest text-bone-faint transition-colors duration-200 hover:text-bone"
          >
            Home
          </Link>
        </div>
      </div>
    </Container>
  );
}
