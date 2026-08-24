import { NextResponse } from 'next/server';
import { getBuilder } from '@/lib/auth';
import { rateLimit } from '@/lib/prena/rate-limit';
import { createAdminClient } from '@/lib/supabase/server';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_BUCKET = 'project-logos';

type ImageType = { contentType: string; extension: string };

function hasPrefix(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((byte, index) => bytes[index] === byte);
}

function detectImageType(bytes: Uint8Array): ImageType | null {
  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: 'image/png', extension: 'png' };
  }
  if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) {
    return { contentType: 'image/jpeg', extension: 'jpg' };
  }
  if (
    hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { contentType: 'image/webp', extension: 'webp' };
  }
  if (
    hasPrefix(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    hasPrefix(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return { contentType: 'image/gif', extension: 'gif' };
  }
  return null;
}

export async function POST(request: Request) {
  const ctx = await getBuilder();
  if (!ctx) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  if (!rateLimit(`project-logo:${ctx.builder.id}`, 10, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_LOGO_BYTES + 64 * 1024) {
    return NextResponse.json({ error: 'invalid_file' }, { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('logo');
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_LOGO_BYTES) {
    return NextResponse.json({ error: 'invalid_file' }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const imageType = detectImageType(bytes);
  if (!imageType) return NextResponse.json({ error: 'unsupported_image' }, { status: 400 });

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const path = `${ctx.builder.id}/${crypto.randomUUID()}.${imageType.extension}`;
  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, bytes, {
    cacheControl: '31536000',
    contentType: imageType.contentType,
    upsert: false,
  });
  if (error) return NextResponse.json({ error: 'upload_failed' }, { status: 500 });

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
