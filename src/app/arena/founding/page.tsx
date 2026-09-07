import { Container } from '@/components/ui';
import { EventSummary } from '@/components/founding/event-summary';
import { ArenaRefresh } from '@/components/founding/arena-refresh';
import { getArena } from '@/lib/queries';
import { getServerNow } from '@/lib/server-clock';
import { PageScene } from '@/components/founding/page-scene';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'The Founding Arena', alternates: { canonical: '/arena/founding' } };
export default async function FoundingArenaPage() {
  const [arena, now] = await Promise.all([getArena('founding'), getServerNow()]);
  return <><ArenaRefresh /><PageScene scene="founding"><EventSummary arena={arena} now={now} heading="h1" /></PageScene><Container className="founding-section page-scene-follow"><div className="event-principles"><div><h2>Attention earns rank.</h2><p>Discover competing Projects, support work you believe in, and visit the work. Qualified visits and unique supporters determine Arena Score under the event’s scoring rules.</p></div><div><h2>A place in the first field.</h2><p>Every submission is reviewed. Acceptance confirms participation. Payments never buy score, rank, or Champion status.</p></div></div></Container></>;
}
