import React, { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  approveDisbursement,
  subscribeDisbursements,
  rejectDisbursement,
} from '../../src/db/movementsRepo';
import { statusAr } from '../../src/services/excel';
import { useAuth } from '../../src/context/AuthContext';
import { Badge, Button, Card, EmptyState, Loader } from '../../src/components/UI';
import { colors, font, radius, shadow, spacing } from '../../src/theme';
import type { Disbursement } from '../../src/types';

const FILTERS = [
  { key: 'all', label: 'الكل' },
  { key: 'pending', label: 'بانتظار الموافقة' },
  { key: 'approved', label: 'مصروفة' },
  { key: 'rejected', label: 'مرفوضة' },
];

function getStatusTone(status: string): 'info' | 'success' | 'danger' | 'warning' | 'muted' {
  switch (status) {
    case 'pending': return 'warning';
    case 'approved': return 'success';
    case 'rejected': return 'muted';
    case 'returned': return 'success';
    default: return 'info';
  }
}

export default function DisbursementsScreen() {
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const { user, canWithdrawDirect } = useAuth();
  const params = useLocalSearchParams<{ filter?: string }>();

  useEffect(() => {
    if (params.filter) {
      // Support overdue -> show all but user sees alert
      if (['pending','approved','rejected','all'].includes(params.filter as string)) {
        setFilter(params.filter as string);
      }
    }
  }, [params.filter]);

  useEffect(() => {
    const unsubscribe = subscribeDisbursements((data) => {
      setDisbursements(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    return disbursements.filter((d) => {
      if (filter !== 'all' && d.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matches =
          (d.tool_name && d.tool_name.toLowerCase().includes(q)) ||
          d.recipient.toLowerCase().includes(q) ||
          d.withdrawn_by.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [disbursements, filter, search]);

  const onApprove = async (id: string | number) => {
    try {
      await approveDisbursement(String(id), user!.username);
      Alert.alert('تم', 'تمت الموافقة على الصرف');
    } catch (e: any) {
      Alert.alert('خطأ', e.message ?? 'فشل الموافقة');
    }
  };

  const onReject = async (id: string | number) => {
    Alert.alert('تأكيد الرفض', 'هل أنت متأكد من رفض طلب الصرف؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'رفض',
        style: 'destructive',
        onPress: async () => {
          try {
            await rejectDisbursement(String(id), user!.username);
            Alert.alert('تم', 'تم رفض الطلب');
          } catch (e: any) {
            Alert.alert('خطأ', e.message ?? 'فشل الرفض');
          }
        },
      },
    ]);
  };

  if (loading) return <Loader text="جارٍ تحميل عمليات الصرف..." />;

  return (
    <View style={s.container}>
      <View style={s.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="بحث باسم الأداة أو المستلم..."
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textLight} />
          </Pressable>
        )}
      </View>

      <View style={s.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[s.filterChip, filter === f.key && s.filterActive]}
          >
            <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 ? (
        <EmptyState icon="archive-outline" title="لا توجد عمليات" subtitle="لا توجد عمليات صرف تطابق البحث الحالي" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(d) => String(d.id)}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item: d }) => (
            <Card style={s.item}>
              <View style={s.row}>
                <Text style={s.toolName} numberOfLines={1}>{(d as any).tool_name || `أداة ${d.tool_id}`}</Text>
                <Badge text={statusAr(d.status)} tone={getStatusTone(d.status)} />
              </View>
              <View style={s.meta}>
                <View style={s.metaLine}>
                  <Ionicons name="cube-outline" size={13} color={colors.textMuted} />
                  <Text style={s.metaText}>الكمية: {d.quantity}</Text>
                </View>
                <View style={s.metaLine}>
                  <Ionicons name="person-outline" size={13} color={colors.textMuted} />
                  <Text style={s.metaText}>المستلم: {d.recipient} • بواسطة: {d.withdrawn_by}</Text>
                </View>
                <Text style={s.dateText}>{d.withdrawn_at?.slice(0,16)}</Text>
              </View>
              {d.status === 'pending' && canWithdrawDirect && (
                <View style={s.actions}>
                  <View style={{ flex: 1 }}>
                    <Button title="رفض" variant="outline" icon="close-circle-outline" onPress={() => onReject(d.id)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button title="موافقة" icon="checkmark-circle-outline" onPress={() => onApprove(d.id)} />
                  </View>
                </View>
              )}
            </Card>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  searchWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: font.small, color: colors.text, textAlign: 'right' },
  filters: { flexDirection: 'row-reverse', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '700' },
  filterTextActive: { color: 'white' },
  item: { padding: spacing.md, marginBottom: spacing.sm },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm, gap: 8 },
  toolName: { fontWeight: '800', fontSize: font.body, color: colors.text, flex: 1, textAlign: 'right' },
  meta: { gap: 4 },
  metaLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  metaText: { fontSize: font.small, color: colors.textMuted, textAlign: 'right', flex: 1 },
  dateText: { fontSize: font.tiny, color: colors.textLight, textAlign: 'right', marginTop: 4 },
  actions: { flexDirection: 'row-reverse', gap: spacing.sm, marginTop: spacing.md },
});
