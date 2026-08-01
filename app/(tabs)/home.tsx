import React, { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDashboardStats } from '../../src/db/movementsRepo';
import { checkOverdueAndNotify } from '../../src/services/notifications';
import { useAuth } from '../../src/context/AuthContext';
import { Card, Loader } from '../../src/components/UI';
import { colors, font, radius, shadow, spacing } from '../../src/theme';
import type { DashboardStats } from '../../src/types';

export default function HomeScreen() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const s = await getDashboardStats();
    setStats(s);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!stats) return <Loader text="جارٍ تحميل الإحصائيات..." />;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* ترحيب */}
      <View style={s.header}>
        <View>
          <Text style={s.hello}>مرحباً، {user?.full_name}</Text>
          <Text style={s.role}>
            {isAdmin ? 'مدير المخزن' : 'مستخدم'} — وضع العمل: محلي بالكامل
          </Text>
        </View>
        <Ionicons name="cube" size={34} color={colors.primary} />
      </View>

      {/* تنبيهات */}
      {stats.overdueCount > 0 && (
        <Pressable
          onPress={() => router.push('/(tabs)/disbursements?filter=overdue')}
          style={[s.alert, { backgroundColor: colors.dangerLight }]}
        >
          <Ionicons name="warning" size={22} color={colors.danger} />
          <Text style={[s.alertText, { color: colors.danger }]}>
            {stats.overdueCount} أداة تجاوزت موعد الإرجاع
          </Text>
          <Ionicons name="chevron-back" size={18} color={colors.danger} />
        </Pressable>
      )}

      {stats.lowStockCount > 0 && (
        <Pressable
          onPress={() => router.push('/(tabs)/tools?filter=low')}
          style={[s.alert, { backgroundColor: colors.infoLight }]}
        >
          <Ionicons name="trending-down" size={22} color={colors.info} />
          <Text style={[s.alertText, { color: colors.info }]}>
            {stats.lowStockCount} أداة بكمية منخفضة
          </Text>
          <Ionicons name="chevron-back" size={18} color={colors.info} />
        </Pressable>
      )}

      {/* بطاقات الإحصاء */}
      <View style={s.grid}>
        <StatCard
          icon="cube-outline"
          label="الأصناف"
          value={stats.totalTools}
          color={colors.primary}
          onPress={() => router.push('/(tabs)/tools')}
        />
      </View>

      {/* إجراءات سريعة */}
      <Text style={s.sectionTitle}>إجراءات سريعة</Text>
      <Card style={{ padding: spacing.md }}>
        <View style={s.actionsGrid}>
          <Action
            icon="qr-code-outline"
            label="مسح باركود"
            onPress={() => router.push('/scan')}
          />
          <Action
            icon="arrow-down-circle-outline"
            label="تسجيل صرف"
            onPress={() => router.push('/withdraw/new')}
          />
          <Action
            icon="add-circle-outline"
            label="تسجيل إضافة"
            onPress={() => router.push('/addition/new')}
          />
          <Action
            icon="cube-outline"
            label="أداة جديدة"
            onPress={() => router.push('/tool/new')}
          />
          <Action
            icon="document-text-outline"
            label="التقارير"
            onPress={() => router.push('/(tabs)/reports')}
          />
          <Action
            icon="cloud-upload-outline"
            label="استيراد Excel"
            onPress={() => router.push('/import-excel')}
          />
        </View>
      </Card>

      <Text style={s.footer}>
        📴 جميع البيانات مخزَّنة على هذا الجهاز فقط — لا يوجد أي اتصال بخوادم
        خارجية
      </Text>
    </ScrollView>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.statCard, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={26} color={color} />
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </Pressable>
  );
}

function Action({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.action, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={s.actionIcon}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={s.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  hello: { fontSize: font.h2, fontWeight: '800', color: colors.text },
  role: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },

  alert: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  alertText: { flex: 1, fontSize: font.small, fontWeight: '700' },

  grid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  statCard: {
    width: '47.5%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 4,
    ...shadow.card,
  },
  statValue: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: font.tiny, color: colors.textMuted },

  sectionTitle: {
    fontSize: font.h3,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    textAlign: 'right',
  },

  actionsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  action: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: 6,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: font.tiny,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },

  footer: {
    fontSize: font.tiny,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.xl,
    lineHeight: 18,
  },
});
