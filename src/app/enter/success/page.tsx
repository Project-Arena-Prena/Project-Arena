import type { Metadata } from 'next';
import { ButtonLink, Container, Label, Panel, Rule } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { getArena } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Entry Confirmed',
  description: 'Your Project is on the grid.',
  robots: { index: false, follow: false },
};

const NEXT_STEPS = [
  { index: '01', body: 'A receipt and your entry confirmation are on their way to your email.' },
  { index: '02', body: 'Your Project is seeded onto the grid with its rating and record.' },
  { index: '03', body: 'When the clock runs, supporters and clicks decide the standings.' },
];

export default async function EntrySuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ arena?: string; session_id?: string }>;
}) {
  const { arena: arenaSlug, session_id: sessionId } = await searchParams;
  const arena = arenaSlug ? await getArena(arenaSlug) : null;

  return (
    <div className="pb-24">
      <Container className="py-16 sm:py-24">
        <div className="flex w-full max-w-[880px] flex-col gap-10">
          <div className="animate-rise-in flex flex-col gap-5">
            <Label>Entry Confirmed</Label>
            <h1 className="text-[44px] font-semibold leading-[0.9] tracking-headline sm:text-6xl lg:text-7xl">
              You&apos;re in.
            </h1>
            {arena ? (
              <p className="num text-sm uppercase tracking-widest text-bone-dim">
                {arena.name}
                <span className="px-2 text-bone-faint">/</span>
                {arena.status === 'live' ? 'Running now' : `Starts ${formatDateTime(arena.startsAt)} UTC`}
              </p>
            ) : (
              <p className="num text-sm uppercase tracking-widest text-bone-dim">Your slot is held on the grid.</p>
            )}
          </div>

          <Rule />

          <Panel className="animate-rise-in">
            <div className="border-b hairline px-4 py-3">
              <Label>What Happens Next</Label>
            </div>
            <ol>
              {NEXT_STEPS.map((step) => (
                <li key={step.index} className="flex items-baseline gap-4 border-b hairline px-4 py-4 last:border-b-0">
                  <span className="num text-[10px] tracking-widest text-arena">{step.index}</span>
                  <p className="text-sm leading-relaxed text-bone-dim">{step.body}</p>
                </li>
              ))}
            </ol>
          </Panel>

          <div className="flex flex-col gap-3 sm:flex-row">
            {arena ? (
              <ButtonLink href={`/arena/${arena.slug}`} size="lg" className="w-full sm:w-auto">
                View Arena
              </ButtonLink>
            ) : (
              <ButtonLink href="/arenas" size="lg" className="w-full sm:w-auto">
                All Arenas
              </ButtonLink>
            )}
            <ButtonLink href="/dashboard" variant="secondary" size="lg" className="w-full sm:w-auto">
              Go To Dashboard
            </ButtonLink>
          </div>

          {sessionId ? (
            <p className="num truncate text-[10px] uppercase tracking-widest text-bone-faint">Ref {sessionId}</p>
          ) : null}
        </div>
      </Container>
    </div>
  );
}
