import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { t } from '../i18n';
import { Button, Field, Palette } from './ui';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

/** Name a pin before dropping it at your current position (spec: shared waypoint). */
export function AddMapPinModal({ visible, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSubmit(name.trim());
      setName('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('map.dropPin')}</Text>
          <Text style={styles.help}>{t('map.dropPinHelp')}</Text>

          <Field
            label={t('map.pinName')}
            value={name}
            onChangeText={setName}
            autoCapitalize="sentences"
            placeholder="Grandma's house"
            autoFocus
          />

          <Button title={t('map.dropPinSave')} onPress={submit} loading={busy} disabled={!name.trim()} />
          <Button title={t('common.cancel')} variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    gap: 14,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.border,
  },
  title: { fontSize: 20, fontWeight: '800', color: Palette.text },
  help: { color: Palette.textDim, fontSize: 13, lineHeight: 19 },
});
