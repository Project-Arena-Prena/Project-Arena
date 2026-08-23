import { siteUrl } from './stripe';
import { formatRank } from './format';

export type ShareKind = 'entry' | 'live' | 'final' | 'champion';

export function sharePath(kind: ShareKind, projectSlug: string, arenaSlug: string): string {
  return `/share/${kind}/${projectSlug}/${arenaSlug}`;
}

export function shareImageUrl(kind: ShareKind, projectSlug: string, arenaSlug: string): string {
  return `${siteUrl()}${sharePath(kind, projectSlug, arenaSlug)}`;
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
    case 'champion':
      return `We won ${input.arenaName} on Project Arena 🏆\n\n${input.url}`;
    case 'final':
      return input.rank === 1
        ? `We won ${input.arenaName} on Project Arena 🏆\n\n${input.url}`
        : `${input.projectName} finished ${rank}${input.field ? ` / ${input.field}` : ''} in ${input.arenaName} on Project Arena.\n\n${input.url}`;
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
