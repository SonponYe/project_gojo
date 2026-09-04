import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type ViewProps,
} from 'react-native';

// Monochrome "black & white" theme. Danger (SOS) and ok (sharing-on) stay red/
// green on purpose, those are safety-status colours, not branding.
export const Palette = {
  brand: '#0A0A0C',
  brandSoft: '#F0F0F2',
  danger: '#EF4444',
  text: '#0A0A0C',
  textDim: '#68686E',
  border: '#E2E2E6',
  card: '#FFFFFF',
  bg: '#F5F5F7',
  ok: '#22C55E',
} as const;

export function Screen({ style, ...props }: ViewProps) {
  return <View style={[styles.screen, style]} {...props} />;
}

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

interface ButtonProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
}

export function Button({
  title,
  variant = 'primary',
  loading,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const tint = {
    primary: { bg: Palette.brand, fg: '#fff' },
    secondary: { bg: Palette.brandSoft, fg: Palette.brand },
    danger: { bg: Palette.danger, fg: '#fff' },
    ghost: { bg: 'transparent', fg: Palette.brand },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={(state) => [
        styles.button,
        { backgroundColor: tint.bg, opacity: disabled || loading ? 0.5 : state.pressed ? 0.85 : 1 },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}>
      {loading ? (
        <ActivityIndicator color={tint.fg} />
      ) : (
        <Text style={[styles.buttonText, { color: tint.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export const Field = forwardRef<TextInput, TextInputProps & { label?: string }>(
  ({ label, style, ...props }, ref) => (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={Palette.textDim}
        style={[styles.field, style]}
        {...props}
      />
    </View>
  ),
);
Field.displayName = 'Field';

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.bg },
  card: {
    backgroundColor: Palette.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
  },
  button: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Palette.textDim, marginLeft: 2 },
  field: {
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Palette.text,
    backgroundColor: Palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
});
