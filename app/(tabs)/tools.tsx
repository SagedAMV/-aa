import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listCategories, listTools, findDuplicateTools, bulkUpdateTools } from '../../src/db/toolsRepo';
import { Badge, Button, EmptyState, Loader } from '../../src/components/UI';
import { useAuth } from '../../src/context/AuthContext';
import { colors, font, radius, shadow, spacing } from '../../src/theme';
import type { Category, Tool, ToolSortBy } from '../../src/types';

const SORT_OPTIONS: { key: ToolSortBy; label: string; icon: string }[] = [
  { key: 'name', label: 'الاسم', icon: 'text-outline' },
  { key: 'quantity', label: 'الكمية', icon: 'stats-chart-outline' },
  { key: 'created', label: 'الأقدم', icon: 'calendar-outline' },
  { key: 'updated', label: 'الأحدث', icon: 'time-outline' },
];

export default function ToolsScreen() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const { isAdmin, canManageTools } = useAuth();
  const [tools, setTools] = useState<Tool[] | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [catId, setCatId] = useState<string | number | null>(null);
  const [lowOnly, setLowOnly] = useState(params.filter === 'low');
  const [showHidden, setShowHidden] = useState(false);
  const [sortBy, setSortBy] = useState<ToolSortBy>('name');
  
  // وضع التحديد الجماعي
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  
  // الأدوات المتكررة
  const [duplicateCount, setDuplicateCount] = useState(0);

  const load = useCallback(async () => {
    const [t, c] = await Promise.all([
      listTools({ search, categoryId: catId, onlyLowStock: lowOnly, includeHidden: isAdmin || showHidden }),
      listCategories(),
    ]);
    setTools(t);
    setCats(c);
    
    // كشف الأدوات المتكررة (للمدير فقط)
    if (isAdmin) {
      const dupes = await findDuplicateTools();
      let count = 0;
      dupes.forEach(tools => { count += tools.length - 1; });
      setDuplicateCount(count);
    }
  }, [search, catId, lowOnly, isAdmin, showHidden]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const totalUnits = useMemo(
    () => (tools ?? []).reduce((s, t) => s + t.total_quantity, 0),
    [tools]
  );

  // ترتيب الأدوات
  const sortedTools = useMemo(() => {
    if (!tools) return [];
    const sorted = [...tools];
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'quantity':
        sorted.sort((a, b) => b.total_quantity - a.total_quantity);
        break;
      case 'created':
        sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'updated':
        sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        break;
    }
    return sorted;
  }, [tools, sortBy]);

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
    if (selected.size === (tools?.length ?? 0)) {
      setSelected(new Set());
    } else {
      setSelected(new Set((tools ?? []).map(t => String(t.id))));
    }
  };

  const onBulkDelete = () => {
    if (selected.size === 0) return;
    Alert.alert(
      'تأكيد الحذف الجماعي',
      `هل تريد حذف ${selected.size} أداة؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            try {
              await bulkUpdateTools(Array.from(selected), { is_deleted: true }, 'admin');
              Alert.alert('تم', `تم حذف ${selected.size} أداة`);
              setSelectMode(false);
              setSelected(new Set());
              load();
            } catch (e: any) {
              Alert.alert('خطأ', e.message ?? 'فشل الحذف');
            }
          },
        },
      ]
    );
  };

  const onBulkHide = () => {
    if (selected.size === 0) return;
    Alert.alert(
      'إخفاء الأدوات',
      `هل تريد إخفاء ${selected.size} أداة عن المستخدمين؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إخفاء',
          onPress: async () => {
            try {
              await bulkUpdateTools(Array.from(selected), { is_hidden: true }, 'admin');
              Alert.alert('تم', `تم إخفاء ${selected.size} أداة`);
              setSelectMode(false);
              setSelected(new Set());
              load();
            } catch (e: any) {
              Alert.alert('خطأ', e.message ?? 'فشل الإخفاء');
            }
          },
        },
      ]
    );
  };

  const onBulkUnhide = () => {
    if (selected.size === 0) return;
    try {
      bulkUpdateTools(Array.from(selected), { is_hidden: false }, 'admin').then(() => {
        Alert.alert('تم', `تم إظهار ${selected.size} أداة`);
        setSelectMode(false);
        setSelected(new Set());
        load();
      });
    } catch (e: any) {
      Alert.alert('خطأ', e.message ?? 'فشل الإظهار');
    }
  };

  return (
    <View style={s.container}>
      {/* تنبيه الأدوات المتكررة (للمدير فقط) */}
      {isAdmin && duplicateCount > 0 && (
        <Pressable
          style={s.duplicateAlert}
          onPress={() => router.push('/duplicates')}
        >
          <Ionicons name="copy-outline" size={18} color={colors.warning} />
          <Text style={s.duplicateAlertText}>
            توجد {duplicateCount} أداة بأسماء متكررة
          </Text>
          <Ionicons name="chevron-back" size={16} color={colors.warning} />
        </Pressable>
      )}

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
        {isAdmin && canManageTools && (
          <Pressable onPress={() => router.push('/scan')} hitSlop={8}>
            <Ionicons name="qr-code-outline" size={20} color={colors.primary} />
          </Pressable>
        )}
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

      {/* شريط الترتيب */}
      <View style={s.sortBar}>
        {SORT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            onPress={() => setSortBy(opt.key)}
            style={[s.sortBtn, sortBy === opt.key && s.sortBtnActive]}
          >
            <Ionicons
              name={opt.icon as any}
              size={12}
              color={sortBy === opt.key ? colors.white : colors.textMuted}
            />
            <Text style={[s.sortText, sortBy === opt.key && { color: colors.white }]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* شريط ملخص + أدوات */}
      <View style={s.summary}>
        <Text style={s.summaryText}>
          {tools?.length ?? 0} صنف — {totalUnits} وحدة
        </Text>
        <View style={s.summaryActions}>
          <Pressable
            onPress={() => setLowOnly((v) => !v)}
            style={[s.lowBtn, lowOnly && { backgroundColor: colors.dangerLight }]}
          >
            <Ionicons
              name="trending-down"
              size={14}
              color={lowOnly ? colors.danger : colors.textMuted}
            />
            <Text style={[s.lowText, lowOnly && { color: colors.danger, fontWeight: '700' }]}>
              منخفضة
            </Text>
          </Pressable>
          
          {/* زر إظهار المخفية (للمدير فقط) */}
          {isAdmin && (
            <Pressable
              onPress={() => setShowHidden(v => !v)}
              style={[s.hiddenBtn, showHidden && { backgroundColor: colors.infoLight }]}
            >
              <Ionicons
                name={showHidden ? 'eye' : 'eye-off'}
                size={14}
                color={showHidden ? colors.info : colors.textMuted}
              />
            </Pressable>
          )}
          
          {/* زر التحديد (للمدير مع صلاحية إدارة الأدوات) */}
          {isAdmin && canManageTools && (
            <Pressable
              onPress={() => {
                setSelectMode(v => !v);
                setSelected(new Set());
              }}
              style={[s.selectBtn, selectMode && s.selectBtnActive]}
            >
              <Ionicons
                name={selectMode ? 'close' : 'checkbox-outline'}
                size={16}
                color={selectMode ? colors.white : colors.primary}
              />
            </Pressable>
          )}
        </View>
      </View>

      {/* شريط التحديد الجماعي */}
      {selectMode && (
        <View style={s.selectBar}>
          <Pressable onPress={selectAll} style={s.selectAllBtn}>
            <Ionicons
              name={selected.size === (tools?.length ?? 0) && (tools?.length ?? 0) > 0 ? 'checkbox' : 'square-outline'}
              size={18}
              color={colors.primary}
            />
            <Text style={s.selectAllText}>تحديد الكل</Text>
          </Pressable>
          {selected.size > 0 && (
            <View style={s.bulkActions}>
              <Pressable onPress={onBulkHide} style={s.bulkBtn}>
                <Ionicons name="eye-off-outline" size={16} color={colors.warning} />
              </Pressable>
              <Pressable onPress={onBulkUnhide} style={s.bulkBtn}>
                <Ionicons name="eye-outline" size={16} color={colors.info} />
              </Pressable>
              <Pressable onPress={onBulkDelete} style={s.bulkBtnDanger}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* القائمة */}
      {!tools ? (
        <Loader />
      ) : sortedTools.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          title="لا توجد أدوات"
          subtitle="أضف أداة جديدة أو استورد قائمة من ملف Excel"
        />
      ) : (
        <FlatList
          data={sortedTools}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 90 }}
          renderItem={({ item }) => (
            <ToolRow
              tool={item}
              selectMode={selectMode}
              isSelected={selected.has(String(item.id))}
              onToggleSelect={() => toggleSelect(String(item.id))}
              isAdmin={isAdmin}
              canManageTools={canManageTools}
            />
          )}
        />
      )}

      {/* زر عائم - فقط لمن يملك صلاحية */}
      {canManageTools && !selectMode && (
        <Pressable style={s.fab} onPress={() => router.push('/tool/new')}>
          <Ionicons name="add" size={28} color={colors.white} />
        </Pressable>
      )}
    </View>
  );
}

