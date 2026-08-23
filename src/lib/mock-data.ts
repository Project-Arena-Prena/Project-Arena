import type {
  Arena,
  ArenaResult,
  Builder,
  Project,
  ProjectCategory,
  ProjectHistoryEntry,
  Standing,
} from './types';
import { calculateArenaScore } from './scoring';

/**
 * Deterministic fixture layer. `src/lib/queries.ts` reads from Supabase when
 * configured and falls back to these values so the UI renders without a DB.
 */

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** The fixture clock is anchored when the server starts so the demo is always live. */
export const FIXTURE_EPOCH = Date.now();

function iso(offsetMs: number): string {
  return new Date(FIXTURE_EPOCH + offsetMs).toISOString();
}

function builder(handle: string, displayName: string): Builder {
  return { id: `bld_${handle}`, handle, displayName, avatarUrl: null };
}

interface Seed {
  slug: string;
  name: string;
  tagline: string;
  url: string;
  category: ProjectCategory;
  handle: string;
  builderName: string;
  rating: number;
  appearances: number;
  wins: number;
  podiums: number;
}

const SEEDS: Seed[] = [
  { slug: 'drift', name: 'Drift', tagline: 'Ambient focus sessions that adapt to your keystrokes.', url: 'https://drift.example', category: 'AI', handle: 'nova', builderName: 'Nova Adeyemi', rating: 2184, appearances: 9, wins: 3, podiums: 6 },
  { slug: 'kernelpad', name: 'Kernelpad', tagline: 'A scratchpad that compiles every language you paste into it.', url: 'https://kernelpad.example', category: 'Developer', handle: 'ilya', builderName: 'Ilya Renko', rating: 2071, appearances: 11, wins: 2, podiums: 7 },
  { slug: 'nightmarket', name: 'Nightmarket', tagline: 'A browser game where the economy is other players.', url: 'https://nightmarket.example', category: 'Games', handle: 'sable', builderName: 'Sable Okonkwo', rating: 1993, appearances: 6, wins: 2, podiums: 4 },
  { slug: 'plumb', name: 'Plumb', tagline: 'Trace any API request across your whole stack in one view.', url: 'https://plumb.example', category: 'SaaS', handle: 'harlow', builderName: 'Harlow Vance', rating: 1948, appearances: 8, wins: 1, podiums: 5 },
  { slug: 'glyphset', name: 'Glyphset', tagline: 'Variable-font playground with real typographic controls.', url: 'https://glyphset.example', category: 'Design', handle: 'mireia', builderName: 'Mireia Costa', rating: 1902, appearances: 7, wins: 1, podiums: 4 },
  { slug: 'tallyhouse', name: 'Tallyhouse', tagline: 'Open-source ledger for small collectives.', url: 'https://tallyhouse.example', category: 'Open Source', handle: 'oro', builderName: 'Oro Batiste', rating: 1877, appearances: 10, wins: 1, podiums: 5 },
  { slug: 'moth', name: 'Moth', tagline: 'Turns your camera roll into a private, searchable archive.', url: 'https://moth.example', category: 'Mobile', handle: 'kiva', builderName: 'Kiva Lindqvist', rating: 1841, appearances: 5, wins: 1, podiums: 3 },
  { slug: 'stagelight', name: 'Stagelight', tagline: 'Live audience reactions for creators, without the chat noise.', url: 'https://stagelight.example', category: 'Creator', handle: 'ren', builderName: 'Ren Oyelaran', rating: 1812, appearances: 6, wins: 0, podiums: 3 },
  { slug: 'vaultline', name: 'Vaultline', tagline: 'Onchain escrow that reads like a normal invoice.', url: 'https://vaultline.example', category: 'Web3', handle: 'tobias', builderName: 'Tobias Ferreira', rating: 1788, appearances: 7, wins: 0, podiums: 2 },
  { slug: 'commonroom', name: 'Commonroom', tagline: 'Small, slow, invite-only communities that stay small.', url: 'https://commonroom.example', category: 'Community', handle: 'ada', builderName: 'Ada Wren', rating: 1764, appearances: 4, wins: 0, podiums: 2 },
  { slug: 'halftone', name: 'Halftone', tagline: 'Print-accurate image dithering in the browser.', url: 'https://halftone.example', category: 'Other', handle: 'juno', builderName: 'Juno Park', rating: 1739, appearances: 5, wins: 0, podiums: 1 },
  { slug: 'signalcast', name: 'Signalcast', tagline: 'Turn changelogs into short video briefings.', url: 'https://signalcast.example', category: 'AI', handle: 'petra', builderName: 'Petra Volkov', rating: 1715, appearances: 6, wins: 0, podiums: 2 },
  { slug: 'lathe', name: 'Lathe', tagline: 'Shape SQL queries with a visual pipeline, ship them as endpoints.', url: 'https://lathe.example', category: 'Developer', handle: 'casper', builderName: 'Casper Nyland', rating: 1690, appearances: 4, wins: 0, podiums: 1 },
  { slug: 'orbitfeed', name: 'Orbitfeed', tagline: 'A feed reader that ranks by how long you actually read.', url: 'https://orbitfeed.example', category: 'SaaS', handle: 'lior', builderName: 'Lior Sandoval', rating: 1662, appearances: 5, wins: 0, podiums: 1 },
  { slug: 'paperclip', name: 'Paperclip', tagline: 'Clip anything on the web into a citable, permanent note.', url: 'https://paperclip.example', category: 'Creator', handle: 'mei', builderName: 'Mei Fontaine', rating: 1634, appearances: 3, wins: 0, podiums: 1 },
  { slug: 'brackets', name: 'Brackets', tagline: 'Run tournaments for anything, in a single link.', url: 'https://brackets.example', category: 'Community', handle: 'idris', builderName: 'Idris Kaan', rating: 1608, appearances: 4, wins: 0, podiums: 0 },
  { slug: 'quietmail', name: 'Quietmail', tagline: 'An inbox that only opens twice a day.', url: 'https://quietmail.example', category: 'SaaS', handle: 'rosa', builderName: 'Rosa Delgado', rating: 1583, appearances: 3, wins: 0, podiums: 0 },
  { slug: 'foundry-ui', name: 'Foundry UI', tagline: 'Component library generated from your own design tokens.', url: 'https://foundryui.example', category: 'Design', handle: 'yusuf', builderName: 'Yusuf Baran', rating: 1557, appearances: 4, wins: 0, podiums: 1 },
  { slug: 'ferrite', name: 'Ferrite', tagline: 'Rust-powered static analysis as a GitHub check.', url: 'https://ferrite.example', category: 'Open Source', handle: 'anouk', builderName: 'Anouk De Vries', rating: 1531, appearances: 3, wins: 0, podiums: 0 },
  { slug: 'sunkcity', name: 'Sunk City', tagline: 'A text roguelike played entirely through a terminal in your tab.', url: 'https://sunkcity.example', category: 'Games', handle: 'bruno', builderName: 'Bruno Salgado', rating: 1504, appearances: 2, wins: 0, podiums: 0 },
  { slug: 'pinboardx', name: 'Pinboard X', tagline: 'Moodboards that keep the source, the license, and the palette.', url: 'https://pinboardx.example', category: 'Design', handle: 'elif', builderName: 'Elif Demir', rating: 1478, appearances: 3, wins: 0, podiums: 0 },
  { slug: 'relaykit', name: 'Relaykit', tagline: 'Webhooks with retries, replay, and a real inbox.', url: 'https://relaykit.example', category: 'Developer', handle: 'sam', builderName: 'Sam Achebe', rating: 1452, appearances: 2, wins: 0, podiums: 0 },
  { slug: 'coldstart', name: 'Coldstart', tagline: 'Ship a landing page from a single paragraph.', url: 'https://coldstart.example', category: 'AI', handle: 'vera', builderName: 'Vera Lindholm', rating: 1427, appearances: 2, wins: 0, podiums: 0 },
  { slug: 'atlasnote', name: 'Atlasnote', tagline: 'Notes that arrange themselves on a map of what you were doing.', url: 'https://atlasnote.example', category: 'Mobile', handle: 'nikhil', builderName: 'Nikhil Rao', rating: 1401, appearances: 2, wins: 0, podiums: 0 },
  { slug: 'thresh', name: 'Thresh', tagline: 'Rate limits, quotas, and billing caps as one primitive.', url: 'https://thresh.example', category: 'SaaS', handle: 'dana', builderName: 'Dana Kowalski', rating: 1376, appearances: 2, wins: 0, podiums: 0 },
  { slug: 'grainy', name: 'Grainy', tagline: 'Film-grain video filters that run on-device.', url: 'https://grainy.example', category: 'Creator', handle: 'omar', builderName: 'Omar Haddad', rating: 1350, appearances: 1, wins: 0, podiums: 0 },
  { slug: 'burrow', name: 'Burrow', tagline: 'Local-first bookmarking with no account at all.', url: 'https://burrow.example', category: 'Other', handle: 'faye', builderName: 'Faye Iwu', rating: 1325, appearances: 1, wins: 0, podiums: 0 },
  { slug: 'chainlight', name: 'Chainlight', tagline: 'Read any contract as plain English before you sign.', url: 'https://chainlight.example', category: 'Web3', handle: 'ravi', builderName: 'Ravi Menon', rating: 1299, appearances: 1, wins: 0, podiums: 0 },
  { slug: 'stitchbox', name: 'Stitchbox', tagline: 'Collaborative pixel canvas with a one-minute cooldown.', url: 'https://stitchbox.example', category: 'Games', handle: 'lena', builderName: 'Lena Marchetti', rating: 1274, appearances: 1, wins: 0, podiums: 0 },
  { slug: 'mendline', name: 'Mendline', tagline: 'Automatic dependency upgrades that explain the diff.', url: 'https://mendline.example', category: 'Open Source', handle: 'theo', builderName: 'Theo Bergstrom', rating: 1248, appearances: 1, wins: 0, podiums: 0 },
  { slug: 'huddleboard', name: 'Huddleboard', tagline: 'Async standups that read like a newspaper.', url: 'https://huddleboard.example', category: 'Community', handle: 'zoya', builderName: 'Zoya Karim', rating: 1223, appearances: 1, wins: 0, podiums: 0 },
  { slug: 'inkwell', name: 'Inkwell', tagline: 'Longform editor with zero chrome and real footnotes.', url: 'https://inkwell.example', category: 'Creator', handle: 'august', builderName: 'August Meier', rating: 1197, appearances: 1, wins: 0, podiums: 0 },
];

