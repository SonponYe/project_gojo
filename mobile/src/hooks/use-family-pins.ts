import { useCallback, useEffect, useState } from 'react';

import type { MapPin } from '../lib/database.types';
import { supabase } from '../lib/supabase';

/** Shared, family-visible waypoints — "I was here", "meet me here". */
export function useFamilyPins(familyId: string | null | undefined) {
  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!familyId) {
      setPins([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('map_pins')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
      .returns<MapPin[]>();
    setPins(data ?? []);
    setLoading(false);
  }, [familyId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!familyId) return;
    const channel = supabase
      .channel(`map-pins:${familyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'map_pins', filter: `family_id=eq.${familyId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyId, load]);

  const addPin = useCallback(
    async (input: { name: string; lat: number; lng: number }, myId: string) => {
      if (!familyId) return;
      const { error } = await supabase.from('map_pins').insert({
        family_id: familyId,
        created_by: myId,
        name: input.name.trim(),
        lat: input.lat,
        lng: input.lng,
      });
      if (error) throw error;
      await load();
    },
    [familyId, load],
  );

  const removePin = useCallback(
    async (id: string) => {
      await supabase.from('map_pins').delete().eq('id', id);
      await load();
    },
    [load],
  );

  return { pins, loading, addPin, removePin, reload: load };
}
