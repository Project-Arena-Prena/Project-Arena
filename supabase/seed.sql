-- Project Arena — deterministic Phase 1 seed. Safe to re-run.

insert into public.projects (
  name, slug, tagline, description, website_url, x_url, github_url, category,
  builder_email, status, arena_rating, total_supporters, total_project_visits,
  arena_appearances, championships, highest_rank
) values
  ('Drift', 'drift', 'Ambient focus sessions that adapt to your keystrokes.', 'Drift reads typing cadence and shapes a private soundscape around it.', 'https://drift.example', 'https://x.com/drift', null, 'AI', 'nova@drift.example', 'active', 2184, 4200, 11800, 9, 3, 1),
  ('Kernelpad', 'kernelpad', 'A scratchpad that compiles every language you paste into it.', 'Paste code, detect the language, and run it in an isolated sandbox.', 'https://kernelpad.example', 'https://x.com/kernelpad', 'https://github.com/kernelpad/app', 'Developer', 'ilya@kernelpad.example', 'active', 2071, 4129, 11586, 11, 2, 1),
  ('Nightmarket', 'nightmarket', 'A browser game where the economy is other players.', 'Every price is set by another player who wanted the same thing.', 'https://nightmarket.example', 'https://x.com/nightmarket', null, 'Games', 'sable@nightmarket.example', 'active', 1993, 4058, 11372, 6, 2, 1),
  ('Plumb', 'plumb', 'Trace any API request across your whole stack in one view.', 'One request id, every hop, rendered as a single readable trace.', 'https://plumb.example', 'https://x.com/plumbdev', 'https://github.com/plumbdev/plumb', 'SaaS', 'harlow@plumb.example', 'active', 1948, 3987, 11158, 8, 1, 1),
  ('Glyphset', 'glyphset', 'Variable-font playground with real typographic controls.', 'A precise specimen tool for variable fonts and print-ready output.', 'https://glyphset.example', 'https://x.com/glyphset', null, 'Design', 'mireia@glyphset.example', 'active', 1902, 3916, 10944, 7, 1, 1),
  ('Tallyhouse', 'tallyhouse', 'Open-source ledger for small collectives.', 'Self-hosted double-entry bookkeeping without accounting jargon.', 'https://tallyhouse.example', 'https://x.com/tallyhouse', 'https://github.com/tallyhouse/core', 'Open Source', 'oro@tallyhouse.example', 'active', 1877, 3845, 10730, 10, 1, 1),
  ('Moth', 'moth', 'Turns your camera roll into a private, searchable archive.', 'On-device indexing makes ten years of photographs searchable.', 'https://moth.example', 'https://x.com/mothapp', null, 'Mobile', 'kiva@moth.example', 'active', 1841, 3774, 10516, 5, 1, 1),
  ('Stagelight', 'stagelight', 'Live audience reactions for creators, without the chat noise.', 'A reaction rail that turns a crowd into signal instead of scroll.', 'https://stagelight.example', 'https://x.com/stagelight', null, 'Creator', 'ren@stagelight.example', 'active', 1812, 3703, 10302, 6, 0, 2),
  ('Signalcast', 'signalcast', 'Turn changelogs into short video briefings.', 'Product updates become concise narrated clips in a few minutes.', 'https://signalcast.example', 'https://x.com/signalcast', null, 'AI', 'petra@signalcast.example', 'active', 1715, 3492, 9855, 6, 0, 2),
  ('Lathe', 'lathe', 'Shape SQL queries visually, then ship them as endpoints.', 'A visual data pipeline with inspectable SQL at every step.', 'https://lathe.example', 'https://x.com/lathedev', 'https://github.com/lathedev/lathe', 'Developer', 'casper@lathe.example', 'active', 1690, 3374, 9550, 4, 0, 3),
  ('Orbitfeed', 'orbitfeed', 'A feed reader ranked by how long you actually read.', 'Attention, not likes, trains a calm personal reading queue.', 'https://orbitfeed.example', 'https://x.com/orbitfeed', null, 'SaaS', 'lior@orbitfeed.example', 'active', 1662, 3256, 9245, 5, 0, 3),
  ('Paperclip', 'paperclip', 'Clip anything on the web into a citable permanent note.', 'Every note keeps its source, timestamp, and a durable snapshot.', 'https://paperclip.example', 'https://x.com/paperclip', null, 'Creator', 'mei@paperclip.example', 'active', 1634, 3138, 8940, 3, 0, 3),
  ('Foundry UI', 'foundry-ui', 'Components generated from your own design tokens.', 'Turn a token set into accessible production React components.', 'https://foundryui.example', 'https://x.com/foundryui', 'https://github.com/foundryui/core', 'Design', 'yusuf@foundryui.example', 'active', 1557, 3020, 8635, 4, 0, 3),
  ('Ferrite', 'ferrite', 'Rust-powered static analysis as a GitHub check.', 'Fast, configurable code analysis that explains every finding.', 'https://ferrite.example', 'https://x.com/ferritedev', 'https://github.com/ferrite/ferrite', 'Open Source', 'anouk@ferrite.example', 'active', 1531, 2902, 8330, 3, 0, 4),
  ('Sunk City', 'sunkcity', 'A text roguelike played through a terminal in your tab.', 'A strange drowned city, one command and one dangerous choice at a time.', 'https://sunkcity.example', 'https://x.com/sunkcitygame', null, 'Games', 'bruno@sunkcity.example', 'active', 1504, 2784, 8025, 2, 0, 4),
  ('Atlasnote', 'atlasnote', 'Notes arranged on a map of what you were doing.', 'Place and context organize your thoughts without manual folders.', 'https://atlasnote.example', 'https://x.com/atlasnote', null, 'Mobile', 'nikhil@atlasnote.example', 'active', 1401, 2666, 7720, 2, 0, 5)
