import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, shadow, spacing } from '../theme';

/* ============ زر ============ */
export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'danger' | 'ghost' | 'success';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const bg = {
    primary: colors.primary,
    outline: 'transparent',
    danger: colors.danger,
    ghost: 'transparent',
    success: colors.success,
  }[variant];

  const fg =
    variant === 'outline' || variant === 'ghost' ? colors.primary : colors.white;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'outline' && {
          borderWidth: 1.5,
          borderColor: colors.primary,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[s.btnText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/* ============ حقل إدخال ============ */
export function Field({
  label,
  required,
  hint,
  ...props
}: TextInputProps & { label: string; required?: boolean; hint?: string }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={s.label}>
        {label} {required && <Text style={{ color: colors.danger }}>*</Text>}
      </Text>
      <TextInput
        placeholderTextColor={colors.textLight}
        {...props}
        style={[s.input, props.multiline && { height: 90, paddingTop: 12 }]}
      />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

/* ============ بطاقة ============ */
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}

/* ============ شارة حالة ============ */
export function Badge({
  text,
  tone = 'info',
}: {
  text: string;
  tone?: 'info' | 'success' | 'danger' | 'warning' | 'muted';
}) {
  const map = {
    info: [colors.infoLight, colors.info],
    success: [colors.successLight, colors.success],
    danger: [colors.dangerLight, colors.danger],
    warning: [colors.warningLight, colors.warning],
    muted: [colors.border, colors.textMuted],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

/* ============ حالة فارغة ============ */
export function EmptyState({
  icon = 'file-tray-outline',
  title,
  subtitle,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={54} color={colors.textLight} />
      <Text style={s.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={s.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

/* ============ مؤشر تحميل ============ */
export function Loader({ text }: { text?: string }) {
  return (
    <View style={s.loader}>
      <ActivityIndicator size="large" color={colors.primary} />
      {text ? <Text style={s.loaderText}>{text}</Text> : null}
    </View>
  );
}

/* ============ نافذة منبثقة ============ */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

/* ============ صف معلومة ============ */
export function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={s.infoRow}>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
        {icon && <Ionicons name={icon} size={16} color={colors.textMuted} />}
        <Text style={s.infoLabel}>{label}</Text>
      </View>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  btnText: { fontSize: font.body, fontWeight: '700' },

  label: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    textAlign: 'right',
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: font.body,
    color: colors.text,
    textAlign: 'right',
  },
  hint: {
    fontSize: font.tiny,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'right',
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.card,
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: font.tiny, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 56, gap: 8 },
  emptyTitle: {
    fontSize: font.h3,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: font.small,
    color: colors.textLight,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },

  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loaderText: { color: colors.textMuted, fontSize: font.small },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  sheetHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  sheetTitle: { fontSize: font.h2, fontWeight: '800', color: colors.text },

  infoRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: { fontSize: font.small, color: colors.textMuted },
  infoValue: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
    textAlign: 'left',
  },
});
