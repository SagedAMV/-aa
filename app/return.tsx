import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { returnDisbursement, listDisbursements } from '../src/db/movementsRepo';
import { useAuth } from '../src/context/AuthContext';
import { Button, Card, Field, InfoRow, Loader } from '../src/components/UI';
import { colors, font, radius, spacing } from '../src/theme';
import type { Disbursement, ReturnedCondition } from '../src/types';

const CONDITIONS: { key: ReturnedCondition; label: string; icon: string; color: string }[] = [
  { key: 'good', label: 'جيدة', icon: 'checkmark-circle-outline', color: colors.success },
  { key: 'needs_maintenance', label: 'تحتاج صيانة', icon: 'construct-outline', color: colors.warning },
  { key: 'damaged', label: 'تالفة', icon: 'alert-circle-outline', color: colors.danger },
];

export default function ReturnScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [disbursement, setDisbursement] = useState<Disbursement | null>(null);
  const [returnedQty, setReturnedQty] = useState('');
  const [condition, setCondition] = useState<ReturnedCondition>('good');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const list = await listDisbursements();
        const found = list.find((d: Disbursement) => String(d.id) === String(id));
        if (found) {
          setDisbursement(found);
          // Pre-fill with remaining quantity
          const remaining = found.quantity - (found.returned_qty ?? 0);
          setReturnedQty(String(remaining));
        }
      } catch (e) {
        console.error('Failed to load disbursement', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const remainingQty = disbursement
    ? disbursement.quantity - (disbursement.returned_qty ?? 0)
    : 0;

  const onSubmit = async () => {
    if (!disbursement || !id) return;
    
    const qty = parseInt(returnedQty, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      Alert.alert('تنبيه', 'الكمية المُرجعة يجب أن تكون أكبر من صفر');
      return;
    }
    if (qty > remainingQty) {
      Alert.alert('تنبيه', `الكمية المُرجعة لا يمكن أن تتجاوز ${remainingQty}`);
      return;
    }

    setSaving(true);
    try {
      await returnDisbursement({
        disbursementId: String(id),
        returnedQty: qty,
        returnedBy: user?.username ?? 'system',
        condition,
        notes: notes || undefined,
      });

      const isFullyReturned = qty >= remainingQty;
      Alert.alert(
        'تم',
        isFullyReturned
          ? 'تم تسجيل الإرجاع بالكامل وإعادة الكمية للمخزن'
          : `تم تسجيل إرجاع ${qty} وحدة. المتبقي للإرجاع: ${remainingQty - qty}`,
        [{ text: 'حسناً', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('خطأ', e.message ?? 'فشل تسجيل الإرجاع');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader text="جارٍ تحميل بيانات العملية..." />;

  if (!disbursement) {
    return (
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textLight} />
        <Text style={s.errorText}>لم يتم العثور على العملية</Text>
      </View>
    );
  }

  if (disbursement.status !== 'approved') {
    return (
      <View style={s.center}>
        <Ionicons name="close-circle-outline" size={48} color={colors.danger} />
        <Text style={s.errorText}>يمكن إرجاع عملية مصروفة فقط</Text>
      </View>
    );
  }

  if (disbursement.withdraw_type !== 'temporary') {
    return (
      <View style={s.center}>
        <Ionicons name="information-circle-outline" size={48} color={colors.info} />
        <Text style={s.errorText}>الإرجاع متاح فقط للصرف المؤقت</Text>
      </View>
    );
  }

  const conditionInfo = CONDITIONS.find(c => c.key === condition);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* معلومات العملية */}
      <Card>
        <View style={s.header}>
          <Ionicons name="swap-horizontal" size={24} color={colors.warning} />
          <Text style={s.headerTitle}>تسجيل إرجاع</Text>
        </View>
        
        <InfoRow label="الأداة" value={disbursement.tool_name ?? '-'} icon="cube-outline" />
        <InfoRow label="الكمية المصروفة" value={String(disbursement.quantity)} icon="cube-outline" />
        <InfoRow label="المستلم" value={disbursement.recipient} icon="person-outline" />
        {disbursement.expected_return && (
          <InfoRow
            label="موعد الإرجاع"
            value={new Date(disbursement.expected_return).toLocaleDateString('ar-EG')}
            icon="calendar-outline"
          />
        )}
        {(disbursement.returned_qty ?? 0) > 0 && (
          <InfoRow
            label="أُرجع سابقاً"
            value={String(disbursement.returned_qty)}
            icon="return-down-back-outline"
          />
        )}
      </Card>

      {/* المتبقي للإرجاع */}
      <View style={s.remainingBox}>
        <Text style={s.remainingLabel}>المتبقي للإرجاع</Text>
        <Text style={s.remainingValue}>{remainingQty}</Text>
        <Text style={s.remainingUnit}>وحدة</Text>
      </View>

      {/* الكمية المُرجعة */}
      <Field
        label="الكمية المُرجعة"
        required
        value={returnedQty}
        onChangeText={setReturnedQty}
        keyboardType="number-pad"
        hint={`الحد الأقصى: ${remainingQty}`}
      />

      {/* حالة الأداة */}
      <Text style={s.label}>حالة الأداة المُرجعة</Text>
      <View style={s.conditionsRow}>
        {CONDITIONS.map((c) => (
          <View key={c.key} style={{ flex: 1 }}>
            <Button
              title={c.label}
              variant={condition === c.key ? 'primary' : 'outline'}
              icon={c.icon as any}
              onPress={() => setCondition(c.key)}
              style={{ paddingVertical: 10 }}
            />
          </View>
        ))}
      </View>

      {/* ملاحظات */}
      <Field
        label="ملاحظات"
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="اختياري — مثلاً: سبب التلف، ملاحظات فنية..."
      />

      {/* معاينة */}
      <Card style={s.preview}>
        <Text style={s.previewTitle}>معاينة الإرجاع</Text>
        <Text style={s.previewText}>
          سيتم إعادة <Text style={s.previewBold}>{returnedQty || 0}</Text> وحدة من{' '}
          <Text style={s.previewBold}>{disbursement.tool_name}</Text> إلى المخزن
        </Text>
        {parseInt(returnedQty, 10) >= remainingQty && remainingQty > 0 && (
          <View style={s.fullReturnBadge}>
            <Ionicons name="checkmark-done" size={16} color={colors.success} />
            <Text style={s.fullReturnText}>سيُعتبر إرجاعاً كاملاً</Text>
          </View>
        )}
      </Card>

      {/* زر التأكيد */}
      <Button
        title="تأكيد الإرجاع"
        icon="return-down-back-outline"
        onPress={onSubmit}
        loading={saving}
        variant="success"
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  errorText: {
    fontSize: font.h3,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: font.h2,
    fontWeight: '800',
    color: colors.text,
  },
  remainingBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  remainingLabel: {
    fontSize: font.small,
    color: colors.textMuted,
    marginBottom: 4,
  },
  remainingValue: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
  },
  remainingUnit: {
    fontSize: font.small,
    color: colors.textMuted,
  },
  label: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'right',
  },
  conditionsRow: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  preview: {
    backgroundColor: colors.successLight,
    marginBottom: spacing.lg,
  },
  previewTitle: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.success,
    marginBottom: 4,
  },
  previewText: {
    fontSize: font.small,
    color: colors.text,
    lineHeight: 20,
  },
  previewBold: {
    fontWeight: '800',
    color: colors.success,
  },
  fullReturnBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  fullReturnText: {
    fontSize: font.tiny,
    color: colors.success,
    fontWeight: '700',
  },
});
