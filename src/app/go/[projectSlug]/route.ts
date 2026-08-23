import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIp, hashSignal, trackEvent } from '@/lib/analytics';
import { getProject } from '@/lib/queries';
import { createAdminClient } from '@/lib/supabase/server';
import { VISITOR_COOKIE_NAME } from '@/lib/visitor';
import { safeExternalUrl } from '@/lib/validation';

const Slug = z.string().min(1).max(80).regex(/^[a-z0-9-]+$/);
const VisitorId = z.string().uuid();

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectSlug: string }> },
) {
  const { projectSlug: rawSlug } = await params;
  const parsedSlug = Slug.safeParse(rawSlug);
  if (!parsedSlug.success) return NextResponse.json({ error: 'invalid_project' }, { status: 400 });

  const project = await getProject(parsedSlug.data);
  if (!project) return NextResponse.json({ error: 'project_not_found' }, { status: 404 });
  const destination = safeExternalUrl(project.url);
  if (!destination) return NextResponse.json({ error: 'invalid_project_url' }, { status: 422 });

  const url = new URL(request.url);
  const arenaSlug = Slug.safeParse(url.searchParams.get('arena')).success
    ? url.searchParams.get('arena')
    : null;
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookieValue = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${VISITOR_COOKIE_NAME}=`))
    ?.slice(VISITOR_COOKIE_NAME.length + 1);
  const visitorId = VisitorId.safeParse(cookieValue).success ? cookieValue! : randomUUID();

  const supabase = createAdminClient();
  if (supabase) {
    await supabase.rpc('record_outbound_visit', {
      p_project_slug: project.slug,
      p_arena_slug: arenaSlug,
      p_visitor_id: visitorId,
      p_ip_hash: hashSignal(clientIp(request)),
      p_ua_hash: hashSignal(request.headers.get('user-agent')),
      p_session_id: hashSignal(request.headers.get('cookie')),
    });
    await trackEvent('project_outbound_clicked', { visitorId, payload: { projectSlug: project.slug } });
  }

  const response = NextResponse.redirect(destination, 307);
  if (visitorId !== cookieValue) {
    response.cookies.set(VISITOR_COOKIE_NAME, visitorId, {
      httpOnly: false,
      sameSite: 'lax',
      secure: url.protocol === 'https:',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}