function ToolRow({
  tool,
  selectMode,
  isSelected,
  onToggleSelect,
  isAdmin,
  canManageTools,
}: {
  tool: Tool;
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  isAdmin: boolean;
  canManageTools: boolean;
}) {
  const out = tool.total_quantity - tool.available_qty;
  const isLow = tool.min_quantity > 0 && tool.available_qty <= tool.min_quantity;

  return (
    <Pressable
      onPress={selectMode ? onToggleSelect : () => router.push(`/tool/${tool.id}`)}
      style={({ pressed }) => [s.row, { opacity: pressed ? 0.75 : 1 }]}
    >
      {/* شريط ملون */}
      <View style={[s.rowStripe, { backgroundColor: tool.category_color ?? colors.primary }]} />
      
      <View style={{ flex: 1 }}>
        <View style={s.rowTop}>
          <View style={s.nameRow}>
            {/* شارة مخفية */}
            {tool.is_hidden ? (
              <Ionicons name="lock-closed" size={14} color={colors.warning} />
            ) : null}
            <Text style={s.rowTitle} numberOfLines={1}>
              {tool.name}
            </Text>
          </View>
          <View style={s.badgesRow}>
            {isLow && <Badge text="منخفضة" tone="danger" />}
            {tool.is_hidden && isAdmin && <Badge text="مخفية" tone="warning" />}
          </View>
        </View>

        <View style={s.metaRow}>
          {tool.category_name ? <Meta icon="pricetag-outline" text={tool.category_name} /> : null}
          {tool.location ? <Meta icon="location-outline" text={tool.location} /> : null}
          {tool.serial_number ? <Meta icon="barcode-outline" text={tool.serial_number} /> : null}
        </View>

        <View style={s.qtyRow}>
          <QtyPill label="المتاح" value={tool.available_qty} color={colors.success} />
          <QtyPill label="مسحوب" value={out} color={colors.accent} />
          <QtyPill label="الإجمالي" value={tool.total_quantity} color={colors.info} />
        </View>
      </View>
      
      {/* Checkbox في وضع التحديد */}
      {selectMode ? (
        <Ionicons
          name={isSelected ? 'checkbox' : 'square-outline'}
          size={24}
          color={colors.primary}
        />
      ) : (
        <Ionicons name="chevron-back" size={18} color={colors.textLight} />
      )}
    </Pressable>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={s.meta}>
      <Ionicons name={icon} size={12} color={colors.textMuted} />
      <Text style={s.metaText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function QtyPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={s.pill}>
      <Text style={[s.pillValue, { color }]}>{value}</Text>
      <Text style={s.pillLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  // تنبيه المكرر
  duplicateAlert: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.warningLight,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  duplicateAlertText: { flex: 1, fontSize: font.tiny, color: colors.warning, fontWeight: '600' },
  // شريط البحث
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
  searchInput: { flex: 1, paddingVertical: 11, fontSize: font.small, color: colors.text, textAlign: 'right' },
  // Chips
  chipsWrap: { maxHeight: 46, marginTop: spacing.sm },
  chipsRow: { paddingHorizontal: spacing.lg, gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: { fontSize: font.small, fontWeight: '800', color: colors.text },
  // ترتيب
  sortBar: {
    flexDirection: 'row-reverse', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  sortBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  sortBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sortText: { fontSize: font.tiny, fontWeight: '600', color: colors.textMuted },
  // ملخص
  summary: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  summaryText: { fontSize: font.tiny, color: colors.textMuted, fontWeight: '600' },
  summaryActions: { flexDirection: 'row-reverse', gap: spacing.sm, alignItems: 'center' },
  lowBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
  },
  lowText: { fontSize: font.tiny, color: colors.textMuted },
  hiddenBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  selectBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.primary,
  },
  selectBtnActive: { backgroundColor: colors.primary },
  // شريط التحديد
  selectBar: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primaryLight,
    marginHorizontal: spacing.lg, padding: spacing.sm,
    borderRadius: radius.md, marginBottom: spacing.sm,
  },
  selectAllBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  selectAllText: { fontSize: font.tiny, color: colors.primary, fontWeight: '700' },
  bulkActions: { flexDirection: 'row-reverse', gap: spacing.sm },
  bulkBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
  },
  bulkBtnDanger: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.dangerLight, alignItems: 'center', justifyContent: 'center',
  },
  // الصف
  row: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.md, ...shadow.card,
  },
  rowStripe: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  rowTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, flex: 1 },
  badgesRow: { flexDirection: 'row-reverse', gap: 4 },
  rowTitle: { fontSize: font.body, fontWeight: '800', color: colors.text, textAlign: 'right' },
  metaRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.md, marginTop: 5 },
  meta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3 },
  metaText: { fontSize: font.tiny, color: colors.textMuted, maxWidth: 110 },
  qtyRow: { flexDirection: 'row-reverse', gap: spacing.lg, marginTop: 8 },
  pill: { flexDirection: 'row-reverse', alignItems: 'baseline', gap: 3 },
  pillValue: { fontSize: font.body, fontWeight: '800' },
  pillLabel: { fontSize: font.tiny, color: colors.textLight },
  fab: {
    position: 'absolute', bottom: 20, left: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
});
