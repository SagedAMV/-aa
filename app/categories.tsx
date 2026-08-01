import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  createCategory,
  deleteCategory,
  listCategories,
  countToolsByCategory,
} from '../src/db/toolsRepo';
import { Button, Card, Field, Sheet } from '../src/components/UI';
import { colors, font, radius, spacing } from '../src/theme';
import type { Category } from '../src/types';

const PALETTE = [
  '#0F766E', '#F59E0B', '#3B82F6', '#10B981',
  '#8B5CF6', '#EF4444', '#EC4899', '#6B7280',
];

export default function CategoriesScreen() {
  const [cats, setCats] = useState<(Category & { count?: number })[]>([]);
  const [sheet, setSheet] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);

  const load = useCallback(async () => {
    try {
      const list = await listCategories();
      const withCount = await Promise.all(
        list.map(async (c) => {
          try {
            const n = await countToolsByCategory(c.id);
            return { ...c, count: n };
          } catch {
            return { ...c, count: 0 };
          }
        })
      );
      setCats(withCount);
    } catch (e) {
      console.error('Failed to load categories', e);
      Alert.alert('خطأ', 'فشل تحميل التصنيفات');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onCreate = async () => {
    if (!name.trim()) {
      Alert.alert('تنبيه', 'اسم التصنيف مطلوب');
      return;
    }
    try {
      await createCategory(name.trim(), color);
      setName('');
      setColor(PALETTE[0]);
      setSheet(false);
      load();
    } catch (e: any) {
      Alert.alert('خطأ', e.message ?? 'فشل إنشاء التصنيف');
    }
  };

  const onDelete = (c: Category & { count?: number }) => {
    Alert.alert(
      'حذف التصنيف',
      c.count
        ? `هذا التصنيف مرتبط بـ ${c.count} أداة. سيتم إزالة التصنيف عنها فقط. متابعة؟`
        : `حذف "${c.name}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(c.id);
              load();
            } catch (e: any) {
              Alert.alert('خطأ', e.message ?? 'فشل حذف التصنيف');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={cats}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 90 }}
        renderItem={({ item }) => (
          <Card style={{ padding: spacing.md, marginBottom: spacing.sm }}>
            <View style={s.row}>
              <View style={[s.dot, { backgroundColor: item.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.name}</Text>
                <Text style={s.count}>{item.count ?? 0} أداة</Text>
              </View>
              <Pressable onPress={() => onDelete(item)} hitSlop={10} style={s.trash}>
                <Ionicons name="trash-outline" size={19} color={colors.danger} />
              </Pressable>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <Text style={s.empty}>لا توجد تصنيفات - أضف تصنيف جديد</Text>
        }
      />

      <Pressable style={s.fab} onPress={() => setSheet(true)}>
        <Ionicons name="add" size={28} color={colors.white} />
      </Pressable>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="تصنيف جديد">
        <Field label="اسم التصنيف" required value={name} onChangeText={setName} placeholder="مثال: كهربائية" />
        <Text style={s.label}>اللون</Text>
        <View style={s.palette}>
          {PALETTE.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[
                s.swatch,
                { backgroundColor: c },
                color === c && s.swatchActive,
              ]}
            >
              {color === c && (
                <Ionicons name="checkmark" size={16} color={colors.white} />
              )}
            </Pressable>
          ))}
        </View>
        <Button title="إضافة التصنيف" icon="add-outline" onPress={onCreate} />
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md },
  dot: { width: 14, height: 14, borderRadius: 7 },
  name: { fontSize: font.body, fontWeight: '700', color: colors.text, textAlign: 'right' },
  count: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2, textAlign: 'right' },
  empty: { textAlign: 'center', color: colors.textMuted, padding: spacing.xxl },
  trash: { padding: 6 },

  label: { fontSize: font.small, fontWeight: '700', color: colors.text, marginBottom: 8, textAlign: 'right' },
  palette: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginBottom: spacing.lg },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchActive: { borderWidth: 3, borderColor: colors.text },

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
  },
});
