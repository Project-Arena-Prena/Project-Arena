import { randomUUID } from 'node:crypto';
import { createAdminClient } from './supabase/server';
import { calculateArenaScore } from './scoring';

export interface DryRunReport {
  arenaId: string;
  arenaSlug: string;
  phases: string[];
  field: Array<{
    name: string;
    slug: string;
    rank: number;
    score: number;
    supporters: number;
    visits: number;
    ratingBefore: number;
    ratingChange: number | null;
    ratingAfter: number;
    champion: boolean;
  }>;
  champion: string;
  frozen: boolean;
}

const FIELD = [
  { name: 'Kinetix', slug: 'dry-run-kinetix', supporters: 48, visits: 36 },
  { name: 'TinyTools', slug: 'dry-run-tinytools', supporters: 31, visits: 22 },
  { name: 'Relaykit', slug: 'dry-run-relaykit', supporters: 12, visits: 9 },
];

export async function runDatabaseArenaClock(): Promise<DryRunReport> {
  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error('Supabase is not configured. Apply schema.sql and set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY.');
  }

  const stamp = Date.now().toString(36);
  const slug = `dry-run-${stamp}`;
  const now = new Date();
  const starts = new Date(now.getTime() - 60_000);
  const ends = new Date(now.getTime() + 60 * 60_000);
  const phases: string[] = ['draft'];

  const { data: arena, error: arenaError } = await supabase
    .from('arenas')
    .insert({
      name: `DRY RUN #${stamp.slice(-4).toUpperCase()}`,
      slug,
      number: 0,
      description: 'Operator clock dry-run. Not a public competition.',
      category: 'Open',
      status: 'registration',
      visibility: 'unlisted',
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      registration_opens_at: new Date(now.getTime() - 120_000).toISOString(),
      registration_closes_at: starts.toISOString(),
      max_entries: 8,
      entry_price: 0,
      eligibility_text: 'Dry-run only.',
    })
    .select('id, slug')
    .single();
  if (arenaError || !arena) throw new Error(arenaError?.message ?? 'failed to create dry-run Arena');
  phases.push('registration');

  const projectIds: string[] = [];
  for (const row of FIELD) {
    const { data: existing } = await supabase.from('projects').select('id, arena_rating').eq('slug', row.slug).maybeSingle();
    if (existing) {
      // A previous run parks these as 'rejected' so they stay unlisted.
      // record_support and record_outbound_visit only accept active projects,
      // so reactivate before reusing the row.
      await supabase.from('projects').update({ status: 'active' }).eq('id', existing.id);
      projectIds.push(existing.id);
      continue;
    }
    const { data: created, error } = await supabase
      .from('projects')
      .insert({
        name: row.name,
        slug: row.slug,
        tagline: `${row.name} dry-run entrant.`,
        description: 'Created by the Arena clock dry-run. Safe to ignore.',
        website_url: `https://${row.slug}.example`,
        category: 'Other',
        builder_email: 'dry-run@projectarena.local',
        status: 'active',
        arena_rating: 1000,
      })
      .select('id')
      .single();
    if (error || !created) throw new Error(error?.message ?? `failed to create ${row.slug}`);
    projectIds.push(created.id);
  }

  for (let i = 0; i < FIELD.length; i += 1) {
    const { error } = await supabase.from('arena_entries').insert({
      arena_id: arena.id,
      project_id: projectIds[i],
      status: 'approved',
    });
    if (error) throw new Error(error.message);
  }

  const { error: startError } = await supabase.rpc('start_arena', { p_arena_id: arena.id });
  if (startError) throw new Error(startError.message);
  phases.push('live');

  for (let i = 0; i < FIELD.length; i += 1) {
    const row = FIELD[i];
    const project = await supabase.from('projects').select('slug').eq('id', projectIds[i]).maybeSingle();
    const projectSlug = project.data?.slug ?? row.slug;
    for (let n = 0; n < row.supporters; n += 1) {
      const { error } = await supabase.rpc('record_support', {
        p_project_slug: projectSlug,
        p_arena_slug: arena.slug,
        p_visitor_id: randomUUID(),
        p_ip_hash: null,
        p_ua_hash: null,
        p_session_id: null,
      });
      if (error) throw new Error(error.message);
    }
    for (let n = 0; n < row.visits; n += 1) {
      const { error } = await supabase.rpc('record_outbound_visit', {
        p_project_slug: projectSlug,
        p_arena_slug: arena.slug,
        p_visitor_id: randomUUID(),
        p_ip_hash: null,
        p_ua_hash: null,
        p_session_id: null,
      });
      if (error) throw new Error(error.message);
    }
  }

  await supabase.from('arenas').update({ ends_at: new Date(Date.now() - 1000).toISOString() }).eq('id', arena.id);
  const { error: endError } = await supabase.rpc('finalize_arena_by_id', { p_arena_id: arena.id });
  if (endError) throw new Error(endError.message);
  phases.push('finished');

  const { data: standings } = await supabase
    .from('arena_standings')
    .select('project_name, project_slug, project_id, rank, score, supporter_count, unique_visit_count, arena_rating')
    .eq('arena_slug', arena.slug)
    .order('rank');

  const { data: ratings } = await supabase
    .from('arena_rating_history')
    .select('project_id, rating_before, rating_change, rating_after')
    .eq('arena_id', arena.id);

  const ratingByProject = new Map(
    ((ratings ?? []) as Array<{ project_id: string; rating_before: number; rating_change: number; rating_after: number }>).map(
      (row) => [row.project_id, row],
    ),
  );

  const field = ((standings ?? []) as Array<Record<string, unknown>>).map((row) => {
    const id = String(row.project_id);
    const history = ratingByProject.get(id);
    return {
      name: String(row.project_name),
      slug: String(row.project_slug),
      rank: Number(row.rank),
      score: Number(row.score),
      supporters: Number(row.supporter_count),
      visits: Number(row.unique_visit_count),
      ratingBefore: history?.rating_before ?? 1000,
      ratingChange: history?.rating_change ?? null,
      ratingAfter: history?.rating_after ?? Number(row.arena_rating),
      champion: Number(row.rank) === 1,
    };
  });

  const champion = field[0];
  if (!champion) throw new Error('dry-run produced no Champion');
  if (champion.name !== 'Kinetix') throw new Error(`expected Kinetix Champion, got ${champion.name}`);
  if (champion.score !== calculateArenaScore(48, 36)) throw new Error('Champion score does not match formula');
  if (champion.ratingChange !== 100) throw new Error('Champion rating change is not +100');

  return {
    arenaId: arena.id,
    arenaSlug: arena.slug,
    phases,
    field,
    champion: champion.name,
    frozen: true,
  };
}
