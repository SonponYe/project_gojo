import { useCallback, useEffect, useState } from 'react';

import type { Message } from '../lib/database.types';
import { supabase } from '../lib/supabase';

const PAGE = 50;

/** Fire a WhatsApp-style push to the rest of the family for a just-sent message. */
async function notifyFamily(messageId: string) {
  try {
    await supabase.functions.invoke('notify-message', { body: { message_id: messageId } });
  } catch {
    // realtime still delivers it live; a closed app just misses this one buzz
  }
}

/** Family group chat (spec §2.2) over Supabase Realtime, no polling. */
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
        const { data } = await supabase
          .from('messages')
          .insert({ family_id: familyId, sender_id: myId, kind: 'text', body })
          .select('id')
          .single<{ id: string }>();
        if (data?.id) notifyFamily(data.id);
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
        const { data } = await supabase
          .from('messages')
          .insert({
            family_id: familyId,
            sender_id: myId,
            kind: 'location',
            latitude,
            longitude,
          })
          .select('id')
          .single<{ id: string }>();
        if (data?.id) notifyFamily(data.id);
      } finally {
        setSending(false);
      }
    },
    [familyId, myId],
  );

  return { messages, loading, sending, sendText, sendLocation, reload: load };
}
