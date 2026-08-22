-- Project Arena — seed data. Run after supabase/schema.sql.
-- Deterministic: fixed values only, no random(). Safe to re-run.
-- Arena windows are relative to now() so the live Arena is actually live.

-- ---------------------------------------------------------------- builders

insert into public.builders (handle, display_name) values
  ('nova',   'Nova Adeyemi'),
  ('ilya',   'Ilya Renko'),
  ('sable',  'Sable Okonkwo'),
  ('harlow', 'Harlow Vance'),
  ('mireia', 'Mireia Costa'),
  ('oro',    'Oro Batiste'),
  ('kiva',   'Kiva Lindqvist'),
  ('ren',    'Ren Oyelaran')
on conflict (handle) do nothing;

-- ---------------------------------------------------------------- projects

insert into public.projects (slug, name, tagline, description, url, category, builder_id, arena_rating, appearances, wins, podiums, total_supporters, total_clicks)
select v.slug, v.name, v.tagline, v.description, v.url, v.category::project_category, b.id,
       v.rating, v.appearances, v.wins, v.podiums, v.supporters, v.clicks
from (values
  ('drift', 'Drift', 'Ambient focus sessions that adapt to your keystrokes.',
   'Drift reads typing cadence and shapes a soundscape around it. Built in the open, entered in every Arena since the first.',
   'https://drift.example', 'AI', 'nova', 2184, 8, 3, 5, 4200, 11800),
  ('kernelpad', 'Kernelpad', 'A scratchpad that compiles every language you paste into it.',
   'Paste anything. Kernelpad detects the language, compiles it in a sandbox, and hands back output in under a second.',
   'https://kernelpad.example', 'Dev Tool', 'ilya', 2071, 10, 2, 6, 4129, 11586),
  ('nightmarket', 'Nightmarket', 'A browser game where the economy is other players.',
   'No servers full of loot. Every price in Nightmarket is set by somebody else who wanted the same thing.',
   'https://nightmarket.example', 'Game', 'sable', 1993, 5, 2, 3, 4058, 11372),
  ('plumb', 'Plumb', 'Trace any API request across your whole stack in one view.',
   'One request id, every hop. Plumb stitches gateway, service, and database traces into a single readable line.',
   'https://plumb.example', 'SaaS', 'harlow', 1948, 7, 1, 4, 3987, 11158),
  ('glyphset', 'Glyphset', 'Variable-font playground with real typographic controls.',
   'Optical size, grade, and width as first-class controls, with specimen output you can hand to a printer.',
   'https://glyphset.example', 'Design', 'mireia', 1902, 6, 1, 3, 3916, 10944),
  ('tallyhouse', 'Tallyhouse', 'Open-source ledger for small collectives.',
   'Double-entry bookkeeping for people who never wanted to learn double-entry bookkeeping. Self-hosted, auditable.',
   'https://tallyhouse.example', 'Open Source', 'oro', 1877, 9, 1, 4, 3845, 10730),
  ('moth', 'Moth', 'Turns your camera roll into a private, searchable archive.',
   'On-device indexing, no upload. Moth makes ten years of photographs searchable without leaving the phone.',
   'https://moth.example', 'Mobile', 'kiva', 1841, 4, 1, 2, 3774, 10516),
  ('stagelight', 'Stagelight', 'Live audience reactions for creators, without the chat noise.',
   'A reaction rail instead of a chat column. Signal from ten thousand viewers, none of the scroll.',
   'https://stagelight.example', 'Creator', 'ren', 1812, 5, 0, 2, 3703, 10302)
) as v(slug, name, tagline, description, url, category, handle, rating, appearances, wins, podiums, supporters, clicks)
join public.builders b on b.handle = v.handle
on conflict (slug) do nothing;

-- ---------------------------------------------------------------- arenas

insert into public.arenas (slug, number, name, theme, status, starts_at, ends_at, entry_fee_cents, entrant_cap, spectators, visits, prize) values
  ('launch-000', 0, 'Launch Arena #000',
   'The first Arena. Everything was allowed.',
   'live', now() - interval '24 days', now() - interval '21 days',
   2900, 32, 12904, 5382, 'Champion badge, Hall of Fame entry'),
  ('open-001', 1, 'Open Arena #001',
   'Open category. Any internet project. No rules beyond the clock.',
   'live', now() - interval '3 days', now() + interval '4 hours',
   4900, 48, 18421, 7194, 'Champion badge, permanent Hall of Fame entry, homepage feature for 7 days'),
  ('ai-002', 2, 'AI Arena #002',
   'Projects where a model does the work, not the marketing.',
   'upcoming', now() + interval '2 days', now() + interval '5 days',
   5900, 48, 0, 0, 'Champion badge, Hall of Fame entry, homepage feature for 7 days')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------- entries

-- Live Arena: the full field.
insert into public.entries (arena_id, project_id, paid, supporters, clicks)
select a.id, p.id, true, v.supporters, v.clicks
from (values
  ('drift', 742, 1893),
  ('kernelpad', 701, 1804),
  ('nightmarket', 688, 1611),
  ('plumb', 654, 1502),
  ('glyphset', 611, 1444),
  ('tallyhouse', 572, 1318),
  ('moth', 538, 1207),
  ('stagelight', 496, 1120)
) as v(slug, supporters, clicks)
join public.projects p on p.slug = v.slug
cross join public.arenas a
where a.slug = 'open-001'
on conflict (arena_id, project_id) do nothing;

-- Upcoming Arena: entries land before the clock starts.
insert into public.entries (arena_id, project_id, paid, supporters, clicks)
select a.id, p.id, true, 0, 0
from public.projects p
cross join public.arenas a
where a.slug = 'ai-002'
  and p.slug in ('drift', 'kernelpad', 'plumb')
on conflict (arena_id, project_id) do nothing;

-- Past Arena: seeded with its final numbers, then settled below.
insert into public.entries (arena_id, project_id, paid, supporters, clicks)
select a.id, p.id, true, v.supporters, v.clicks
from (values
  ('kernelpad', 913, 2410),
  ('drift', 897, 2288),
  ('plumb', 804, 2077),
  ('tallyhouse', 766, 1902),
  ('nightmarket', 731, 1855),
  ('glyphset', 690, 1744),
  ('stagelight', 612, 1533),
  ('moth', 588, 1421)
) as v(slug, supporters, clicks)
join public.projects p on p.slug = v.slug
cross join public.arenas a
where a.slug = 'launch-000'
on conflict (arena_id, project_id) do nothing;

-- ---------------------------------------------------------------- settle the past Arena

-- Writes final_rank, applies the rating deltas, and flips status to 'ended'. No-op on re-run.
select public.finalize_arena('launch-000');
