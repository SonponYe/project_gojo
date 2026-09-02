import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/auth';
import { useMessages } from '../../hooks/use-messages';
import { t } from '../../i18n';
import type { AppUser, Message } from '../../lib/database.types';
import { clockTime, initialsOf, pinColorFor } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { Palette, Screen } from '../../components/ui';

export default function ChatScreen() {
  const { profile, family } = useAuth();
  const insets = useSafeAreaInsets();
  const { messages, sending, sendText, sendLocation } = useMessages(family?.id, profile?.id);
  const [draft, setDraft] = useState('');
  const [members, setMembers] = useState<Record<string, AppUser>>({});
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    if (!family?.id) return;
    supabase
      .from('users')
      .select('*')
      .eq('family_id', family.id)
      .returns<AppUser[]>()
      .then(({ data }) => setMembers(Object.fromEntries((data ?? []).map((u) => [u.id, u]))));
  }, [family?.id]);

  useEffect(() => {
    if (messages.length) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

  const onSend = useCallback(() => {
    const text = draft;
    setDraft('');
    sendText(text);
  }, [draft, sendText]);

  const onShareLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await sendLocation(fix.coords.latitude, fix.coords.longitude);
    } catch {
      /* ignore */
    }
  }, [sendLocation]);

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>{t('chat.title')}</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 44}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>{t('chat.empty')}</Text>}
          renderItem={({ item }) => (
            <Bubble
              message={item}
              mine={item.sender_id === profile?.id}
              sender={members[item.sender_id]}
            />
          )}
        />

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <Pressable onPress={onShareLocation} hitSlop={8} style={styles.pinBtn}>
            <Text style={{ fontSize: 20 }}>📍</Text>
          </Pressable>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={Palette.textDim}
            multiline
          />
          <Pressable
            onPress={onSend}
            disabled={!draft.trim() || sending}
            style={[styles.sendBtn, (!draft.trim() || sending) && { opacity: 0.4 }]}>
            <Text style={styles.sendText}>{t('chat.send')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Bubble({
  message,
  mine,
  sender,
}: {
  message: Message;
  mine: boolean;
  sender?: AppUser;
}) {
  const name = sender?.name ?? 'Someone';

  const openLocation = () => {
    if (message.latitude == null || message.longitude == null) return;
    const url = Platform.select({
      ios: `http://maps.apple.com/?ll=${message.latitude},${message.longitude}`,
      default: `https://www.google.com/maps/search/?api=1&query=${message.latitude},${message.longitude}`,
    });
    Linking.openURL(url!);
  };

  return (
    <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
      {!mine ? (
        <View style={[styles.avatar, { backgroundColor: pinColorFor(message.sender_id) }]}>
          <Text style={styles.avatarText}>{initialsOf(name)}</Text>
        </View>
      ) : null}
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        {!mine ? <Text style={styles.senderName}>{name}</Text> : null}
        {message.kind === 'location' ? (
          <Pressable onPress={openLocation} style={styles.locCard}>
            <Text style={styles.locTitle}>{t('chat.locationCard')}</Text>
            <Text style={[styles.locOpen, mine && { color: '#E9E7FB' }]}>
              {t('chat.openLocation')} →
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.bubbleText, mine && { color: '#fff' }]}>{message.body}</Text>
        )}
        <Text style={[styles.time, mine && { color: '#D9D6F7' }]}>{clockTime(message.sent_at)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  title: { fontSize: 20, fontWeight: '800', color: Palette.text },
  list: { padding: 12, gap: 8, flexGrow: 1 },
  empty: { textAlign: 'center', color: Palette.textDim, marginTop: 40, fontWeight: '600' },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, maxWidth: '85%' },
  rowMine: { alignSelf: 'flex-end' },
  rowTheirs: { alignSelf: 'flex-start' },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: Palette.brand, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: Palette.border },
  senderName: { fontSize: 12, fontWeight: '800', color: Palette.brand, marginBottom: 2 },
  bubbleText: { fontSize: 15, color: Palette.text, lineHeight: 20 },
  time: { fontSize: 10, color: Palette.textDim, marginTop: 4, alignSelf: 'flex-end' },
  locCard: { gap: 4, paddingVertical: 2 },
  locTitle: { fontSize: 15, fontWeight: '700', color: Palette.text },
  locOpen: { fontSize: 13, fontWeight: '700', color: Palette.brand },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  pinBtn: { paddingBottom: 10 },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 42,
    borderRadius: 20,
    backgroundColor: Palette.bg,
    paddingHorizontal: 14,
    paddingTop: 10,
    fontSize: 15,
    color: Palette.text,
  },
  sendBtn: { paddingHorizontal: 14, paddingVertical: 11 },
  sendText: { color: Palette.brand, fontWeight: '800', fontSize: 15 },
});
