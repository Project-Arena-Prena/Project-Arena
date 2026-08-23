import { redirect } from 'next/navigation';
import { createAdminClient, createClient, getSessionUser } from './supabase/server';
import type { Builder } from './types';

export interface AuthContext {
  userId: string;
  email: string;
  builder: Builder;
  isAdmin: boolean;
}

function displayNameFrom(email: string, fallback?: string | null): string {
  if (fallback && fallback.trim()) return fallback.trim();
  return email.split('@')[0] || 'Builder';
}

export async function getBuilder(): Promise<AuthContext | null> {
  const user = await getSessionUser();
  if (!user?.email) return null;

  const admin = createAdminClient();
  if (!admin) {
    return {
      userId: user.id,
      email: user.email,
      isAdmin: isAdminEmail(user.email),
      builder: {
        id: `local-${user.id}`,
        userId: user.id,
        handle: user.email.split('@')[0] ?? 'builder',
        displayName: displayNameFrom(user.email),
        email: user.email,
        avatarUrl: null,
      },
    };
  }

  const { data: existing } = await admin
    .from('builders')
    .select('id, user_id, display_name, email, avatar_url')
    .eq('user_id', user.id)
    .maybeSingle();

  let row = existing;
  if (!row) {
    const { data: created, error } = await admin
      .from('builders')
      .insert({
        user_id: user.id,
        email: user.email.toLowerCase(),
        display_name: displayNameFrom(user.email),
      })
      .select('id, user_id, display_name, email, avatar_url')
      .single();
    if (error || !created) return null;
    row = created;
  }

  const isAdmin = await userIsAdmin(user.id, user.email);

  return {
    userId: user.id,
    email: user.email,
    isAdmin,
    builder: {
      id: row.id as string,
      userId: row.user_id as string,
      handle: (row.display_name as string) || user.email.split('@')[0] || 'builder',
      displayName: (row.display_name as string) || displayNameFrom(user.email),
      email: row.email as string,
      avatarUrl: (row.avatar_url as string) ?? null,
    },
  };
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function userIsAdmin(userId: string, email?: string | null): Promise<boolean> {
  if (isAdminEmail(email)) {
    const admin = createAdminClient();
    if (admin && email) {
      await admin.from('admins').upsert({ user_id: userId, email: email.toLowerCase() }, { onConflict: 'user_id' });
    }
    return true;
  }
  const admin = createAdminClient();
  if (!admin) return false;
  const { data } = await admin.from('admins').select('user_id').eq('user_id', userId).maybeSingle();
  return Boolean(data);
}

export async function requireBuilder(next = '/dashboard'): Promise<AuthContext> {
  const ctx = await getBuilder();
  if (!ctx) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  return ctx;
}

export async function requireAdmin(next = '/admin'): Promise<AuthContext> {
  const ctx = await requireBuilder(next);
  if (!ctx.isAdmin) {
    redirect('/dashboard');
  }
  return ctx;
}

export async function signOutPath(): Promise<string> {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  return '/';
}

export async function builderOwnsProject(builderId: string, projectId: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { data } = await admin
    .from('project_owners')
    .select('id')
    .eq('builder_id', builderId)
    .eq('project_id', projectId)
    .maybeSingle();
  return Boolean(data);
}