function makeProject(seed: Seed, index: number): Project {
  return {
    id: `prj_${seed.slug}`,
    slug: seed.slug,
    name: seed.name,
    tagline: seed.tagline,
    description: `${seed.name} is ${seed.tagline.charAt(0).toLowerCase()}${seed.tagline.slice(1).replace(/\.$/, '')}. Built in the open by ${seed.builderName}, it has entered ${seed.appearances} Arena${seed.appearances === 1 ? '' : 's'} and holds an Arena Rating of ${seed.rating}.`,
    url: seed.url,
    category: seed.category,
    logoUrl: null,
    xUrl: `https://x.com/${seed.handle}`,
    githubUrl: seed.category === 'Open Source' || seed.category === 'Developer'
      ? `https://github.com/${seed.handle}/${seed.slug}`
      : null,
    builder: builder(seed.handle, seed.builderName),
    arenaRating: seed.rating,
    appearances: seed.appearances,
    wins: seed.wins,
    podiums: seed.podiums,
    highestRank: seed.wins > 0 ? 1 : seed.podiums > 0 ? 3 : 8,
    totalSupporters: 4200 - index * 118 + (index % 5) * 47,
    totalClicks: 11800 - index * 305 + (index % 7) * 91,
    createdAt: iso(-DAY * (400 - index * 9)),
  };
}

