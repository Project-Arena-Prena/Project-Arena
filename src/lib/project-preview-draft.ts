export const PROJECT_PREVIEW_KEY = 'arena.project-preview.v1';
const DRAFT_EVENT = 'arena:project-preview';
const DAY = 24 * 60 * 60 * 1000;

export type ProjectPreviewDraft = { version: 1; name: string; tagline: string; expiresAt: number };

export function parseProjectPreview(raw: string | null): ProjectPreviewDraft | null {
  if (!raw || raw.length > 1500) return null;
  try {
    const value = JSON.parse(raw) as Partial<ProjectPreviewDraft> | null;
    if (!value || value.version !== 1 || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 60 ||
      typeof value.tagline !== 'string' || !value.tagline.trim() || value.tagline.length > 140 ||
      typeof value.expiresAt !== 'number' || !Number.isFinite(value.expiresAt)) return null;
    return { version: 1, name: value.name, tagline: value.tagline, expiresAt: value.expiresAt };
  } catch { return null; }
}

export function readProjectPreview(): string | null {
  try {
    const raw = localStorage.getItem(PROJECT_PREVIEW_KEY);
    const draft = parseProjectPreview(raw);
    const now = Date.now();
    if (!draft || draft.expiresAt <= now || draft.expiresAt > now + DAY) return null;
    return raw;
  } catch { return null; }
}

export function saveProjectPreview(name: string, tagline: string): boolean {
  try {
    const raw = JSON.stringify({ version: 1, name: name.trim(), tagline: tagline.trim(), expiresAt: Date.now() + DAY });
    if (!parseProjectPreview(raw)) return false;
    localStorage.setItem(PROJECT_PREVIEW_KEY, raw);
    window.dispatchEvent(new Event(DRAFT_EVENT));
    return true;
  } catch { return false; }
}

export function clearProjectPreview() {
  try { localStorage.removeItem(PROJECT_PREVIEW_KEY); } catch { /* Storage can be disabled. */ }
  window.dispatchEvent(new Event(DRAFT_EVENT));
}

export function subscribeProjectPreview(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener(DRAFT_EVENT, listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener(DRAFT_EVENT, listener);
  };
}

export const serverProjectPreview = () => null;
