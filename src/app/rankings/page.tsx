import { Container } from '@/components/ui';
import { Leaderboard } from '@/components/leaderboard';
import { ArenaRefresh } from '@/components/founding/arena-refresh';
import { getArena, getStandings, getFinalArenaStandings } from '@/lib/queries';
import { getServerNow } from '@/lib/server-clock';
import { foundingPhase } from '@/lib/founding';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rankings', alternates: { canonical: '/rankings' } };
export default async function RankingsPage() {
  const [arena, now] = await Promise.all([getArena('founding'), getServerNow()]);
  const phase = foundingPhase(arena, now);
  const standings = phase === 'completed' ? await getFinalArenaStandings('founding') : phase === 'live' ? await getStandings('founding') : [];
  return <Container className="founding-section"><ArenaRefresh /><p className="founding-eyebrow">The Founding Arena</p><h1 className="statement mt-6">{phase === 'completed' ? 'The final record.' : 'Watch what rises.'}</h1><div className="mt-12">{standings.length ? <Leaderboard standings={standings} arenaSlug="founding" live={phase === 'live'} interactive={phase === 'live'} championProjectId={arena?.championProjectId} /> : <div className="quiet-board"><p className="quiet-board-title">{phase === 'finalizing' ? 'Results are being verified.' : phase === 'completed' ? 'The final record is not available yet.' : phase === 'live' ? 'The board is getting ready.' : 'The Arena is quiet.'}</p><p className="founding-copy">Rankings reflect verified competition activity. Entry never buys rank.</p></div>}</div></Container>;
}