export const PROJECTS: Project[] = SEEDS.map(makeProject);

export function projectBySlug(slug: string): Project | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}

function arenaExtras(partial: Pick<Arena, 'startsAt' | 'endsAt' | 'category'> & { registrationOpensAt?: string }): Pick<
  Arena,
  'registrationOpensAt' | 'registrationClosesAt' | 'eligibilityText' | 'scoringConfig' | 'category'
> {
  return {
    category: partial.category,
    registrationOpensAt: partial.registrationOpensAt ?? iso(-14 * DAY),
    registrationClosesAt: partial.startsAt,
    eligibilityText: 'Any internet project with a public URL.',
    scoringConfig: {
      weights: { supporter: 1, uniqueVisit: 2 },
      rating: { champion: 100, top10: 70, top25: 40, top50: 15, bottom50: -10 },
    },
  };
}

export const LIVE_ARENA: Arena = {
  id: 'arn_open-arena-001',
  slug: 'open-arena-001',
  number: 1,
  name: 'Open Arena #001',
  theme: 'Open category. Any internet project. No rules beyond the clock.',
  status: 'live',
  startsAt: iso(-3 * DAY),
  endsAt: iso(4 * HOUR + 28 * 60_000 + 31_000),
  entryFeeCents: 4900,
  prenaPaymentEnabled: true,
  prenaDiscountPercent: 17,
  rewardPoolEnabled: false,
  prenaEarlyRegistrationAt: null,
  entrantCap: 48,
  entrantCount: 32,
  spectators: 18421,
  visits: 7194,
  prize: 'Champion badge, permanent Hall of Fame entry, homepage feature for 7 days',
  ...arenaExtras({ startsAt: iso(-3 * DAY), endsAt: iso(4 * HOUR), category: 'Open' }),
};

