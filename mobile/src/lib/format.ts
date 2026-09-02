import { Tracking } from './config';

export type Freshness = 'live' | 'recent' | 'offline';

/** Spec §2.1 — green / amber / grey status dot from the last-fix age. */
export function freshnessOf(updatedAt: string | null | undefined): Freshness {
  if (!updatedAt) return 'offline';
  const age = Date.now() - new Date(updatedAt).getTime();
  if (age <= Tracking.liveWindowMs) return 'live';
  if (age <= Tracking.staleWindowMs) return 'recent';
  return 'offline';
}

export const FRESHNESS_COLOR: Record<Freshness, string> = {
  live: '#22C55E',
  recent: '#F59E0B',
  offline: '#9CA3AF',
};

/** "just now", "4 min ago", "3 hr ago", "2 days ago". */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 45) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Short clock time for chat rows. */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Battery colour bands — spec §10.1. */
export function batteryColor(level: number | null | undefined): string {
  if (level == null) return '#9CA3AF';
  if (level >= 0.3) return '#22C55E';
  if (level >= 0.15) return '#F59E0B';
  return '#EF4444';
}

export function batteryPercent(level: number | null | undefined): string {
  if (level == null) return '—';
  return `${Math.round(level * 100)}%`;
}

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** Deterministic pin colour per user id (spec §2.1 "coloured pin"). */
const PIN_COLORS = [
  '#534AB7', '#0EA5E9', '#EC4899', '#F97316', '#14B8A6',
  '#8B5CF6', '#EF4444', '#22C55E', '#EAB308', '#3B82F6',
];
export function pinColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PIN_COLORS[Math.abs(hash) % PIN_COLORS.length];
}
