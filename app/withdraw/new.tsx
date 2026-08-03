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
import type { Tool, WithdrawType, PermissionLevel } from '../../src/types';

const REASONS = ['صيانة', 'مهمة ميدانية', 'استبدال', 'تركيب', 'أخرى'];

export default function NewDisbursementScreen() {
  const { toolId } = useLocalSearchParams<{ toolId?: string }>();
  const { user, withdrawLevel, canWithdrawDirect } = useAuth();

  const [tool, setTool] = useState<Tool | null>(null);
  const [picker, setPicker] = useState(false);
  const [tools, setTools] = useState<Tool[]>([]);
  const [search, setSearch] = useState('');

  const [qty, setQty] = useState('1');
  const [recipient, setRecipient] = useState('');
  const [reason, setReason] = useState<string>('صيانة');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  
  // الحقول الجديدة
  const [withdrawType, setWithdrawType] = useState<WithdrawType>('permanent');
  const [expectedReturnStr, setExpectedReturnStr] = useState(''); // YYYY-MM-DD format

  // التحقق من الصلاحيات
  const canWithdraw = withdrawLevel !== 'none';
  const needsApproval = withdrawLevel === 'with_approval';

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
    if (!canWithdraw) {
      Alert.alert('تنبيه', 'ليس لديك صلاحية الصرف');
      return;
    }
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
    
    // إذا كان صرف مؤقت، يجب تحديد موعد الإرجاع
    if (withdrawType === 'temporary' && !expectedReturnStr) {
      Alert.alert('تنبيه', 'يجب تحديد موعد الإرجاع المتوقع للصرف المؤقت');
      return;
    }
    
    // التحقق من صيغة التاريخ
    let expectedReturn: Date | null = null;
    if (withdrawType === 'temporary' && expectedReturnStr) {
      expectedReturn = new Date(expectedReturnStr);
      if (isNaN(expectedReturn.getTime())) {
        Alert.alert('تنبيه', 'صيغة التاريخ غير صحيحة. استخدم YYYY-MM-DD');
        return;
      }
      if (expectedReturn <= new Date()) {
        Alert.alert('تنبيه', 'موعد الإرجاع يجب أن يكون في المستقبل');
        return;
      }
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
        withdrawType,
        expectedReturn: withdrawType === 'temporary' && expectedReturn
          ? expectedReturn.toISOString()
          : null,
      });

      const typeText = withdrawType === 'temporary' ? 'مؤقت' : 'دائم';
      
      let message = '';
      if (res.status === 'approved') {
        message = `تم تسجيل الصرف ${typeText} وخصم الكمية من المخزن`;
      } else {
        message = `تم إرسال طلب الصرف ${typeText} وينتظر موافقة مدير المخزن`;
      }

      Alert.alert('تم', message, [{ text: 'حسناً', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('خطأ', e.message ?? 'فشل تسجيل الصرف');
    } finally {
      setSaving(false);
    }
  };

  // إذا لم يكن لديه صلاحية، اعرض رسالة
  if (!canWithdraw) {
    return (
      <View style={styles.noPermission}>
        <Ionicons name="lock-closed" size={64} color={colors.textLight} />
        <Text style={styles.noPermissionText}>ليس لديك صلاحية الصرف</Text>
        <Text style={styles.noPermissionSub}>تواصل مع المدير للحصول على الصلاحية</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* نوع الصرف */}
      <Text style={s.label}>نوع الصرف</Text>
      <View style={s.typeRow}>
        <Pressable
          style={[s.typeBtn, withdrawType === 'permanent' && s.typeBtnActive]}
          onPress={() => setWithdrawType('permanent')}
        >
          <Ionicons 
            name="arrow-forward-circle" 
            size={20} 
            color={withdrawType === 'permanent' ? colors.white : colors.textMuted} 
          />
          <Text style={[s.typeText, withdrawType === 'permanent' && { color: colors.white }]}>
            صرف دائم
          </Text>
        </Pressable>
        <Pressable
          style={[s.typeBtn, withdrawType === 'temporary' && s.typeBtnActiveTemp]}
          onPress={() => setWithdrawType('temporary')}
        >
          <Ionicons 
            name="swap-horizontal" 
            size={20} 
            color={withdrawType === 'temporary' ? colors.white : colors.textMuted} 
          />
          <Text style={[s.typeText, withdrawType === 'temporary' && { color: colors.white }]}>
            صرف مؤقت
          </Text>
        </Pressable>
      </View>

      {/* الأداة */}
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

      {/* الكمية */}
      <Field
        label="الكمية المطلوبة"
        required
        value={qty}
        onChangeText={setQty}
        keyboardType="number-pad"
        hint={tool ? `الحد الأقصى: ${tool.available_qty}` : undefined}
      />

      {/* المستلم */}
      <Field
        label="اسم المستلم (الجهة الطالبة)"
        required
        value={recipient}
        onChangeText={setRecipient}
        placeholder="مثال: م. أحمد — قسم الصيانة"
      />

      {/* السبب */}
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

      {/* موعد الإرجاع - يظهر فقط إذا كان صرف مؤقت */}
      {withdrawType === 'temporary' && (
        <View style={s.dateSection}>
          <Text style={s.label}>
            موعد الإرجاع المتوقع <Text style={{ color: colors.danger }}>*</Text>
          </Text>
          <View style={s.dateInput}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <TextInput
              style={s.dateTextInput}
              placeholder="YYYY-MM-DD (مثال: 2026-09-01)"
              placeholderTextColor={colors.textLight}
              value={expectedReturnStr}
              onChangeText={setExpectedReturnStr}
              keyboardType="default"
            />
          </View>
          <Text style={s.dateHint}>أدخل تاريخ الإرجاع المتوقع بصيغة سنة-شهر-يوم</Text>
        </View>
      )}

      {/* ملاحظات */}
      <Field
        label="ملاحظات"
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="اختياري"
      />

      {/* تحذير إذا كان يحتاج موافقة */}
      {needsApproval && (
        <View style={s.warn}>
          <Ionicons name="information-circle" size={18} color={colors.warning} />
          <Text style={s.warnText}>
            ليس لديك صلاحية الصرف المباشر — سيُسجَّل الطلب بانتظار موافقة المدير.
          </Text>
        </View>
      )}

      {/* زر الإرسال */}
      <Button
        title={
          canWithdrawDirect 
            ? (withdrawType === 'temporary' ? 'تسجيل صرف مؤقت' : 'تسجيل الصرف')
            : 'إرسال طلب الصرف'
        }
        icon="checkmark-circle-outline"
        onPress={onSubmit}
        loading={saving}
      />

      {/* Sheet اختيار أداة */}
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
  // نوع الصرف
  typeRow: {
    flexDirection: 'row-reverse',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  typeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeBtnActiveTemp: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  typeText: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.textMuted,
  },
  // التاريخ
  dateSection: {
    marginBottom: spacing.lg,
  },
  dateInput: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  dateTextInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: font.body,
    color: colors.text,
    textAlign: 'right',
  },
  dateHint: {
    fontSize: font.tiny,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'right',
  },
  // الباقي
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

const styles = StyleSheet.create({
  noPermission: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  noPermissionText: {
    fontSize: font.h2,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  noPermissionSub: {
    fontSize: font.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
