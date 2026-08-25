import { ImageResponse } from 'next/og';
import { getArena, getProject, getStandings } from '@/lib/queries';
import { formatRank } from '@/lib/format';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string; projectSlug: string; arenaSlug: string }> },
) {
  const { kind, projectSlug, arenaSlug } = await params;
  const [project, arena] = await Promise.all([getProject(projectSlug), getArena(arenaSlug)]);
  if (!project || !arena) {
    return new Response('Not found', { status: 404 });
  }
  const standings = await getStandings(arenaSlug);
  const standing = standings.find((row) => row.project.slug === project.slug);
  const rank = standing?.rank ?? null;
  const field = standings.length || arena.entrantCount;
  const champion = kind === 'champion' || rank === 1;

  const headline = champion
    ? 'CHAMPION'
    : kind === 'entry'
      ? 'HAS ENTERED'
      : kind === 'final'
        ? `FINISHED #${rank ? formatRank(rank) : '—'}${field ? ` / ${field}` : ''}`
        : `CURRENTLY #${rank ? formatRank(rank) : '—'}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#000000',
          color: '#F9F9F9',
          padding: 64,
          fontFamily: 'sans-serif',
          borderTop: '8px solid #E85002',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <svg width="42" height="42" viewBox="0 0 48 48" fill="none">
              <path d="M4 5H21.5L27 12H13V36H27L21.5 43H4V5Z" fill="#E85002" />
              <path d="M44 5H29.5L24 12H35V36H24L29.5 43H44V5Z" fill="#F9F9F9" />
              <path d="M21 21H27V27H21V21Z" fill="#E85002" />
            </svg>
            <span style={{ fontSize: 22, letterSpacing: 6, textTransform: 'uppercase' }}>Project Arena</span>
          </div>
          <span style={{ fontSize: 18, letterSpacing: 4, textTransform: 'uppercase', color: champion ? '#D9C3AB' : '#A7A7A7' }}>
            {arena.name}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span style={{ fontSize: 28, letterSpacing: 8, textTransform: 'uppercase', color: champion ? '#D9C3AB' : '#E85002' }}>
            {headline}
          </span>
          <span style={{ fontSize: 84, fontWeight: 600, letterSpacing: -3 }}>{project.name}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, letterSpacing: 4, textTransform: 'uppercase', color: '#646464' }}>
          <span>Where projects compete for attention</span>
          <span>projectarena.xyz</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
