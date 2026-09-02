import type { SavedPlace } from './database.types';

/** Great-circle distance in metres between two lat/lng points. */
export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Spec §10.4 — if the position falls inside a saved place's radius, return that
 * place's name (nearest wins). Otherwise null and the caller reverse-geocodes.
 */
export function matchSavedPlace(
  lat: number,
  lng: number,
  places: SavedPlace[],
): string | null {
  let best: { name: string; dist: number } | null = null;
  for (const p of places) {
    const dist = haversineMeters(lat, lng, p.lat, p.lng);
    if (dist <= p.radius_m && (!best || dist < best.dist)) {
      best = { name: p.name, dist };
    }
  }
  return best?.name ?? null;
}

/** Bounding box that comfortably contains every point, for the initial camera. */
export function boundsOf(points: { lat: number; lng: number }[]) {
  if (points.length === 0) return null;
  let minLat = 90,
    maxLat = -90,
    minLng = 180,
    maxLng = -180;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return {
    ne: [maxLng, maxLat] as [number, number],
    sw: [minLng, minLat] as [number, number],
    center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2] as [number, number],
  };
}
