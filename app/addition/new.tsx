import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getTool, listTools } from '../../src/db/toolsRepo';
import { createAddition } from '../../src/db/movementsRepo';
import { useAuth } from '../../src/context/AuthContext';
import { Button, Field, Sheet } from '../../src/components/UI';
import { colors, font, radius, spacing } from '../../src/theme';
import type { Tool } from '../../src/types';

const SOURCES = ['شراء', 'تبرع', 'إرجاع', 'تحويل', 'أخرى'];

export default function NewAdditionScreen() {
  const { toolId } = useLocalSearchParams<{ toolId?: string }>();
  const { user, canAddTools } = useAuth();

  const [tool, setTool] = useState<Tool | null>(null);
  const [picker, setPicker] = useState(false);
  const [tools, setTools] = useState<Tool[]>([]);
  const [search, setSearch] = useState('');

  const [qty, setQty] = useState('1');
  const [source, setSource] = useState('شراء');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (toolId) {
      getTool(String(toolId)).then(t => { if (t) setTool(t); });
    }
  }, [toolId]);

  const loadTools = useCallback(async () => {
    setTools(await listTools({ search }));
  }, [search]);

  useEffect(() => {
    if (picker) loadTools();
  }, [picker, loadTools]);

  const onSubmit = async () => {
    if (!canAddTools) {
      Alert.alert('غير مصرّح', 'ليس لديك صلاحية تسجيل الإضافات');
      return;
    }
    if (!tool) {
      Alert.alert('تنبيه', 'يرجى اختيار الأداة');
      return;
    }
    const q = parseInt(qty, 10);
    if (!Number.isFinite(q) || q <= 0) {
      Alert.alert('تنبيه', 'الكمية غير صالحة');
      return;
    }

    setSaving(true);
    try {
      await createAddition({
        toolId: String(tool.id),
        quantity: q,
        addedBy: user?.username ?? 'system',
        source,
        notes: notes || null,
      });
      Alert.alert('تم', `تمت إضافة ${q} وحدة إلى "${tool.name}"`, [
        { text: 'حسناً', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('خطأ', e.message ?? 'فشل الإضافة');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.label}>
        الأداة <Text style={{ color: colors.danger }}>*</Text>
      </Text>
      <Pressable style={s.selector} onPress={() => setPicker(true)}>
        {tool ? (
          <View style={{ flex: 1 }}>
            <Text style={s.selTitle}>{tool.name}</Text>
            <Text style={s.selMeta}>
              الحالي: {tool.total_quantity} وحدة • المتاح: {tool.available_qty}
            </Text>
          </View>
        ) : (
          <Text style={s.selPlaceholder}>اضغط لاختيار الأداة</Text>
        )}
        <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
      </Pressable>

      <Pressable style={s.newTool} onPress={() => router.push('/tool/new' as any)}>
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text style={s.newToolText}>الأداة غير موجودة؟ أضف أداة جديدة</Text>
      </Pressable>

      <Field
        label="الكمية المضافة"
        required
        value={qty}
        onChangeText={setQty}
        keyboardType="number-pad"
      />

      <Text style={s.label}>المصدر</Text>
      <View style={s.chips}>
        {SOURCES.map((r) => (
          <Pressable
            key={r}
            onPress={() => setSource(r)}
            style={[s.chip, source === r && s.chipActive]}
          >
            <Text style={[s.chipText, source === r && { color: colors.white }]}>
              {r}
            </Text>
          </Pressable>
        ))}
      </View>

      <Field
        label="ملاحظات"
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="رقم الفاتورة، اسم المورد... (اختياري)"
      />

      {tool && (
        <View style={s.preview}>
          <Text style={s.previewText}>
            بعد الإضافة سيصبح الإجمالي:{' '}
            <Text style={s.previewBold}>
              {tool.total_quantity + (parseInt(qty, 10) || 0)}
            </Text>{' '}
            وحدة
          </Text>
        </View>
      )}

      <Button
        title="تسجيل الإضافة"
        icon="add-circle-outline"
        variant="success"
        onPress={onSubmit}
        loading={saving}
      />

      <Sheet visible={picker} onClose={() => setPicker(false)} title="اختيار أداة">
        <TextInput
          style={s.searchInput}
          placeholder="ابحث..."
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={setSearch}
        />
        <FlatList
          data={tools}
          keyExtractor={(t) => String(t.id)}
          style={{ maxHeight: 400 }}
          renderItem={({ item }) => (
            <Pressable
              style={s.pickRow}
              onPress={() => {
                setTool(item);
                setPicker(false);
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.pickName}>{item.name}</Text>
                <Text style={s.pickMeta}>الإجمالي: {item.total_quantity}</Text>
              </View>
              <Ionicons name="chevron-back" size={16} color={colors.textLight} />
            </Pressable>
          )}
          ListEmptyComponent={<Text style={s.noResult}>لا توجد أدوات</Text>}
        />
      </Sheet>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  label: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    textAlign: 'right',
  },
  selector: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  selTitle: { fontSize: font.body, fontWeight: '700', color: colors.text, textAlign: 'right' },
  selMeta: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2, textAlign: 'right' },
  selPlaceholder: { flex: 1, fontSize: font.small, color: colors.textLight, textAlign: 'right' },

  newTool: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  newToolText: { fontSize: font.tiny, color: colors.primary, fontWeight: '600' },

  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.success, borderColor: colors.success },
  chipText: { fontSize: font.tiny, fontWeight: '700', color: colors.textMuted },

  preview: {
    backgroundColor: colors.successLight,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  previewText: { fontSize: font.small, color: colors.success, textAlign: 'center' },
  previewBold: { fontWeight: '800' },

  searchInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    textAlign: 'right',
    color: colors.text,
  },
  pickRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: 8,
  },
  pickName: { fontSize: font.small, fontWeight: '700', color: colors.text, textAlign: 'right' },
  pickMeta: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2, textAlign: 'right' },
  noResult: { textAlign: 'center', color: colors.textMuted, padding: spacing.xl },
});
