const VISITOR_KEY = 'project-arena:visitor-id';
const VISITOR_COOKIE = 'pa_visitor_id';
const ONE_YEAR = 60 * 60 * 24 * 365;

function validVisitorId(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

/** Stable, anonymous browser identity used only for per-Arena deduplication. */
export function getVisitorId(): string {
  const stored = window.localStorage.getItem(VISITOR_KEY);
  const visitorId = validVisitorId(stored) ? stored : window.crypto.randomUUID();

  if (visitorId !== stored) window.localStorage.setItem(VISITOR_KEY, visitorId);

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${VISITOR_COOKIE}=${visitorId}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax${secure}`;
  return visitorId;
}

export function supportStorageKey(arenaSlug: string, projectSlug: string): string {
  return `project-arena:support:${arenaSlug}:${projectSlug}`;
}

export const VISITOR_COOKIE_NAME = VISITOR_COOKIE;