on conflict (slug) do update set
  tagline = excluded.tagline,
  description = excluded.description,
  website_url = excluded.website_url,
  x_url = excluded.x_url,
  github_url = excluded.github_url,
  category = excluded.category;

insert into public.arenas (
  name, slug, number, description, category, starts_at, ends_at, status,
  registration_opens_at, registration_closes_at, max_entries, entry_price, spectators, eligibility_text
) values
  ('Launch Arena #000', 'launch-arena-000', 0, 'The first Arena. Everything was allowed.', 'Open', now() - interval '24 days', now() - interval '22 days', 'finished', now() - interval '31 days', now() - interval '24 days', 32, 1900, 12904, 'Any internet project with a public URL.'),
  ('Open Arena #001', 'open-arena-001', 1, 'Open category. Any internet project. No rules beyond the clock.', 'Open', now() - interval '40 hours', now() + interval '8 hours', 'live', now() - interval '10 days', now() - interval '40 hours', 32, 1900, 18421, 'Any internet project with a public URL.'),
  ('Open Arena #002', 'open-arena-002', 2, 'Any internet project. Thirty-two spots. The next open field.', 'Open', now() + interval '8 days', now() + interval '10 days', 'registration', now() - interval '2 days', now() + interval '8 days', 32, 2900, 0, 'Any internet project with a public URL.')
on conflict (slug) do update set
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  status = excluded.status,
  category = excluded.category,
  registration_opens_at = excluded.registration_opens_at,
  registration_closes_at = excluded.registration_closes_at,
  max_entries = excluded.max_entries,
  entry_price = excluded.entry_price,
  spectators = excluded.spectators,
  eligibility_text = excluded.eligibility_text;

insert into public.arena_entries (arena_id, project_id, status, supporter_count, unique_visit_count)
select a.id, p.id, 'competing', seeded.supporters, seeded.visits
from (values
  ('drift', 3842, 2180), ('kernelpad', 3721, 2054), ('nightmarket', 3498, 1911),
  ('plumb', 3220, 1782), ('glyphset', 3014, 1640), ('tallyhouse', 2841, 1512),
  ('moth', 2698, 1405), ('stagelight', 2510, 1311), ('signalcast', 2328, 1217),
  ('lathe', 2140, 1122), ('orbitfeed', 1998, 1035), ('paperclip', 1871, 954),
  ('foundry-ui', 1734, 876), ('ferrite', 1602, 798), ('sunkcity', 1498, 722),
  ('atlasnote', 1364, 655)
) as seeded(slug, supporters, visits)
join public.projects p on p.slug = seeded.slug
cross join public.arenas a
where a.slug = 'open-arena-001'
on conflict (arena_id, project_id) do update set
  status = 'competing', supporter_count = excluded.supporter_count,
  unique_visit_count = excluded.unique_visit_count;

insert into public.arena_entries (arena_id, project_id, status, supporter_count, unique_visit_count, final_rank)
select a.id, p.id, 'finished', seeded.supporters, seeded.visits, seeded.final_rank
from (values
  ('kernelpad', 2913, 1410, 1), ('drift', 2817, 1350, 2), ('plumb', 2604, 1240, 3),
  ('tallyhouse', 2388, 1120, 4), ('nightmarket', 2201, 1015, 5), ('glyphset', 2044, 940, 6),
  ('stagelight', 1877, 862, 7), ('moth', 1711, 790, 8)
) as seeded(slug, supporters, visits, final_rank)
join public.projects p on p.slug = seeded.slug
cross join public.arenas a
where a.slug = 'launch-arena-000'
on conflict (arena_id, project_id) do update set
  status = 'finished', supporter_count = excluded.supporter_count,
  unique_visit_count = excluded.unique_visit_count, final_rank = excluded.final_rank;

insert into public.arena_entries (arena_id, project_id, status)
select a.id, p.id, 'approved'
from public.projects p cross join public.arenas a
where a.slug = 'open-arena-002'
on conflict (arena_id, project_id) do nothing;
