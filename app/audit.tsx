import React, { useState, useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../src/services/firebase';
import { EmptyState, Loader } from '../src/components/UI';
import { colors, font, radius, spacing } from '../src/theme';

interface AuditRow {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entity_id: string | null;
  details: string | null;
  created_at: any;
}

const ACTION_MAP: Record<
  string,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  login: { label: 'تسجيل دخول', icon: 'log-in-outline', color: colors.info },
  create: { label: 'إنشاء', icon: 'add-circle-outline', color: colors.success },
  update: { label: 'تعديل', icon: 'create-outline', color: colors.warning },
  delete: { label: 'حذف', icon: 'trash-outline', color: colors.danger },
  withdraw: { label: 'سحب', icon: 'arrow-down-circle-outline', color: colors.accent },
  withdraw_request: { label: 'طلب سحب', icon: 'time-outline', color: colors.warning },
  approve: { label: 'موافقة', icon: 'checkmark-circle-outline', color: colors.success },
  reject: { label: 'رفض', icon: 'close-circle-outline', color: colors.danger },
  return: { label: 'إرجاع', icon: 'return-down-back-outline', color: colors.primary },
  addition: { label: 'إضافة كمية', icon: 'add-outline', color: colors.success },
  change_password: { label: 'تغيير كلمة مرور', icon: 'key-outline', color: colors.info },
};

export default function AuditScreen() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'audit_logs'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditRow));
      setRows(logs);
    });
    return unsubscribe;
  }, []);

  if (!rows) return <Loader />;
  if (rows.length === 0)
    return <EmptyState icon="list-outline" title="لا توجد سجلات بعد" />;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      data={rows}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: spacing.lg }}
      renderItem={({ item }) => {
        const meta = ACTION_MAP[item.action] ?? {
          label: item.action,
          icon: 'ellipse-outline' as const,
          color: colors.textMuted,
        };
        return (
          <View style={s.row}>
            <View style={[s.icon, { backgroundColor: `${meta.color}1A` }]}>
              <Ionicons name={meta.icon} size={17} color={meta.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.action}>
                {meta.label}
                {item.details ? ` — ${item.details}` : ''}
              </Text>
              <Text style={s.meta}>
                {item.actor} • {item.entity}
                {item.entity_id ? `#${item.entity_id}` : ''} •{' '}
                {item.created_at ? new Date(item.created_at.seconds * 1000).toLocaleString() : ''}
              </Text>
            </View>
          </View>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: 8,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: { fontSize: font.small, fontWeight: '700', color: colors.text, textAlign: 'right' },
  meta: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2, textAlign: 'right' },
});
