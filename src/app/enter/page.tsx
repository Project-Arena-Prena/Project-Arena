import type { Metadata } from 'next';
import { AlertCircle } from 'lucide-react';
import { EntryForm } from './entry-form';
import { Container, Label } from '@/components/ui';
import { getArenas } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Enter',
  description:
    'Put your project in the Arena. Any internet project — AI, SaaS, games, apps, open source, tools, communities, experiments.',
  openGraph: {
    title: 'Enter an Arena — Project Arena',
    description: 'Put your project in the Arena.',
    type: 'website',
  },
};

const STEPS = [
  { index: '01', title: 'Entry', body: 'Checkout clears. Your slot on the grid is held under your name.' },
  { index: '02', title: 'Seeded', body: 'Your Project is placed on the grid with its rating and record.' },
  { index: '03', title: 'Live', body: 'The clock runs. Supporters and clicks move you up the board.' },
  { index: '04', title: 'Result', body: 'Standings lock. Arena Rating updates. The Champion is recorded.' },
];

export default async function EnterPage({
  searchParams,
}: {
  searchParams: Promise<{ arena?: string; canceled?: string }>;
}) {
  const { arena, canceled } = await searchParams;
  const { live, upcoming } = await getArenas();
  const selectable = [...live, ...upcoming];

  return (
    <div className="pb-20">
      <section className="border-b hairline">
        <Container className="flex flex-col gap-5 py-10 sm:py-14">
          <Label>Enter</Label>
          <h1 className="max-w-3xl text-[34px] font-semibold leading-[0.95] tracking-headline sm:text-5xl lg:text-6xl">
            Put your project in the Arena.
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-bone-dim sm:text-base">
            Any internet project. AI, SaaS, games, apps, open source, tools, communities, experiments.
          </p>
          {canceled ? (
            <div className="flex items-center gap-2.5 border border-arena/30 bg-arena/[0.06] px-3 py-2.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-arena" />
              <p className="font-mono text-[10px] uppercase tracking-widest text-bone-dim">
                Checkout canceled. Your project was not entered.
              </p>
            </div>
          ) : null}
        </Container>
      </section>

      <Container className="py-10 sm:py-12">
        <EntryForm arenas={selectable} initialArenaSlug={arena} />
      </Container>

      <Container>
        <div className="flex flex-col gap-4 border-t hairline pt-8">
          <Label>After Entry</Label>
          <ol className="grid grid-cols-1 border-l border-t hairline sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.index} className="flex flex-col gap-2.5 border-b border-r hairline p-4 sm:p-5">
                <div className="flex items-baseline gap-2.5">
                  <span className="num text-[10px] tracking-widest text-arena">{step.index}</span>
                  <Label className="text-bone">{step.title}</Label>
                </div>
                <p className="text-xs leading-relaxed text-bone-dim">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </div>
  );
}
