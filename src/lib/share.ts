import { siteUrl } from './stripe';
import { formatRank } from './format';

export type ShareKind = 'entry' | 'live' | 'top10' | 'final' | 'champion' | 'complete';

export function sharePath(kind: ShareKind, projectSlug: string, arenaSlug: string): string {
  return `/share/${kind}/${projectSlug}/${arenaSlug}`;
}

export function shareImageUrl(kind: ShareKind, projectSlug: string, arenaSlug: string): string {
  return `${siteUrl()}${sharePath(kind, projectSlug, arenaSlug)}`;
}

/** External distribution keeps a durable project attribution without building an internal feed. */
export function shareAttributionUrl(path: string, projectSlug: string): string {
  const url = new URL(path, siteUrl());
  url.searchParams.set('ref', projectSlug);
  url.searchParams.set('utm_source', 'x');
  url.searchParams.set('utm_medium', 'social');
  return url.toString();
}

export function shareText(kind: ShareKind, input: {
  projectName: string;
  arenaName: string;
  rank?: number | null;
  field?: number | null;
  url: string;
}): string {
  const rank = input.rank ? `#${input.rank}` : '';
  switch (kind) {
    case 'entry':
      return `${input.projectName} has entered ${input.arenaName} on Project Arena.\n\n${input.url}`;
    case 'live':
      return `We're currently ${rank || 'on the board'} in ${input.arenaName} on Project Arena.\n\nHelp us climb the leaderboard:\n${input.url}`;
    case 'top10':
      return `${input.projectName} is in the Top 10 of ${input.arenaName}.\n\nFollow the Arena:\n${input.url}`;
    case 'champion':
      return `We won ${input.arenaName} on Project Arena 🏆\n\n${input.url}`;
    case 'final':
      return input.rank === 1
        ? `We won ${input.arenaName} on Project Arena 🏆\n\n${input.url}`
        : `${input.projectName} finished ${rank}${input.field ? ` / ${input.field}` : ''} in ${input.arenaName} on Project Arena.\n\n${input.url}`;
    case 'complete':
      return `${input.arenaName} is complete. See the final Arena record:\n${input.url}`;
  }
}

export function xIntentUrl(text: string, url?: string): string {
  const params = new URLSearchParams({ text });
  if (url) params.set('url', url);
  return `https://x.com/intent/post?${params.toString()}`;
}

export function publicResultUrl(projectSlug: string, arenaSlug: string): string {
  return `${siteUrl()}/project/${projectSlug}?arena=${encodeURIComponent(arenaSlug)}`;
}

export function rankLabel(rank: number | null | undefined, field?: number | null): string {
  if (!rank) return '—';
  return field ? `${formatRank(rank)} / ${field}` : formatRank(rank);
}
