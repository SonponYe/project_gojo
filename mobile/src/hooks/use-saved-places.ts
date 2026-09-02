import { useCallback, useEffect, useState } from 'react';

import type { SavedPlace } from '../lib/database.types';
import { supabase } from '../lib/supabase';

export const MAX_PLACES = 10;

/** Personal named places (spec §10.4). Private to the owner. */
export function useSavedPlaces(userId: string | undefined) {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('saved_places')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .returns<SavedPlace[]>();
    setPlaces(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const addPlace = useCallback(
    async (input: { name: string; lat: number; lng: number; radius_m: number }) => {
      if (!userId) return;
      if (places.length >= MAX_PLACES) throw new Error('max');
      const { error } = await supabase.from('saved_places').insert({
        user_id: userId,
        name: input.name.trim(),
        lat: input.lat,
        lng: input.lng,
        radius_m: input.radius_m,
      });
      if (error) throw error;
      await load();
    },
    [userId, places.length, load],
  );

  const updatePlace = useCallback(
    async (id: string, patch: Partial<Pick<SavedPlace, 'name' | 'lat' | 'lng' | 'radius_m'>>) => {
      const { error } = await supabase.from('saved_places').update(patch).eq('id', id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  const removePlace = useCallback(
    async (id: string) => {
      await supabase.from('saved_places').delete().eq('id', id);
      await load();
    },
    [load],
  );

  return { places, loading, addPlace, updatePlace, removePlace, reload: load, atLimit: places.length >= MAX_PLACES };
}
