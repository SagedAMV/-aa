import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listCategories, listTools } from '../../src/db/toolsRepo';
import { Badge, EmptyState, Loader } from '../../src/components/UI';
import { colors, font, radius, shadow, spacing } from '../../src/theme';
import type { Category, Tool } from '../../src/types';

export default function ToolsScreen() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const [tools, setTools] = useState<Tool[] | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [catId, setCatId] = useState<string | number | null>(null);
  const [lowOnly, setLowOnly] = useState(params.filter === 'low');

  const load = useCallback(async () => {
    const [t, c] = await Promise.all([
      listTools({ search, categoryId: catId, onlyLowStock: lowOnly }),
      listCategories(),
    ]);
    setTools(t);
    setCats(c);
  }, [search, catId, lowOnly]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const totalUnits = useMemo(
    () => (tools ?? []).reduce((s, t) => s + t.total_quantity, 0),
    [tools]
  );

  return (
    <View style={s.container}>
      {/* شريط البحث */}
      <View style={s.searchBar}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="ابحث بالاسم أو الرقم التسلسلي أو الموقع..."
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textLight} />
          </Pressable>
        )}
        <Pressable onPress={() => router.push('/scan')} hitSlop={8}>
          <Ionicons name="qr-code-outline" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {/* فلاتر التصنيف */}
      <FlatList
        horizontal
        inverted
        showsHorizontalScrollIndicator={false}
        data={[{ id: -1, name: 'الكل', color: colors.primary } as Category, ...cats]}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={s.chipsRow}
        style={s.chipsWrap}
        renderItem={({ item }) => {
          const active = item.id === -1 ? catId === null : catId === item.id;
          return (
            <Pressable
              onPress={() => setCatId(item.id === -1 ? null : item.id)}
              style={[
                s.chip,
                active && { backgroundColor: item.color, borderColor: item.color },
              ]}
            >
              <Text style={[s.chipText, active && { color: colors.white }]}>
                {item.name}
              </Text>
            </Pressable>
          );
        }}
      />

      {/* شريط ملخص */}
      <View style={s.summary}>
        <Text style={s.summaryText}>
          {tools?.length ?? 0} صنف — {totalUnits} وحدة
        </Text>
        <Pressable
          onPress={() => setLowOnly((v) => !v)}
          style={[s.lowBtn, lowOnly && { backgroundColor: colors.dangerLight }]}
        >
          <Ionicons
            name="trending-down"
            size={14}
            color={lowOnly ? colors.danger : colors.textMuted}
          />
          <Text
            style={[s.lowText, lowOnly && { color: colors.danger, fontWeight: '700' }]}
          >
            كمية منخفضة
          </Text>
        </Pressable>
      </View>

      {/* القائمة */}
      {!tools ? (
        <Loader />
      ) : tools.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          title="لا توجد أدوات"
          subtitle="أضف أداة جديدة أو استورد قائمة من ملف Excel"
        />
      ) : (
        <FlatList
          data={tools}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 90 }}
          renderItem={({ item }) => <ToolRow tool={item} />}
        />
      )}

      {/* زر عائم */}
      <Pressable style={s.fab} onPress={() => router.push('/tool/new')}>
        <Ionicons name="add" size={28} color={colors.white} />
      </Pressable>
    </View>
  );
}

function ToolRow({ tool }: { tool: Tool }) {
  const out = tool.total_quantity - tool.available_qty;
  const isLow = tool.min_quantity > 0 && tool.available_qty <= tool.min_quantity;

  return (
    <Pressable
      onPress={() => router.push(`/tool/${tool.id}`)}
      style={({ pressed }) => [s.row, { opacity: pressed ? 0.75 : 1 }]}
    >
      <View
        style={[
          s.rowStripe,
          { backgroundColor: tool.category_color ?? colors.primary },
        ]}
      />
      <View style={{ flex: 1 }}>
        <View style={s.rowTop}>
          <Text style={s.rowTitle} numberOfLines={1}>
            {tool.name}
          </Text>
          {isLow && <Badge text="منخفضة" tone="danger" />}
        </View>

        <View style={s.metaRow}>
          {tool.category_name ? (
            <Meta icon="pricetag-outline" text={tool.category_name} />
          ) : null}
          {tool.location ? (
            <Meta icon="location-outline" text={tool.location} />
          ) : null}
          {tool.serial_number ? (
            <Meta icon="barcode-outline" text={tool.serial_number} />
          ) : null}
        </View>

        <View style={s.qtyRow}>
          <QtyPill label="المتاح" value={tool.available_qty} color={colors.success} />
          <QtyPill label="مسحوب" value={out} color={colors.accent} />
          <QtyPill label="الإجمالي" value={tool.total_quantity} color={colors.info} />
        </View>
      </View>
      <Ionicons name="chevron-back" size={18} color={colors.textLight} />
    </Pressable>
  );
}

function Meta({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={s.meta}>
      <Ionicons name={icon} size={12} color={colors.textMuted} />
      <Text style={s.metaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function QtyPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={s.pill}>
      <Text style={[s.pillValue, { color }]}>{value}</Text>
      <Text style={s.pillLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: font.small,
    color: colors.text,
    textAlign: 'right',
  },

  chipsWrap: { maxHeight: 46, marginTop: spacing.sm },
  chipsRow: { paddingHorizontal: spacing.lg, gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: { fontSize: font.tiny, fontWeight: '700', color: colors.textMuted },

  summary: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  summaryText: { fontSize: font.tiny, color: colors.textMuted, fontWeight: '600' },
  lowBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  lowText: { fontSize: font.tiny, color: colors.textMuted },

  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  rowStripe: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  rowTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: font.body,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
  },

  metaRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: 5,
  },
  meta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3 },
  metaText: { fontSize: font.tiny, color: colors.textMuted, maxWidth: 110 },

  qtyRow: { flexDirection: 'row-reverse', gap: spacing.lg, marginTop: 8 },
  pill: { flexDirection: 'row-reverse', alignItems: 'baseline', gap: 3 },
  pillValue: { fontSize: font.body, fontWeight: '800' },
  pillLabel: { fontSize: font.tiny, color: colors.textLight },

  fab: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
