import { useCallback, useEffect, useState } from 'react';

import type { Message } from '../lib/database.types';
import { supabase } from '../lib/supabase';

const PAGE = 50;

/** Family group chat (spec §2.2) over Supabase Realtime — no polling. */
export function useMessages(familyId: string | null | undefined, myId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!familyId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('family_id', familyId)
      .order('sent_at', { ascending: false })
      .limit(PAGE)
      .returns<Message[]>();
    setMessages((data ?? []).reverse());
    setLoading(false);
  }, [familyId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!familyId) return;
    const channel = supabase
      .channel(`chat:${familyId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `family_id=eq.${familyId}` },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, row],
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyId]);

  const sendText = useCallback(
    async (text: string) => {
      const body = text.trim();
      if (!body || !familyId || !myId) return;
      setSending(true);
      try {
        await supabase
          .from('messages')
          .insert({ family_id: familyId, sender_id: myId, kind: 'text', body });
      } finally {
        setSending(false);
      }
    },
    [familyId, myId],
  );

  const sendLocation = useCallback(
    async (latitude: number, longitude: number) => {
      if (!familyId || !myId) return;
      setSending(true);
      try {
        await supabase.from('messages').insert({
          family_id: familyId,
          sender_id: myId,
          kind: 'location',
          latitude,
          longitude,
        });
      } finally {
        setSending(false);
      }
    },
    [familyId, myId],
  );

  return { messages, loading, sending, sendText, sendLocation, reload: load };
}
