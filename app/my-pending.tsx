import React, { useEffect, useState, useMemo } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  subscribeDisbursements,
  subscribeAdditions,
} from '../src/db/movementsRepo';
import { useAuth } from '../src/context/AuthContext';
import { Badge, Card, EmptyState, Loader } from '../src/components/UI';
import { colors, font, radius, spacing } from '../src/theme';
import type { Disbursement, Addition } from '../src/types';

type Tab = 'withdrawals' | 'additions';

export default function MyPendingScreen() {
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<Disbursement[]>([]);
  const [additions, setAdditions] = useState<Addition[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('withdrawals');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const unsub1 = subscribeDisbursements((data) => {
      setWithdrawals(data);
      setLoading(false);
    });
    const unsub2 = subscribeAdditions((data) => {
      setAdditions(data);
    });
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  const myPendingWithdrawals = useMemo(
    () => withdrawals.filter(w => w.withdrawn_by === user?.username && w.status === 'pending'),
    [withdrawals, user]
  );

  const myPendingAdditions = useMemo(
    () => additions.filter(a => a.added_by === user?.username && a.status === 'pending'),
    [additions, user]
  );

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  if (loading) return <Loader text="جارٍ تحميل طلباتك..." />;

  return (
    <View style={s.container}>
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
            طلبات الصرف ({myPendingWithdrawals.length})
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
            طلبات الإضافة ({myPendingAdditions.length})
          </Text>
        </Pressable>
      </View>

      {/* المحتوى */}
      {activeTab === 'withdrawals' ? (
        myPendingWithdrawals.length === 0 ? (
          <EmptyState
            icon="checkmark-done-outline"
            title="لا توجد طلبات معلقة"
            subtitle="كل طلبات الصرف تمت معالجتها ✅"
          />
        ) : (
          <FlatList
            data={myPendingWithdrawals}
            keyExtractor={(w) => String(w.id)}
            contentContainerStyle={{ padding: spacing.lg }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            renderItem={({ item: w }) => (
              <Card style={s.card}>
                <View style={s.row}>
                  <Text style={s.title}>{w.tool_name || `أداة ${w.tool_id}`}</Text>
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
                <View style={s.pendingBanner}>
                  <Ionicons name="hourglass-outline" size={16} color={colors.warning} />
                  <Text style={s.pendingText}>
                    في انتظار مراجعة مدير المخزن
                  </Text>
                </View>
              </Card>
            )}
          />
        )
      ) : (
        myPendingAdditions.length === 0 ? (
          <EmptyState
            icon="checkmark-done-outline"
            title="لا توجد طلبات معلقة"
            subtitle="كل طلبات الإضافة تمت معالجتها ✅"
          />
        ) : (
          <FlatList
            data={myPendingAdditions}
            keyExtractor={(a) => String(a.id)}
            contentContainerStyle={{ padding: spacing.lg }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            renderItem={({ item: a }) => (
              <Card style={s.card}>
                <View style={s.row}>
                  <Text style={s.title}>{a.tool_name || `أداة ${a.tool_id}`}</Text>
                  <Badge text="بانتظار الموافقة" tone="warning" />
                </View>
                <View style={s.meta}>
                  <View style={s.metaLine}>
                    <Ionicons name="add-outline" size={14} color={colors.textMuted} />
                    <Text style={s.metaText}>الكمية المضافة: {a.quantity}</Text>
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
                <View style={s.pendingBanner}>
                  <Ionicons name="hourglass-outline" size={16} color={colors.warning} />
                  <Text style={s.pendingText}>
                    في انتظار مراجعة مدير المخزن
                  </Text>
                </View>
              </Card>
            )}
          />
        )
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tabs: {
    flexDirection: 'row-reverse',
    backgroundColor: colors.card,
    padding: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: font.small, fontWeight: '700', color: colors.textMuted },
  card: { padding: spacing.md, marginBottom: spacing.md },
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontSize: font.body, fontWeight: '800', color: colors.text, flex: 1, textAlign: 'right' },
  meta: { gap: 4 },
  metaLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  metaText: { fontSize: font.small, color: colors.textMuted, flex: 1, textAlign: 'right' },
  pendingBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.warningLight,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  pendingText: { fontSize: font.tiny, color: colors.warning, fontWeight: '600' },
});
