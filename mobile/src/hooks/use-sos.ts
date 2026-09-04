import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

import { Tracking } from '../lib/config';
import type { SosAlert } from '../lib/database.types';
import { supabase } from '../lib/supabase';

/**
 * SOS alerts for the family (spec §10.3). `trigger` calls the sos-alert Edge
 * Function, which records the row and fans push out to everyone else. Alerts
 * self-expire after 30 minutes; a local timer drops them from the list.
 */
export function useSos(familyId: string | null | undefined, myId: string | undefined) {
  const [alerts, setAlerts] = useState<SosAlert[]>([]);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!familyId) return setAlerts([]);
    const { data } = await supabase
      .from('active_sos_alerts')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
      .returns<SosAlert[]>();
    setAlerts(data ?? []);
  }, [familyId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!familyId) return;
    const channel = supabase
      .channel(`sos:${familyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sos_alerts', filter: `family_id=eq.${familyId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyId, load]);

  // Prune alerts that have aged past the 30-minute TTL.
  useEffect(() => {
    const id = setInterval(() => {
      setAlerts((prev) =>
        prev.filter(
          (a) => Date.now() - new Date(a.created_at).getTime() < Tracking.sosTtlMs,
        ),
      );
    }, 15_000);
    return () => clearInterval(id);
  }, []);

  const trigger = useCallback(async () => {
    setSending(true);
    try {
      let coords: { latitude: number; longitude: number };
      try {
        const fix = await Location.getLastKnownPositionAsync();
        const use = fix ?? (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }));
        coords = use.coords;
      } catch {
        coords = { latitude: 0, longitude: 0 };
      }
      // Preferred path: the Edge Function records the row AND fans push out to
      // family members whose app is closed.
      const { error } = await supabase.functions.invoke('sos-alert', {
        body: { lat: coords.latitude, lng: coords.longitude },
      });
      // Fallback (function not deployed / offline): insert directly. RLS allows
      // it, realtime still alerts anyone with the app open, only closed-app
      // push is lost.
      if (error && familyId && myId) {
        await supabase.from('sos_alerts').insert({
          family_id: familyId,
          sender_id: myId,
          lat: coords.latitude,
          lng: coords.longitude,
        });
      }
      await load();
    } finally {
      setSending(false);
    }
  }, [load]);

  const resolveMine = useCallback(async () => {
    if (!myId) return;
    await supabase
      .from('sos_alerts')
      .update({ resolved_at: new Date().toISOString() })
      .eq('sender_id', myId)
      .is('resolved_at', null);
    await load();
  }, [myId, load]);

  const myActiveAlert = alerts.find((a) => a.sender_id === myId) ?? null;

  return { alerts, myActiveAlert, sending, trigger, resolveMine, reload: load };
}
