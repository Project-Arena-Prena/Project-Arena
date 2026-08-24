import { z } from 'zod';

export function publicHttpUrl(maxLength: number) {
  return z
    .string()
    .max(maxLength)
    .url()
    // safeExternalUrl, not `new URL`: a failed .url() check marks the result
    // dirty rather than aborted, so zod still runs this refinement on a string
    // that is not a URL. `new URL('')` throws a TypeError, which is not a
    // ZodError, so it escapes safeParse and 500s the route.
    .refine((value) => safeExternalUrl(value) !== null, 'Only HTTP(S) URLs are allowed');
}

export function safeExternalUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function safeInternalPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  return value;
}
