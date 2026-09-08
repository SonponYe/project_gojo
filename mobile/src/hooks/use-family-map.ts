import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppUser, LocationRow, MemberWithLocation } from '../lib/database.types';
import { supabase } from '../lib/supabase';

const cacheKey = (fid: string) => `gojo:familymap:${fid}`;

type Cache = { members: AppUser[]; locations: Record<string, LocationRow>; savedAt: number };

/**
 * Live family roster + locations for the map (spec §2.1). One realtime
 * subscription per family covers member changes and every location upsert;
 * a 30s timer re-evaluates freshness so dots go green->amber->grey on their own.
 *
 * Spec §3 "offline viewer": the last successful sync is cached on-device, so the
 * map paints from cache immediately on open and never goes blank when the
 * viewer is offline — the fresh fetch just overlays it when it succeeds.
 */
export function useFamilyMap(familyId: string | null | undefined) {
  const [members, setMembers] = useState<AppUser[]>([]);
  const [locations, setLocations] = useState<Record<string, LocationRow>>({});
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [, forceTick] = useState(0);
  const memberIds = useRef<Set<string>>(new Set());
  const hydrated = useRef(false);

  const load = useCallback(async () => {
    if (!familyId) {
      setMembers([]);
      setLocations({});
      setLoading(false);
      return;
    }
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('*')
      .eq('family_id', familyId)
      .returns<AppUser[]>();
    if (usersErr) {
      setLoading(false); // offline — keep whatever cache we hydrated
      return;
    }
    const roster = users ?? [];
    setMembers(roster);
    memberIds.current = new Set(roster.map((u) => u.id));

    const { data: locs } = await supabase
      .from('locations')
      .select('*')
      .in(
        'user_id',
        roster.length ? roster.map((u) => u.id) : ['00000000-0000-0000-0000-000000000000'],
      )
      .returns<LocationRow[]>();
    const locMap = Object.fromEntries((locs ?? []).map((l) => [l.user_id, l]));
    setLocations(locMap);
    setLoading(false);
    setFromCache(false);
    AsyncStorage.setItem(
      cacheKey(familyId),
      JSON.stringify({ members: roster, locations: locMap, savedAt: Date.now() } satisfies Cache),
    ).catch(() => {});
  }, [familyId]);

  // Hydrate from cache first so the map is never blank, then fetch fresh.
  useEffect(() => {
    hydrated.current = false;
    if (!familyId) return;
    let cancelled = false;
    AsyncStorage.getItem(cacheKey(familyId))
      .then((raw) => {
        if (cancelled || hydrated.current || !raw) return;
        try {
          const c = JSON.parse(raw) as Cache;
          setMembers(c.members ?? []);
          memberIds.current = new Set((c.members ?? []).map((u) => u.id));
          setLocations(c.locations ?? {});
          setFromCache(true);
          setLoading(false);
        } catch {
          /* ignore bad cache */
        }
      })
      .finally(() => {
        load().then(() => {
          hydrated.current = true;
        });
      });
    return () => {
      cancelled = true;
    };
  }, [familyId, load]);

  useEffect(() => {
    if (!familyId) return;
    const channel = supabase
      .channel(`family-map:${familyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users', filter: `family_id=eq.${familyId}` },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const gone = (payload.old as Partial<LocationRow>)?.user_id;
            if (gone)
              setLocations((prev) => {
                const next = { ...prev };
                delete next[gone];
                return next;
              });
            return;
          }
          const row = payload.new as LocationRow;
          if (memberIds.current.has(row.user_id)) {
            setLocations((prev) => ({ ...prev, [row.user_id]: row }));
            setFromCache(false);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyId, load]);

  // Keep the cache warm as realtime nudges individual rows.
  useEffect(() => {
    if (!familyId || members.length === 0) return;
    AsyncStorage.setItem(
      cacheKey(familyId),
      JSON.stringify({ members, locations, savedAt: Date.now() } satisfies Cache),
    ).catch(() => {});
  }, [familyId, members, locations]);

  // Re-render every 30s so freshness (live/recent/offline) stays current.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const roster = useMemo<MemberWithLocation[]>(
    () =>
      members.map((user) => ({
        user,
        location: locations[user.id] ?? null,
      })),
    [members, locations],
  );

  return { roster, loading, fromCache, reload: load };
}
