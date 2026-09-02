import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AppUser, LocationRow, MemberWithLocation } from '../lib/database.types';
import { supabase } from '../lib/supabase';

/**
 * Live family roster + locations for the map (spec §2.1). One realtime
 * subscription per family covers member changes and every location upsert;
 * a 30s timer re-evaluates freshness so dots go green→amber→grey on their own.
 */
export function useFamilyMap(familyId: string | null | undefined) {
  const [members, setMembers] = useState<AppUser[]>([]);
  const [locations, setLocations] = useState<Record<string, LocationRow>>({});
  const [loading, setLoading] = useState(true);
  const [, forceTick] = useState(0);
  const memberIds = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!familyId) {
      setMembers([]);
      setLocations({});
      setLoading(false);
      return;
    }
    const { data: users } = await supabase
      .from('users')
      .select('*')
      .eq('family_id', familyId)
      .returns<AppUser[]>();
    const roster = users ?? [];
    setMembers(roster);
    memberIds.current = new Set(roster.map((u) => u.id));

    const { data: locs } = await supabase
      .from('locations')
      .select('*')
      .in('user_id', roster.length ? roster.map((u) => u.id) : ['00000000-0000-0000-0000-000000000000'])
      .returns<LocationRow[]>();
    setLocations(Object.fromEntries((locs ?? []).map((l) => [l.user_id, l])));
    setLoading(false);
  }, [familyId]);

  useEffect(() => {
    load();
  }, [load]);

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
            if (gone) setLocations((prev) => {
              const next = { ...prev };
              delete next[gone];
              return next;
            });
            return;
          }
          const row = payload.new as LocationRow;
          if (memberIds.current.has(row.user_id)) {
            setLocations((prev) => ({ ...prev, [row.user_id]: row }));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyId, load]);

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

  return { roster, loading, reload: load };
}