export const UPCOMING_ARENAS: Arena[] = [
  {
    id: 'arn_open-arena-002',
    slug: 'open-arena-002',
    number: 2,
    name: 'Open Arena #002',
    theme: 'Any internet project. Thirty-two spots. The next open field.',
    status: 'registration',
    startsAt: iso(8 * DAY),
    endsAt: iso(10 * DAY),
    entryFeeCents: 1900,
    prenaPaymentEnabled: true,
    prenaDiscountPercent: 17,
    rewardPoolEnabled: false,
    prenaEarlyRegistrationAt: null,
    entrantCap: 32,
    entrantCount: 21,
    spectators: 0,
    visits: 0,
    prize: 'Champion badge, Hall of Fame entry, homepage feature for 7 days',
    ...arenaExtras({ startsAt: iso(8 * DAY), endsAt: iso(10 * DAY), category: 'Open' }),
  },
  {
    id: 'arn_game-003',
    slug: 'game-003',
    number: 3,
    name: 'Game Arena #003',
    theme: 'Browser games, mobile games, experiments you can play in under a minute.',
    status: 'registration',
    startsAt: iso(9 * DAY),
    endsAt: iso(12 * DAY),
    entryFeeCents: 3900,
    prenaPaymentEnabled: true,
    prenaDiscountPercent: 17,
    rewardPoolEnabled: false,
    prenaEarlyRegistrationAt: null,
    entrantCap: 32,
    entrantCount: 11,
    spectators: 0,
    visits: 0,
    prize: 'Champion badge, Hall of Fame entry, homepage feature for 7 days',
    ...arenaExtras({ startsAt: iso(9 * DAY), endsAt: iso(12 * DAY), category: 'Games' }),
  },
  {
    id: 'arn_oss-004',
    slug: 'oss-004',
    number: 4,
    name: 'Open Source Arena #004',
    theme: 'Public repos only. Stars are not the score here.',
    status: 'registration',
    startsAt: iso(16 * DAY),
    endsAt: iso(19 * DAY),
    entryFeeCents: 0,
    prenaPaymentEnabled: true,
    prenaDiscountPercent: 17,
    rewardPoolEnabled: false,
    prenaEarlyRegistrationAt: null,
    entrantCap: 64,
    entrantCount: 4,
    spectators: 0,
    visits: 0,
    prize: 'Champion badge, Hall of Fame entry, homepage feature for 7 days',
    ...arenaExtras({ startsAt: iso(16 * DAY), endsAt: iso(19 * DAY), category: 'Open Source' }),
  },
];

export const PAST_ARENAS: Arena[] = [
  {
    id: 'arn_launch-000',
    slug: 'launch-000',
    number: 0,
    name: 'Launch Arena #000',
    theme: 'The first Arena. Everything was allowed.',
    status: 'finished',
    startsAt: iso(-24 * DAY),
    endsAt: iso(-21 * DAY),
    entryFeeCents: 2900,
    prenaPaymentEnabled: true,
    prenaDiscountPercent: 17,
    rewardPoolEnabled: false,
    prenaEarlyRegistrationAt: null,
    entrantCap: 32,
    entrantCount: 28,
    spectators: 12904,
    visits: 5382,
    prize: 'Champion badge, Hall of Fame entry',
    ...arenaExtras({ startsAt: iso(-24 * DAY), endsAt: iso(-21 * DAY), category: 'Open' }),
  },
  {
    id: 'arn_tools-00a',
    slug: 'tools-00a',
    number: -1,
    name: 'Tools Arena',
    theme: 'Developer tools and everything that makes shipping faster.',
    status: 'finished',
    startsAt: iso(-45 * DAY),
    endsAt: iso(-42 * DAY),
    entryFeeCents: 2900,
    prenaPaymentEnabled: true,
    prenaDiscountPercent: 17,
    rewardPoolEnabled: false,
    prenaEarlyRegistrationAt: null,
    entrantCap: 32,
    entrantCount: 24,
    spectators: 9877,
    visits: 4110,
    prize: 'Champion badge, Hall of Fame entry',
    ...arenaExtras({ startsAt: iso(-45 * DAY), endsAt: iso(-42 * DAY), category: 'Developer' }),
  },
  {
    id: 'arn_design-00b',
    slug: 'design-00b',
    number: -2,
    name: 'Design Arena',
    theme: 'Taste as a competitive category.',
    status: 'finished',
    startsAt: iso(-66 * DAY),
    endsAt: iso(-63 * DAY),
    entryFeeCents: 2900,
    prenaPaymentEnabled: true,
    prenaDiscountPercent: 17,
    rewardPoolEnabled: false,
    prenaEarlyRegistrationAt: null,
    entrantCap: 24,
    entrantCount: 19,
    spectators: 8140,
    visits: 3299,
    prize: 'Champion badge, Hall of Fame entry',
    ...arenaExtras({ startsAt: iso(-66 * DAY), endsAt: iso(-63 * DAY), category: 'Design' }),
  },
];

