import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  approveDisbursement,
  subscribeDisbursements,
  rejectDisbursement,
  deleteDisbursement,
  deleteMultipleDisbursements,
} from '../../src/db/movementsRepo';
import { statusAr } from '../../src/services/excel';
import { useAuth } from '../../src/context/AuthContext';
import { Badge, Button, Card, EmptyState, Loader } from '../../src/components/UI';
import { colors, font, radius, shadow, spacing } from '../../src/theme';
import type { Disbursement } from '../../src/types';

const FILTERS = [
  { key: 'all', label: 'الكل' },
  { key: 'pending', label: 'بانتظار' },
  { key: 'approved', label: 'مصروفة' },
  { key: 'rejected', label: 'مرفوضة' },
  { key: 'overdue', label: 'متأخرة' },
  { key: 'returned', label: 'أُرجعت' },
];

function getStatusTone(status: string): 'info' | 'success' | 'danger' | 'warning' | 'muted' {
  switch (status) {
    case 'pending': return 'warning';
    case 'approved': return 'success';
    case 'rejected': return 'muted';
    case 'returned': return 'info';
    case 'partial': return 'info';
    default: return 'info';
  }
}

// حساب الأيام المتبقية أو المتأخرة
function getDaysInfo(expectedReturn: string | null | undefined): { text: string; isOverdue: boolean; color: string } | null {
  if (!expectedReturn) return null;
  const now = new Date();
  const exp = new Date(expectedReturn);
  const diffMs = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { text: `متأخر ${Math.abs(diffDays)} يوم`, isOverdue: true, color: colors.danger };
  } else if (diffDays === 0) {
    return { text: 'اليوم موعد الإرجاع', isOverdue: false, color: colors.warning };
  } else {
    return { text: `متبقي ${diffDays} يوم`, isOverdue: false, color: colors.success };
  }
}

