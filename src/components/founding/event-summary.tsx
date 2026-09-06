import type { Arena } from '@/lib/types';
import { foundingAction, foundingPhase, PHASE_LABEL } from '@/lib/founding';
import { formatMoney } from '@/lib/format';
import { ButtonLink } from '@/components/ui';
import { Countdown } from '@/components/countdown';

const DESCRIPTION = {
  draft: 'The first field is being prepared. Entry details and dates will appear when they are confirmed.',
  open: 'Bring your Project to the first field. Review the details, submit your entry, and await acceptance.',
  entry_closed: 'Entry is closed. The accepted field is preparing to compete.',
  live: 'Discover the work. Support what matters. Watch earned attention move the field.',
  finalizing: 'Competition has ended. The final record will appear after results are verified.',
  completed: 'The competition is complete. Explore the permanent record of earned attention.',
  cancelled: 'This event has been cancelled. Entry is closed.',
};
export function EventSummary({ arena, now }: { arena: Arena | null; now: number }) {
  const phase = foundingPhase(arena, now);
  const action = foundingAction(phase);
  const confirmed = arena && phase !== 'draft';
  const target = phase === 'live' ? arena?.endsAt : phase === 'open' || phase === 'entry_closed' ? arena?.startsAt : null;
  return <div>
    <p className="founding-eyebrow"><span className={phase === 'live' ? 'event-light live' : 'event-light'} />Founding Event · {PHASE_LABEL[phase]}</p>
    <h2 className="event-title">The Founding<br /><em>Arena.</em></h2>
    <p className="founding-copy max-w-xl">{DESCRIPTION[phase]}</p>
    {confirmed ? <dl className="event-facts">
      <div><dt>Entry</dt><dd>{arena.entryFeeCents === 0 ? 'Free' : formatMoney(arena.entryFeeCents)}</dd></div>
      <div><dt>Accepted Projects</dt><dd>{arena.acceptedCount ?? 0}</dd></div>
      <div><dt>Field capacity</dt><dd>{arena.entrantCap}</dd></div>
    </dl> : null}
    {confirmed ? <p className="founding-copy mt-6">Starts {new Date(arena.startsAt).toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC · Ends {new Date(arena.endsAt).toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC</p> : null}
    {target && Date.parse(target) > now ? <div className="mt-8"><p className="founding-eyebrow mb-4">{phase === 'live' ? 'Competition ends in' : 'Scheduled start in'}</p><Countdown target={target} serverNow={now} showDays /></div> : null}
    <ButtonLink href={action.href} size="lg" className="mt-9">{action.label}</ButtonLink>
    <p className="founding-copy mt-5">Entry buys participation. Rank is earned.</p>
  </div>;
}
