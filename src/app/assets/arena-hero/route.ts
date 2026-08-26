const HERO_SOURCE =
  'https://raw.githubusercontent.com/Project-Arena-Prena/Project-Arena/5f88eb32479b04d3b90df5960e4d7a577cbeb32f/public/arena-hero-v2.webp';

export const runtime = 'nodejs';

export async function GET() {
  const upstream = await fetch(HERO_SOURCE, {
    next: { revalidate: 31_536_000 },
  });

  if (!upstream.ok) {
    return new Response('Hero unavailable', { status: 502 });
  }

  return new Response(await upstream.arrayBuffer(), {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': 'image/webp',
    },
  });
}
