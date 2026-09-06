import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foundingPhase } from '../../src/lib/founding';
import { arenaFromRow } from '../../src/lib/mappers';
const now = Date.UTC(2026, 8, 7);
const arena = arenaFromRow({ status: 'registration', starts_at: new Date(now + 86400000).toISOString(), ends_at: new Date(now + 172800000).toISOString(), max_entries: 24 });
test('missing and draft events do not imply open entry', () => {
  assert.equal(foundingPhase(null, now), 'draft');
  assert.equal(foundingPhase({ ...arena, status: 'draft' }, now + 999999999), 'draft');
});
test('deadlines and capacity can only close entry', () => {
  assert.equal(foundingPhase(arena, now), 'open');
  assert.equal(foundingPhase(arena, now + 86400000), 'entry_closed');
  assert.equal(foundingPhase({ ...arena, entrantCount: 24 }, now), 'entry_closed');
  assert.equal(foundingPhase({ ...arena, registrationClosesAt: new Date(now).toISOString() }, now), 'entry_closed');
});
test('live completion waits for authoritative finalization', () => {
  assert.equal(foundingPhase({ ...arena, status: 'live' }, now), 'live');
  assert.equal(foundingPhase({ ...arena, status: 'live' }, now + 172800000), 'finalizing');
  assert.equal(foundingPhase({ ...arena, status: 'finished' }, now), 'completed');
  assert.equal(foundingPhase({ ...arena, status: 'cancelled' }, now), 'cancelled');
});
test('pending review occupies capacity but never counts as accepted', () => {
  const mapped = arenaFromRow({ arena_entries: [{ status: 'pending_review' }, { status: 'approved' }, { status: 'competing' }, { status: 'finished' }, { status: 'rejected' }] });
  assert.equal(mapped.entrantCount, 3);
  assert.equal(mapped.acceptedCount, 3);
});
