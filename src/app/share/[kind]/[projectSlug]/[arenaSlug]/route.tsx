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
          background: '#07080A',
          color: '#ECEDEE',
          padding: 64,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 36,
                height: 36,
                background: '#FF4B1F',
                clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
              }}
            />
            <span style={{ fontSize: 22, letterSpacing: 6, textTransform: 'uppercase' }}>Project Arena</span>
          </div>
          <span style={{ fontSize: 18, letterSpacing: 4, textTransform: 'uppercase', color: champion ? '#D8B34A' : '#9BA3AC' }}>
            {arena.name}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span style={{ fontSize: 28, letterSpacing: 8, textTransform: 'uppercase', color: champion ? '#D8B34A' : '#FF4B1F' }}>
            {headline}
          </span>
          <span style={{ fontSize: 84, fontWeight: 600, letterSpacing: -3 }}>{project.name}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, letterSpacing: 4, textTransform: 'uppercase', color: '#616A73' }}>
          <span>Where projects compete for attention</span>
          <span>projectarena.xyz</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
