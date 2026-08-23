import type { Metadata } from 'next';
import Link from 'next/link';
import { requireBuilder } from '@/lib/auth';
import { getBuilderDashboard } from '@/lib/builder-queries';
import { getBuilderPrenaSummary, listBuilderRewards } from '@/services/rewards';
import { getBuilderPrenaBenefits } from '@/services/benefits';
import { getBuilderWallets } from '@/services/wallet';
import { getPrenaActivity } from '@/services/activity';
import { PrenaDashboardPanel } from '@/components/prena/prena-dashboard-panel';
import { PrenaActivityList } from '@/components/prena/prena-activity-list';
import { RewardsPanel } from '@/components/prena/rewards-panel';

import {
  ButtonLink,
  Container,
  EmptyState,
  Label,
  Panel,
  SectionHeader,
  StatusBadge,
} from '@/components/ui';
import { Countdown } from '@/components/countdown';
import { Reveal } from '@/components/reveal';
import { formatMoney, formatNumber, formatRank } from '@/lib/format';
import { shareText, xIntentUrl } from '@/lib/share';
import { siteUrl } from '@/lib/stripe';

export const metadata: Metadata = {
  title: 'Builder Dashboard',
  description: 'What is my Project competing in, and is Project Arena delivering value?',
};

export default async function DashboardPage() {
  const ctx = await requireBuilder('/dashboard');
  const { projects, live, upcoming, entries } = await getBuilderDashboard(ctx.builder.id);
  const next = upcoming.find((arena) => arena.status === 'registration') ?? upcoming[0] ?? null;

  const [prenaSummary, prenaBenefits, wallets, rewards, activity] = await Promise.all([
    getBuilderPrenaSummary(ctx.builder.id),
    getBuilderPrenaBenefits(ctx.builder.id),
    getBuilderWallets(ctx.builder.id),
    listBuilderRewards(ctx.builder.id, ['claimable', 'approved', 'pending']),
    getPrenaActivity(ctx.builder.id, { limit: 3 }),
  ]);
  const hasWallet = wallets.some((wallet) => wallet.verifiedAt);
  const showPrena = hasWallet || Number(prenaSummary.earned) > 0 || activity.length > 0;

  return (
    <>
      <section className="border-b hairline">
        <Container className="py-10 lg:py-12">
          <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-3">
              <Label>Builder Dashboard</Label>
              <h1 className="text-[42px] font-semibold leading-[0.9] tracking-headline sm:text-5xl">
                Your projects
              </h1>
              <p className="max-w-xl text-sm text-bone-dim">
                What is competing, what it delivered, and where you enter next.
              </p>
            </div>
            <ButtonLink href="/dashboard/projects/new" size="lg" className="w-full sm:w-auto">
              Create Project
            </ButtonLink>
          </Reveal>
        </Container>
      </section>

      {projects.length === 0 ? (
        <Container className="pt-16">
          <EmptyState
            title="You haven't created a project yet"
            hint="A Project is what competes. Create one, then enter an Arena."
          />
          <div className="mt-6 flex justify-center">
            <ButtonLink href="/dashboard/projects/new" size="lg">
              Create your first Project
            </ButtonLink>
          </div>
        </Container>
      ) : (
        <>
          <Container className="pt-10">
            <SectionHeader eyebrow="Roster" title="Your Projects" />
            <Panel>
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex flex-col gap-3 border-b hairline px-5 py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="text-lg font-medium tracking-tight hover:text-arena"
                    >
                      {project.name}
                    </Link>
                    <p className="mt-1 text-xs text-bone-faint">{project.category}</p>
                  </div>
                  <div className="flex flex-col gap-1 sm:items-end">
                    <Label>Arena Rating</Label>
                    <span className="num text-2xl">{formatNumber(project.arenaRating)}</span>
                  </div>
                </div>
              ))}
            </Panel>
          </Container>

          {rewards.length > 0 ? (
            <Container className="pt-12">
              <SectionHeader eyebrow="Earned" title="Rewards" />
              <RewardsPanel rewards={rewards} />
            </Container>
          ) : null}

          <Container className="pt-12">
            <PrenaDashboardPanel
              summary={prenaSummary}
              benefits={prenaBenefits}
              hasWallet={hasWallet}
            />
            {showPrena && activity.length > 0 ? (
              <div className="mt-6">
                <SectionHeader eyebrow="Recent activity" title="$PRENA" />
                <PrenaActivityList items={activity} />
              </div>
            ) : null}
          </Container>

          <Container className="pt-12">
            <SectionHeader eyebrow="Now" title="Live now" />
            {live.length === 0 ? (
              <EmptyState title="No live entries" hint="When an Arena starts, your rank lands here." />
            ) : (
              <div className="flex flex-col gap-6">
                {live.map(({ project, arena, standing, movement }) => {
                  const url = `${siteUrl()}/arena/${arena.slug}`;
                  const text = shareText('live', {
                    projectName: project.name,
                    arenaName: arena.name,
                    rank: standing.rank,
                    url,
                  });
                  return (
                    <Panel key={`${project.id}:${arena.id}`}>
                      <div className="flex items-center justify-between gap-3 border-b hairline px-5 py-3">
                        <span className="font-mono text-xs uppercase tracking-widest">{arena.name}</span>
                        <StatusBadge status="live" />
                      </div>
                      <div className="grid grid-cols-2 gap-6 px-5 py-6 md:grid-cols-4">
                        <div>
                          <Label>Current rank</Label>
                          <p className="num mt-2 text-4xl text-bone">#{formatRank(standing.rank)}</p>
                          <p className={`mt-2 font-mono text-[10px] uppercase tracking-widest ${movement > 0 ? 'text-gain' : movement < 0 ? 'text-arena' : 'text-bone-faint'}`}>
                            {movement > 0 ? `↑ ${movement} positions` : movement < 0 ? `↓ ${Math.abs(movement)} positions` : 'No move'}
                          </p>
                        </div>
                        <div>
                          <Label>Points</Label>
                          <p className="num mt-2 text-2xl">{formatNumber(standing.score)}</p>
                        </div>
                        <div>
                          <Label>Supporters</Label>
                          <p className="num mt-2 text-2xl">{formatNumber(standing.supporters)}</p>
                        </div>
                        <div>
                          <Label>Project visits</Label>
                          <p className="num mt-2 text-2xl">{formatNumber(standing.clicks)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 border-t hairline px-5 py-4">
                        <ButtonLink href={`/arena/${arena.slug}`} size="sm">
                          View live
                        </ButtonLink>
                        <ButtonLink
                          href={`/dashboard/projects/${project.id}/arenas/${arena.id}`}
                          variant="secondary"
                          size="sm"
                        >
                          View performance
                        </ButtonLink>
                        <a
                          href={xIntentUrl(text)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center border border-white/15 px-3 font-mono text-[10px] uppercase tracking-widest text-bone-dim hover:text-bone"
                        >
                          Share ranking
                        </a>
                      </div>
                    </Panel>
                  );
                })}
              </div>
            )}
          </Container>

          <Container className="pt-12">
            <SectionHeader eyebrow="Next" title="Upcoming" />
            {next ? (
              <Panel>
                <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold tracking-headline">{next.name}</h3>
                    <p className="mt-2 text-xs text-bone-faint">{next.category}</p>
                    <div className="mt-4 flex flex-wrap gap-6">
                      <div>
                        <Label>Starts</Label>
                        <div className="mt-2">
                          <Countdown target={next.startsAt} size="sm" showDays />
                        </div>
                      </div>
                      <div>
                        <Label>Spots</Label>
                        <p className="num mt-2 text-sm">
                          {next.entrantCount} / {next.entrantCap} filled
                        </p>
                      </div>
                      <div>
                        <Label>Entry</Label>
                        <p className="num mt-2 text-sm">
                          {next.entryFeeCents === 0 ? 'Free' : formatMoney(next.entryFeeCents)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <ButtonLink
                    href={next.status === 'registration' ? `/enter?arena=${next.slug}` : `/arena/${next.slug}`}
                    size="lg"
                    className="w-full sm:w-auto"
                  >
                    {next.status === 'registration' ? 'Enter Arena' : 'View Arena'}
                  </ButtonLink>
                </div>
              </Panel>
            ) : (
              <EmptyState title="No Arenas open yet" hint="The next competition is being prepared." />
            )}
          </Container>

          {entries.some((item) => item.entry.status === 'pending_review') ? (
            <Container className="pt-12">
              <SectionHeader eyebrow="Review" title="Pending review" />
              <Panel>
                {entries
                  .filter((item) => item.entry.status === 'pending_review')
                  .map((item) => (
                    <div key={item.entry.id} className="border-b hairline px-5 py-4 last:border-b-0">
                      <p className="font-mono text-xs uppercase tracking-widest">{item.arena.name}</p>
                      <p className="mt-2 text-sm text-bone-dim">
                        {item.project.name} — payment confirmed. Your Project will appear when approved.
                      </p>
                    </div>
                  ))}
              </Panel>
            </Container>
          ) : null}
        </>
      )}
    </>
  );
}