export const ALL_ARENAS: Arena[] = [LIVE_ARENA, ...UPCOMING_ARENAS, ...PAST_ARENAS];

export function arenaBySlug(slug: string): Arena | undefined {
  return ALL_ARENAS.find((a) => a.slug === slug);
}

/** Deterministic pseudo-random in [0,1) from a string + salt. */
function hash01(key: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function buildStandings(arena: Arena, entrants: Project[]): Standing[] {
  const rows = entrants.map((project, i) => {
    const jitter = hash01(`${arena.slug}:${project.slug}`, arena.number + 7);
    const supporters = Math.round(680 - i * 18 + jitter * 190);
    const clicks = Math.round(supporters * (2.1 + jitter * 1.4));
    return { project, supporters, clicks, score: calculateArenaScore(supporters, clicks) };
  });

  rows.sort((a, b) => b.score - a.score);
  const total = rows.reduce((sum, r) => sum + r.score, 0) || 1;

  return rows.map((row, i) => {
    const swing = hash01(`${arena.slug}:${row.project.slug}:mv`, 31);
    const delta = swing < 0.22 ? 2 : swing < 0.4 ? 1 : swing < 0.6 ? 0 : swing < 0.8 ? -1 : -2;
    const previousRank = arena.status === 'live' ? Math.min(rows.length, Math.max(1, i + 1 + delta)) : null;
    return {
      rank: i + 1,
      previousRank,
      project: row.project,
      supporters: row.supporters,
      clicks: row.clicks,
      score: row.score,
      share: Math.round((row.score / total) * 1000) / 10,
      momentum: previousRank === null ? 0 : previousRank - (i + 1),
    };
  });
}

/**
 * Category-matching projects first, then the rest, always trimmed to exactly
 * `entrantCount` so the field size and the standings can never disagree.
 */
function fieldFor(arena: Arena, preferred: (p: Project) => boolean): Project[] {
  const matches = PROJECTS.filter(preferred);
  const rest = PROJECTS.filter((p) => !preferred(p));
  return [...matches, ...rest].slice(0, arena.entrantCount);
}

const ENTRANT_RULES: Record<string, (p: Project) => boolean> = {
  'open-arena-002': () => true,
  'game-003': (p) => p.category === 'Games' || p.category === 'Other',
  'oss-004': (p) => p.category === 'Open Source',
  'design-00b': (p) => p.category === 'Design' || p.category === 'Creator',
  'tools-00a': (p) => p.category === 'Developer' || p.category === 'SaaS',
};

export function standingsForArena(slug: string): Standing[] {
  const arena = arenaBySlug(slug);
  if (!arena) return [];
  return buildStandings(arena, fieldFor(arena, ENTRANT_RULES[slug] ?? (() => true)));
}

export const LIVE_STANDINGS: Standing[] = standingsForArena(LIVE_ARENA.slug);

export const HALL_OF_FAME: ArenaResult[] = PAST_ARENAS.flatMap((arena) => {
  const standings = standingsForArena(arena.slug);
  const champion = standings[0];
  if (!champion) return [];
  return [{ arena, champion, runnersUp: standings.slice(1, 3) }];
});

export function historyForProject(slug: string): ProjectHistoryEntry[] {
  return PAST_ARENAS.flatMap((arena) => {
    const standings = standingsForArena(arena.slug);
    const row = standings.find((s) => s.project.slug === slug);
    if (!row) return [];
    const ratingDelta = Math.round((standings.length / 2 - row.rank) * 6.5);
    return [
      {
        arenaSlug: arena.slug,
        arenaNumber: arena.number,
        arenaName: arena.name,
        endedAt: arena.endsAt,
        rank: row.rank,
        entrants: standings.length,
        supporters: row.supporters,
        clicks: row.clicks,
        ratingDelta,
      },
    ];
  });
}

/** Projects owned by the signed-out demo builder shown on /dashboard. */
export const DEMO_BUILDER_PROJECT_SLUGS = ['drift', 'halftone', 'relaykit'];
