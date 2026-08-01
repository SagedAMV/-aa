import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  reportInventoryPdf,
  reportTopToolsPdf,
  reportDisbursementsPdf,
} from '../../src/services/pdf';
import { exportInventory, exportMovements } from '../../src/services/excel';
import { getDashboardStats, topWithdrawnTools } from '../../src/db/movementsRepo';
import { Card, Loader } from '../../src/components/UI';
import { colors, font, radius, spacing } from '../../src/theme';
import type { DashboardStats } from '../../src/types';

export default function ReportsScreen() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [top, setTop] = useState<{ name: string; times: number; units: number }[]>([]);
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, t] = await Promise.all([getDashboardStats(), topWithdrawnTools(5)]);
    setStats(s);
    setTop(t);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const run = async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      Alert.alert('خطأ في التصدير', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!stats) return <Loader />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
    >
      {/* ملخص */}
      <Card>
        <Text style={s.cardTitle}>ملخص المخزن</Text>
        <View style={s.summaryGrid}>
          <Sum label="الأصناف" value={stats.totalTools} />
          <Sum label="الوحدات" value={stats.totalUnits} />
          <Sum label="المتاح" value={stats.availableUnits} color={colors.success} />
          <Sum
            label="مسحوب"
            value={stats.totalUnits - stats.availableUnits}
            color={colors.accent}
          />
          <Sum label="كمية منخفضة" value={stats.lowStockCount} color={colors.info} />
        </View>
      </Card>

      {/* الفترة */}
      <Card>
        <Text style={s.cardTitle}>فترة التقرير</Text>
        <View style={{ flexDirection: 'row-reverse', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={s.dateLabel}>من</Text>
            <TextInput
              style={s.dateInput}
              value={from}
              onChangeText={setFrom}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textLight}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.dateLabel}>إلى</Text>
            <TextInput
              style={s.dateInput}
              value={to}
              onChangeText={setTo}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textLight}
            />
          </View>
        </View>
      </Card>

      {/* تقارير PDF */}
      <Text style={s.section}>تقارير PDF</Text>
      <Card style={{ padding: spacing.sm }}>
        <Item
          icon="albums-outline"
          title="جرد المخزن الكامل"
          subtitle="جميع الأدوات والكميات الحالية"
          loading={busy === 'inv-pdf'}
          onPress={() => run('inv-pdf', reportInventoryPdf)}
        />
        <Item
          icon="arrow-down-circle-outline"
          title="تقرير الصرف"
          subtitle={`من ${from} إلى ${to}`}
          loading={busy === 'wd-pdf'}
          onPress={() => run('wd-pdf', () => reportDisbursementsPdf(from, to))}
        />
        <Item
          icon="trophy-outline"
          title="أكثر الأدوات صرفاً"
          subtitle="ترتيب حسب عدد مرات الصرف"
          loading={busy === 'top-pdf'}
          onPress={() => run('top-pdf', reportTopToolsPdf)}
          last
        />
      </Card>

      {/* تصدير Excel */}
      <Text style={s.section}>تصدير Excel</Text>
      <Card style={{ padding: spacing.sm }}>
        <Item
          icon="grid-outline"
          title="تصدير الجرد (xlsx)"
          subtitle="ملف Excel بكل الأدوات"
          loading={busy === 'inv-xls'}
          onPress={() => run('inv-xls', exportInventory)}
        />
        <Item
          icon="swap-vertical-outline"
          title="تصدير الحركات (xlsx)"
          subtitle="الصرف والإضافات في ورقتين"
          loading={busy === 'mov-xls'}
          onPress={() => run('mov-xls', () => exportMovements(from, to))}
          last
        />
      </Card>

      {/* أكثر الأدوات صرفاً */}
      {top.length > 0 && (
        <>
          <Text style={s.section}>الأكثر صرفاً</Text>
          <Card>
            {top.map((t, i) => (
              <View key={t.name} style={s.topRow}>
                <View style={s.rank}>
                  <Text style={s.rankText}>{i + 1}</Text>
                </View>
                <Text style={s.topName} numberOfLines={1}>
                  {t.name}
                </Text>
                <Text style={s.topCount}>{t.times} مرة</Text>
              </View>
            ))}
          </Card>
        </>
      )}

      <Text style={s.note}>
        📄 كل التقارير تُولَّد وتُحفظ محلياً على الجهاز
      </Text>
    </ScrollView>
  );
}

function Sum({
  label,
  value,
  color = colors.text,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <View style={s.sumBox}>
      <Text style={[s.sumValue, { color }]}>{value}</Text>
      <Text style={s.sumLabel}>{label}</Text>
    </View>
  );
}

function Item({
  icon,
  title,
  subtitle,
  onPress,
  loading,
  danger,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  loading?: boolean;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        s.item,
        !last && s.itemBorder,
        { opacity: pressed || loading ? 0.6 : 1 },
      ]}
    >
      <View
        style={[
          s.itemIcon,
          { backgroundColor: danger ? colors.dangerLight : colors.primaryLight },
        ]}
      >
        <Ionicons
          name={loading ? 'hourglass-outline' : icon}
          size={20}
          color={danger ? colors.danger : colors.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.itemTitle}>{title}</Text>
        <Text style={s.itemSub}>{subtitle}</Text>
      </View>
      <Ionicons name="download-outline" size={18} color={colors.textLight} />
    </Pressable>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

const s = StyleSheet.create({
  cardTitle: {
    fontSize: font.h3,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'right',
  },
  summaryGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap' },
  sumBox: { width: '33.3%', alignItems: 'center', paddingVertical: spacing.sm },
  sumValue: { fontSize: font.h2, fontWeight: '800' },
  sumLabel: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },

  dateLabel: { fontSize: font.tiny, color: colors.textMuted, marginBottom: 4, textAlign: 'right' },
  dateInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 10,
    fontSize: font.small,
    color: colors.text,
    textAlign: 'center',
  },

  section: {
    fontSize: font.h3,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    textAlign: 'right',
  },

  item: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  itemIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: { fontSize: font.small, fontWeight: '700', color: colors.text, textAlign: 'right' },
  itemSub: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2, textAlign: 'right' },

  topRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 9,
  },
  rank: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontSize: font.tiny, fontWeight: '800', color: colors.primary },
  topName: { flex: 1, fontSize: font.small, color: colors.text, textAlign: 'right' },
  topCount: { fontSize: font.tiny, color: colors.textMuted, fontWeight: '700' },

  note: {
    fontSize: font.tiny,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
