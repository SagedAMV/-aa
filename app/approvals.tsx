import React, { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import {
  subscribeDisbursements,
  subscribeAdditions,
  approveDisbursement,
  rejectDisbursement,
  approveAddition,
} from '../src/db/movementsRepo';
import { useAuth } from '../src/context/AuthContext';
import { Badge, Button, Card, EmptyState, Loader } from '../src/components/UI';
import { colors, font, radius, spacing } from '../src/theme';
import type { Disbursement, Addition } from '../src/types';

type Tab = 'withdrawals' | 'additions';

export default function ApprovalsScreen() {
  const { user, isAdmin } = useAuth();
  const [withdrawals, setWithdrawals] = useState<Disbursement[]>([]);
  const [additions, setAdditions] = useState<Addition[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('withdrawals');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      const unsub1 = subscribeDisbursements((data) => {
        setWithdrawals(data);
      });
      const unsub2 = subscribeAdditions((data) => {
        setAdditions(data);
      });
      return () => { unsub1(); unsub2(); };
    }, [])
  );

  const pendingWithdrawals = useMemo(
    () => withdrawals.filter(w => w.status === 'pending'),
    [withdrawals]
  );

  const pendingAdditions = useMemo(
    () => additions.filter(a => a.status === 'pending'),
    [additions]
  );

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const onApproveWithdrawal = (id: string | number, toolName: string) => {
    Alert.alert(
      'تأكيد الموافقة',
      `هل تريد الموافقة على صرف "${toolName}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'موافقة',
          onPress: async () => {
            try {
              await approveDisbursement(String(id), user?.username ?? 'admin');
              Alert.alert('تم', 'تمت الموافقة على الصرف');
            } catch (e: any) {
              Alert.alert('خطأ', e.message ?? 'فشل الموافقة');
            }
          },
        },
      ]
    );
  };

  const onRejectWithdrawal = (id: string | number, toolName: string) => {
    Alert.alert(
      'تأكيد الرفض',
      `هل تريد رفض صرف "${toolName}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'رفض',
          style: 'destructive',
          onPress: async () => {
            try {
              await rejectDisbursement(String(id), user?.username ?? 'admin');
              Alert.alert('تم', 'تم رفض الطلب');
            } catch (e: any) {
              Alert.alert('خطأ', e.message ?? 'فشل الرفض');
            }
          },
        },
      ]
    );
  };

  const onApproveAddition = (id: string | number, toolName: string, qty: number) => {
    Alert.alert(
      'تأكيد الموافقة',
      `هل تريد الموافقة على إضافة ${qty} وحدة إلى "${toolName}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'موافقة',
          onPress: async () => {
            try {
              await approveAddition(String(id), user?.username ?? 'admin');
              Alert.alert('تم', 'تمت الموافقة على الإضافة');
            } catch (e: any) {
              Alert.alert('خطأ', e.message ?? 'فشل الموافقة');
            }
          },
        },
      ]
    );
  };

  const onRejectAddition = (id: string | number, toolName: string) => {
    Alert.alert(
      'تأكيد الرفض',
      `هل تريد رفض إضافة "${toolName}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'رفض',
          style: 'destructive',
          onPress: async () => {
            try {
              // Reject addition by deleting it
              const { deleteDoc, doc } = await import('firebase/firestore');
              const { db } = await import('../src/services/firebase');
              await deleteDoc(doc(db, 'additions', String(id)));
              Alert.alert('تم', 'تم رفض الطلب');
            } catch (e: any) {
              Alert.alert('خطأ', e.message ?? 'فشل الرفض');
            }
          },
        },
      ]
    );
  };

  if (!isAdmin) {
    return (
      <View style={s.center}>
        <Ionicons name="lock-closed" size={48} color={colors.textLight} />
        <Text style={s.centerText}>هذه الصفحة متاحة للمدير فقط</Text>
      </View>
    );
  }

  const totalPending = pendingWithdrawals.length + pendingAdditions.length;

  if (totalPending === 0) {
    return (
      <EmptyState
        icon="checkmark-done-outline"
        title="لا توجد طلبات معلقة"
        subtitle="كل الطلبات تمت معالجتها ✅"
      />
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* التبويبات */}
      <View style={s.tabs}>
        <Pressable
          style={[s.tab, activeTab === 'withdrawals' && s.tabActive]}
          onPress={() => setActiveTab('withdrawals')}
        >
          <Ionicons
            name="arrow-down-circle-outline"
            size={18}
            color={activeTab === 'withdrawals' ? colors.white : colors.textMuted}
          />
          <Text style={[s.tabText, activeTab === 'withdrawals' && { color: colors.white }]}>
            صرف ({pendingWithdrawals.length})
          </Text>
        </Pressable>
        <Pressable
          style={[s.tab, activeTab === 'additions' && s.tabActive]}
          onPress={() => setActiveTab('additions')}
        >
          <Ionicons
            name="add-circle-outline"
            size={18}
            color={activeTab === 'additions' ? colors.white : colors.textMuted}
          />
          <Text style={[s.tabText, activeTab === 'additions' && { color: colors.white }]}>
            إضافة ({pendingAdditions.length})
          </Text>
        </Pressable>
      </View>

      {/* طلبات الصرف */}
      {activeTab === 'withdrawals' && (
        pendingWithdrawals.length === 0 ? (
          <EmptyState
            icon="checkmark-done-outline"
            title="لا توجد طلبات صرف معلقة"
            subtitle="تمت معالجة كل الطلبات ✅"
          />
        ) : (
          pendingWithdrawals.map((w) => (
            <Card key={String(w.id)} style={s.card}>
              <View style={s.cardHeader}>
                <View style={s.cardHeaderInfo}>
                  <Ionicons name="cube-outline" size={20} color={colors.primary} />
                  <Text style={s.cardTitle}>{w.tool_name || `أداة ${w.tool_id}`}</Text>
                </View>
                <Badge text="بانتظار الموافقة" tone="warning" />
              </View>

              <View style={s.meta}>
                <View style={s.metaLine}>
                  <Ionicons name="cube-outline" size={14} color={colors.textMuted} />
                  <Text style={s.metaText}>الكمية: {w.quantity}</Text>
                </View>
                <View style={s.metaLine}>
                  <Ionicons name="person-outline" size={14} color={colors.textMuted} />
                  <Text style={s.metaText}>المستلم: {w.recipient}</Text>
                </View>
                <View style={s.metaLine}>
                  <Ionicons name="person-circle-outline" size={14} color={colors.textMuted} />
                  <Text style={s.metaText}>بواسطة: {w.withdrawn_by}</Text>
                </View>
                {w.reason && (
                  <View style={s.metaLine}>
                    <Ionicons name="help-circle-outline" size={14} color={colors.textMuted} />
                    <Text style={s.metaText}>السبب: {w.reason}</Text>
                  </View>
                )}
                <View style={s.metaLine}>
                  <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                  <Text style={s.metaText}>{w.withdrawn_at?.slice(0, 16)}</Text>
                </View>
              </View>

              <View style={s.actions}>
                <View style={s.actionBtnWrap}>
                  <Button
                    title="رفض"
                    variant="outline"
                    icon="close-circle-outline"
                    onPress={() => onRejectWithdrawal(w.id, w.tool_name ?? '')}
                  />
                </View>
                <View style={s.actionBtnWrap}>
                  <Button
                    title="موافقة"
                    icon="checkmark-circle-outline"
                    onPress={() => onApproveWithdrawal(w.id, w.tool_name ?? '')}
                  />
                </View>
              </View>
            </Card>
          ))
        )
      )}

      {/* طلبات الإضافة */}
      {activeTab === 'additions' && (
        pendingAdditions.length === 0 ? (
          <EmptyState
            icon="checkmark-done-outline"
            title="لا توجد طلبات إضافة معلقة"
            subtitle="تمت معالجة كل الطلبات ✅"
          />
        ) : (
          pendingAdditions.map((a) => (
            <Card key={String(a.id)} style={s.card}>
              <View style={s.cardHeader}>
                <View style={s.cardHeaderInfo}>
                  <Ionicons name="add-circle-outline" size={20} color={colors.success} />
                  <Text style={s.cardTitle}>{a.tool_name || `أداة ${a.tool_id}`}</Text>
                </View>
                <Badge text="بانتظار الموافقة" tone="warning" />
              </View>

              <View style={s.meta}>
                <View style={s.metaLine}>
                  <Ionicons name="add-outline" size={14} color={colors.textMuted} />
                  <Text style={s.metaText}>الكمية المضافة: {a.quantity}</Text>
                </View>
                <View style={s.metaLine}>
                  <Ionicons name="person-circle-outline" size={14} color={colors.textMuted} />
                  <Text style={s.metaText}>بواسطة: {a.added_by}</Text>
                </View>
                {a.source && (
                  <View style={s.metaLine}>
                    <Ionicons name="pricetag-outline" size={14} color={colors.textMuted} />
                    <Text style={s.metaText}>المصدر: {a.source}</Text>
                  </View>
                )}
                <View style={s.metaLine}>
                  <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                  <Text style={s.metaText}>{a.added_at?.slice(0, 16)}</Text>
                </View>
              </View>

              <View style={s.actions}>
                <View style={s.actionBtnWrap}>
                  <Button
                    title="رفض"
                    variant="outline"
                    icon="close-circle-outline"
                    onPress={() => onRejectAddition(a.id, a.tool_name ?? '')}
                  />
                </View>
                <View style={s.actionBtnWrap}>
                  <Button
                    title="موافقة"
                    icon="checkmark-circle-outline"
                    variant="success"
                    onPress={() => onApproveAddition(a.id, a.tool_name ?? '', a.quantity)}
                  />
                </View>
              </View>
            </Card>
          ))
        )
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.bg, padding: spacing.xl,
  },
  centerText: {
    fontSize: font.h3, color: colors.textMuted,
    textAlign: 'center', marginTop: spacing.md,
  },
  tabs: {
    flexDirection: 'row-reverse', backgroundColor: colors.card,
    padding: spacing.sm, gap: spacing.sm, borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1, flexDirection: 'row-reverse', alignItems: 'center',
    justifyContent: 'center', gap: 6, paddingVertical: 10,
    borderRadius: radius.md, backgroundColor: colors.bg,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: font.small, fontWeight: '700', color: colors.textMuted },
  card: { padding: spacing.md, marginBottom: spacing.md },
  cardHeader: {
    flexDirection: 'row-reverse', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: spacing.md,
  },
  cardHeaderInfo: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flex: 1 },
  cardTitle: { fontSize: font.body, fontWeight: '800', color: colors.text, flex: 1, textAlign: 'right' },
  meta: { gap: 4 },
  metaLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  metaText: { fontSize: font.small, color: colors.textMuted, flex: 1, textAlign: 'right' },
  actions: { flexDirection: 'row-reverse', gap: spacing.sm, marginTop: spacing.md },
  actionBtnWrap: { flex: 1 },
});
