import { EventSummary } from '@/components/founding/event-summary';
import { Leaderboard } from '@/components/leaderboard';
import { LiveEntryCard } from '@/components/dashboard/live-entry-card';
import { EntryFlow } from '@/app/enter/entry-flow';
import { Container } from '@/components/ui';
import { arenaFromRow, projectFromRow } from '@/lib/mappers';
import type { Arena, Standing } from '@/lib/types';
import { getServerNow } from '@/lib/server-clock';
import { ProjectForm } from '@/components/dashboard/project-form';

export const metadata = { robots: { index: false, follow: false } };

// Development only, following the existing wallet harness convention.
// These fixtures never enter Supabase and this route is absent from production.
export default async function FoundingHarness({ searchParams }: { searchParams: Promise<{ phase?: string; view?: string }> }) {
  const { phase = 'open', view } = await searchParams;
  if (view === 'project') return <Container className="founding-section"><h1>Project form verification</h1><div className="mt-8 max-w-2xl"><ProjectForm /></div></Container>;
  const now = await getServerNow();
  const arena: Arena = arenaFromRow({
    id: 'test-arena', slug: 'founding', name: 'The Founding Arena',
    status: phase === 'completed' ? 'finished' : phase === 'live' || phase === 'finalizing' ? 'live' : phase === 'draft' ? 'draft' : 'registration',
    lifecycle_phase: phase, max_entries: 24, entry_price: 0,
    starts_at: new Date(now + 86400000).toISOString(),
    ends_at: new Date(now + 8 * 86400000).toISOString(),
    arena_entries: [{ status: 'approved' }],
  });
  const project = projectFromRow({ id: 'test-project', name: 'Test Contender', slug: 'test-contender', tagline: 'Development fixture for competition UI verification.', category: 'Developer', website_url: 'https://example.com' });
  const standing: Standing = { rank: 4, previousRank: 7, project, supporters: 326, clicks: 1842, impressions: 6140, score: 4010, share: 12.4, momentum: 3 };
  return <Container className="founding-section"><h1>Development verification</h1><EventSummary arena={phase === 'draft' ? null : arena} now={now} /><div className="my-16"><Leaderboard standings={[standing]} arenaSlug="founding" live={phase === 'live'} interactive={phase === 'live'} /></div><div className="my-16"><EntryFlow arenas={[arena]} projects={[project]} serverNow={now} /></div><LiveEntryCard project={project} arena={arena} standing={standing} movement={3} /></Container>;
}
