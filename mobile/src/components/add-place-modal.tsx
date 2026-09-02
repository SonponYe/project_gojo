import { useState } from 'react';
import Slider from '@react-native-community/slider';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { t } from '../i18n';
import { Button, Field, Palette } from './ui';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Uses the device's current position; caller resolves lat/lng. */
  onSubmit: (input: { name: string; radius_m: number }) => Promise<void>;
}

export function AddPlaceModal({ visible, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [radius, setRadius] = useState(150); // spec §10.4 default
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), radius_m: Math.round(radius) });
      setName('');
      setRadius(150);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('profile.addPlace')}</Text>
          <Text style={styles.help}>{t('profile.placesHelp')}</Text>

          <Field
            label={t('profile.placeName')}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoFocus
          />

          <View style={{ gap: 4 }}>
            <Text style={styles.radiusLabel}>
              {t('profile.radius')}: {t('profile.meters', { value: Math.round(radius) })}
            </Text>
            <Slider
              minimumValue={50}
              maximumValue={500}
              step={10}
              value={radius}
              onValueChange={setRadius}
              minimumTrackTintColor={Palette.brand}
              thumbTintColor={Palette.brand}
            />
          </View>

          <Button title={t('common.save')} onPress={submit} loading={busy} disabled={!name.trim()} />
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
  radiusLabel: { fontWeight: '700', color: Palette.text },
});
