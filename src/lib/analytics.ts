import { createAdminClient } from './supabase/server';

export type ProductEvent =
  | 'arena_viewed'
  | 'arena_entry_started'
  | 'checkout_started'
  | 'checkout_completed'
  | 'entry_approved'
  | 'arena_started'
  | 'project_supported'
  | 'project_outbound_clicked'
  | 'ranking_shared'
  | 'result_viewed'
  | 'next_arena_clicked'
  | 'repeat_entry_completed';

export async function trackEvent(
  name: ProductEvent | string,
  attrs: {
    visitorId?: string | null;
    builderId?: string | null;
    arenaId?: string | null;
    projectId?: string | null;
    payload?: Record<string, unknown>;
  } = {},
): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;
  await supabase.rpc('track_event', {
    p_name: name,
    p_visitor_id: attrs.visitorId ?? null,
    p_builder_id: attrs.builderId ?? null,
    p_arena_id: attrs.arenaId ?? null,
    p_project_id: attrs.projectId ?? null,
    p_payload: attrs.payload ?? {},
  });
}

export function hashSignal(value: string | null | undefined): string | null {
  if (!value) return null;
  const salt = process.env.FRAUD_SALT ?? 'project-arena';
  let h = 2166136261;
  const input = `${salt}:${value}`;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null;
  return request.headers.get('x-real-ip');
}