export default function DisbursementsScreen() {
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const { user, isAdmin, canWithdrawDirect } = useAuth();
  const params = useLocalSearchParams<{ filter?: string }>();
  
  // وضع التحديد الجماعي
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (params.filter) {
      if (['pending', 'approved', 'rejected', 'returned', 'overdue', 'all'].includes(params.filter as string)) {
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
      // فلتر الحالة
      if (filter === 'overdue') {
        // عمليات مؤخر (صرف مؤقت + مصروفة + تجاوز الموعد)
        if (d.withdraw_type !== 'temporary' || d.status !== 'approved') return false;
        const daysInfo = getDaysInfo(d.expected_return);
        if (!daysInfo?.isOverdue) return false;
      } else if (filter !== 'all' && d.status !== filter) {
        return false;
      }
      
      // فلتر البحث
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

  const onDelete = (id: string | number) => {
    Alert.alert(
      'تأكيد الحذف',
      'هل أنت متأكد؟ سيتم إعادة الكمية المتبقية للمخزن.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDisbursement(String(id), user!.username);
              Alert.alert('تم', 'تم حذف العملية وإعادة الكمية للمخزن');
            } catch (e: any) {
              Alert.alert('خطأ', e.message ?? 'فشل الحذف');
            }
          },
        },
      ]
    );
  };

  const onDeleteSelected = () => {
    if (selected.size === 0) return;
    Alert.alert(
      'تأكيد الحذف الجماعي',
      `هل تريد حذف ${selected.size} عملية؟ سيتم إعادة الكميات المتبقية للمخزن.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف الكل',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteMultipleDisbursements(
                Array.from(selected),
                user!.username
              );
              Alert.alert(
                'تم',
                `تم حذف ${result.deleted} عملية.${result.errors.length > 0 ? `\nأخطاء: ${result.errors.length}` : ''}`
              );
              setSelectMode(false);
              setSelected(new Set());
            } catch (e: any) {
              Alert.alert('خطأ', e.message ?? 'فشل الحذف');
            }
          },
        },
      ]
    );
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(d => String(d.id))));
    }
  };

  const onLongPress = useCallback((item: Disbursement) => {
    if (!isAdmin) return;
    
    const options: { text: string; onPress?: () => void; style?: 'destructive' | 'cancel' }[] = [];
    
    // خيار الإرجاع (إذا كان صرف مؤقت ومصروف)
    if (item.withdraw_type === 'temporary' && item.status === 'approved') {
      options.push({
        text: '✅ تسجيل إرجاع',
        onPress: () => router.push(`/return?id=${item.id}`),
      });
    }
    
    // خيار الحذف
    if (item.status === 'approved' || item.status === 'returned' || item.status === 'partial') {
      options.push({
        text: '🗑️ حذف هذه العملية',
        onPress: () => onDelete(item.id),
        style: 'destructive',
      });
    }
    
    options.push({ text: 'إلغاء', style: 'cancel' });

    Alert.alert('خيارات العملية', undefined, options);
  }, [isAdmin]);

  if (loading) return <Loader text="جارٍ تحميل عمليات الصرف..." />;

  return (
    <View style={s.container}>
      {/* شريط الأدوات */}
      <View style={s.toolbar}>
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
        
        {/* زر التحديد - للمدير فقط */}
        {isAdmin && (
          <Pressable
            style={[s.selectBtn, selectMode && s.selectBtnActive]}
            onPress={() => {
              setSelectMode(!selectMode);
              setSelected(new Set());
            }}
          >
            <Ionicons
              name={selectMode ? 'close-circle' : 'checkbox-outline'}
              size={20}
              color={selectMode ? colors.white : colors.primary}
            />
          </Pressable>
        )}
      </View>

      {/* الفلاتر */}
      <FlatList
        horizontal
        inverted
        showsHorizontalScrollIndicator={false}
        data={FILTERS}
        keyExtractor={(f) => f.key}
        contentContainerStyle={s.filtersRow}
        style={s.filtersWrap}
        renderItem={({ item: f }) => (
          <Pressable
            onPress={() => setFilter(f.key)}
            style={[s.filterChip, filter === f.key && s.filterActive]}
          >
            <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        )}
      />

      {/* شريط التحديد الجماعي */}
      {selectMode && (
        <View style={s.selectBar}>
          <Pressable onPress={selectAll} style={s.selectAllBtn}>
            <Ionicons
              name={selected.size === filtered.length && filtered.length > 0 ? 'checkbox' : 'square-outline'}
              size={20}
              color={colors.primary}
            />
            <Text style={s.selectAllText}>
              {selected.size === filtered.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
            </Text>
          </Pressable>
          {selected.size > 0 && (
            <Button
              title={`حذف (${selected.size})`}
              variant="danger"
              icon="trash-outline"
              onPress={onDeleteSelected}
            />
          )}
        </View>
      )}

      {/* القائمة */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="archive-outline"
          title="لا توجد عمليات"
          subtitle="لا توجد عمليات صرف تطابق البحث الحالي"
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(d) => String(d.id)}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item: d }) => (
            <Card style={s.item}>
              <View style={s.row}>
                <View style={s.rowHeader}>
                  {/* أيقونة نوع الصرف */}
                  {d.withdraw_type === 'temporary' ? (
                    <Ionicons name="swap-horizontal" size={16} color={colors.warning} />
                  ) : (
                    <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
                  )}
                  <Text style={s.toolName} numberOfLines={1}>
                    {(d as any).tool_name || `أداة ${d.tool_id}`}
                  </Text>
                </View>
                <Badge text={statusAr(d.status)} tone={getStatusTone(d.status)} />
              </View>
              
              <View style={s.meta}>
                <View style={s.metaLine}>
                  <Ionicons name="cube-outline" size={13} color={colors.textMuted} />
                  <Text style={s.metaText}>
                    الكمية: {d.quantity}
                    {d.returned_qty ? ` — أُرجع: ${d.returned_qty}` : ''}
                  </Text>
                </View>
                <View style={s.metaLine}>
                  <Ionicons name="person-outline" size={13} color={colors.textMuted} />
                  <Text style={s.metaText}>المستلم: {d.recipient}</Text>
                </View>
                <View style={s.metaLine}>
                  <Ionicons name="person-circle-outline" size={13} color={colors.textMuted} />
                  <Text style={s.metaText}>بواسطة: {d.withdrawn_by}</Text>
                </View>
              </View>

              {/* معلومات نوع الصرف والموعد */}
              {d.withdraw_type === 'temporary' && d.expected_return && (
                <View style={s.dateInfo}>
                  <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                  <Text style={s.dateInfoText}>
                    موعد الإرجاع: {new Date(d.expected_return).toLocaleDateString('ar-EG')}
                  </Text>
                  {d.status === 'approved' && (
                    <Text style={[s.daysInfo, { color: getDaysInfo(d.expected_return)?.color }]}>
                      {getDaysInfo(d.expected_return)?.text}
                    </Text>
                  )}
                </View>
              )}

              <Text style={s.dateText}>
                {d.withdrawn_at?.slice(0, 16)}
                {d.withdraw_type === 'temporary' ? ' • مؤقت' : ' • دائم'}
              </Text>

              {/* أزرار الإجراءات */}
              <View style={s.actions}>
                {/* زر الإرجاع - إذا كان صرف مؤقت ومصروف */}
                {d.withdraw_type === 'temporary' && d.status === 'approved' && (
                  <View style={{ flex: 1 }}>
                    <Button
                      title="إرجاع"
                      variant="outline"
                      icon="return-down-back-outline"
                      onPress={() => router.push(`/return?id=${d.id}`)}
                    />
                  </View>
                )}
                
                {/* أزرار الموافقة/الرفض - للمدير فقط */}
                {d.status === 'pending' && canWithdrawDirect && (
                  <>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="رفض"
                        variant="outline"
                        icon="close-circle-outline"
                        onPress={() => onReject(d.id)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="موافقة"
                        icon="checkmark-circle-outline"
                        onPress={() => onApprove(d.id)}
                      />
                    </View>
                  </>
                )}
              </View>

              {/* Checkbox للتحديد - في وضع التحديد */}
              {selectMode && (
                <Pressable
                  style={s.checkbox}
                  onPress={() => toggleSelect(String(d.id))}
                >
                  <Ionicons
                    name={selected.has(String(d.id)) ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={colors.primary}
                  />
                </Pressable>
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
  toolbar: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: font.small, color: colors.text, textAlign: 'right' },
  selectBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  selectBtnActive: {
    backgroundColor: colors.primary,
  },
  filtersWrap: { maxHeight: 42, marginBottom: spacing.md },
  filtersRow: { gap: spacing.sm, paddingHorizontal: 0 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '700' },
  filterTextActive: { color: 'white' },
  selectBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  selectAllBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  selectAllText: { fontSize: font.small, color: colors.primary, fontWeight: '700' },
  item: { padding: spacing.md, marginBottom: spacing.sm, position: 'relative' },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm, gap: 8 },
  rowHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flex: 1 },
  toolName: { fontWeight: '800', fontSize: font.body, color: colors.text, flex: 1, textAlign: 'right' },
  meta: { gap: 4 },
  metaLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  metaText: { fontSize: font.small, color: colors.textMuted, textAlign: 'right', flex: 1 },
  dateInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bg,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  dateInfoText: { fontSize: font.tiny, color: colors.primary, flex: 1 },
  daysInfo: { fontSize: font.tiny, fontWeight: '700' },
  dateText: { fontSize: font.tiny, color: colors.textLight, textAlign: 'right', marginTop: 4 },
  actions: { flexDirection: 'row-reverse', gap: spacing.sm, marginTop: spacing.md },
  checkbox: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
  },

});
