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
import { createDisbursement } from '../../src/db/movementsRepo';
import { useAuth } from '../../src/context/AuthContext';
import { Button, Field, Sheet } from '../../src/components/UI';
import { colors, font, radius, spacing } from '../../src/theme';
import type { Tool } from '../../src/types';

const REASONS = ['صيانة', 'مهمة ميدانية', 'استبدال', 'تركيب', 'أخرى'];

export default function NewDisbursementScreen() {
  const { toolId } = useLocalSearchParams<{ toolId?: string }>();
  const { user, canWithdrawDirect } = useAuth();

  const [tool, setTool] = useState<Tool | null>(null);
  const [picker, setPicker] = useState(false);
  const [tools, setTools] = useState<Tool[]>([]);
  const [search, setSearch] = useState('');

  const [qty, setQty] = useState('1');
  const [recipient, setRecipient] = useState('');
  const [reason, setReason] = useState<string>('صيانة');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (toolId) {
      getTool(String(toolId)).then(t => { if (t) setTool(t); });
    }
  }, [toolId]);

  const loadTools = useCallback(async () => {
    const list = await listTools({ search, onlyAvailable: true });
    setTools(list);
  }, [search]);

  useEffect(() => {
    if (picker) loadTools();
  }, [picker, loadTools]);

  const onSubmit = async () => {
    if (!tool) {
      Alert.alert('تنبيه', 'يرجى اختيار الأداة');
      return;
    }
    if (!recipient.trim()) {
      Alert.alert('تنبيه', 'اسم المستلم مطلوب');
      return;
    }
    const q = parseInt(qty, 10);
    if (!Number.isFinite(q) || q <= 0) {
      Alert.alert('تنبيه', 'الكمية غير صالحة');
      return;
    }
    if (q > tool.available_qty) {
      Alert.alert('تنبيه', `الكمية المتاحة ${tool.available_qty} فقط`);
      return;
    }

    setSaving(true);
    try {
      const res = await createDisbursement({
        toolId: String(tool.id),
        quantity: q,
        withdrawnBy: user?.username ?? 'system',
        recipient: recipient.trim(),
        reason,
        notes: notes || null,
        autoApprove: canWithdrawDirect,
      });

      Alert.alert(
        'تم',
        res.status === 'approved'
          ? 'تم تسجيل الصرف وخصم الكمية من المخزن'
          : 'تم إرسال طلب الصرف وينتظر موافقة مدير المخزن',
        [{ text: 'حسناً', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('خطأ', e.message ?? 'فشل تسجيل الصرف');
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
              المتاح: {tool.available_qty} • {tool.location ?? 'بدون موقع'}
            </Text>
          </View>
        ) : (
          <Text style={s.selPlaceholder}>اضغط لاختيار الأداة</Text>
        )}
        <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
      </Pressable>

      <Pressable
        style={s.scanRow}
        onPress={() => router.push('/scan?returnTo=withdraw' as any)}
      >
        <Ionicons name="qr-code-outline" size={18} color={colors.primary} />
        <Text style={s.scanText}>أو امسح الباركود لاختيار الأداة</Text>
      </Pressable>

      <Field
        label="الكمية المطلوبة"
        required
        value={qty}
        onChangeText={setQty}
        keyboardType="number-pad"
        hint={tool ? `الحد الأقصى: ${tool.available_qty}` : undefined}
      />

      <Field
        label="اسم المستلم (الجهة الطالبة)"
        required
        value={recipient}
        onChangeText={setRecipient}
        placeholder="مثال: م. أحمد — قسم الصيانة"
      />

      <Text style={s.label}>سبب الصرف</Text>
      <View style={s.chips}>
        {REASONS.map((r) => (
          <Pressable
            key={r}
            onPress={() => setReason(r)}
            style={[s.chip, reason === r && s.chipActive]}
          >
            <Text style={[s.chipText, reason === r && { color: colors.white }]}>
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
        placeholder="اختياري"
      />

      {!canWithdrawDirect && (
        <View style={s.warn}>
          <Ionicons name="information-circle" size={18} color={colors.warning} />
          <Text style={s.warnText}>
            ليس لديك صلاحية الصرف المباشر — سيُسجَّل الطلب بانتظار موافقة المدير.
          </Text>
        </View>
      )}

      <Button
        title={canWithdrawDirect ? 'تسجيل الصرف' : 'إرسال طلب الصرف'}
        icon="checkmark-circle-outline"
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
                <Text style={s.pickMeta}>
                  المتاح: {item.available_qty} • {item.location ?? '—'}
                </Text>
              </View>
              <Ionicons name="chevron-back" size={16} color={colors.textLight} />
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={s.noResult}>لا توجد أدوات متاحة</Text>
          }
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

  scanRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  scanText: { fontSize: font.tiny, color: colors.primary, fontWeight: '600' },

  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.tiny, fontWeight: '700', color: colors.textMuted },

  warn: {
    flexDirection: 'row-reverse',
    gap: 8,
    backgroundColor: colors.warningLight,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  warnText: { flex: 1, fontSize: font.tiny, color: colors.warning, textAlign: 'right' },

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
