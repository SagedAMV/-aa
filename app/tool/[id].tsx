import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { deleteTool, getTool, duplicateTool } from '../../src/db/toolsRepo';
import { listDisbursements } from '../../src/db/movementsRepo';
import { statusAr } from '../../src/services/excel';
import { useAuth } from '../../src/context/AuthContext';
import { Badge, Button, Card, InfoRow, Loader } from '../../src/components/UI';
import { colors, font, radius, spacing } from '../../src/theme';
import type { Tool, Disbursement, ToolCondition } from '../../src/types';

const CONDITION_MAP: Record<ToolCondition, { label: string; tone: 'info' | 'success' | 'danger' | 'warning' | 'muted' }> = {
  new: { label: 'جديد', tone: 'success' },
  used: { label: 'مستعمل', tone: 'info' },
  needs_maintenance: { label: 'يحتاج صيانة', tone: 'warning' },
  damaged: { label: 'تالف', tone: 'danger' },
};

export default function ToolDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAdmin, canAddTools, user } = useAuth();
  const [tool, setTool] = useState<Tool | null>(null);
  const [history, setHistory] = useState<Disbursement[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    const t = await getTool(String(id));
    setTool(t);
    if (t) {
      try {
        const h = await listDisbursements({ toolId: String(t.id) });
        setHistory(h);
      } catch {
        setHistory([]);
      }
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onDelete = () => {
    if (!isAdmin) {
      Alert.alert('غير مصرّح', 'الحذف متاح لمدير المخزن فقط');
      return;
    }
    Alert.alert('تأكيد الحذف', `هل تريد حذف "${tool?.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTool(String(id), user?.username ?? 'system');
            router.back();
          } catch (e: any) {
            Alert.alert('خطأ', e.message ?? 'فشل الحذف');
          }
        },
      },
    ]);
  };

  const onDuplicate = () => {
    Alert.alert('نسخ الأداة', `هل تريد إنشاء نسخة من "${tool?.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'نسخ',
        onPress: async () => {
          try {
            const newId = await duplicateTool(String(tool?.id), user?.username ?? 'system');
            Alert.alert('تم', 'تم إنشاء نسخة من الأداة', [
              { text: 'عرض النسخة', onPress: () => router.replace(`/tool/${newId}`) },
              { text: 'لاحقاً' },
            ]);
          } catch (e: any) {
            Alert.alert('خطأ', e.message ?? 'فشل النسخ');
          }
        },
      },
    ]);
  };

  if (!tool) return <Loader text="جارٍ تحميل بيانات الأداة..." />;

  const out = tool.total_quantity - tool.available_qty;
  const isLow = tool.min_quantity > 0 && tool.available_qty <= tool.min_quantity;
  const conditionInfo = CONDITION_MAP[tool.condition ?? 'used'];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
    >
      {/* رأس */}
      <Card>
        <View style={s.head}>
          {tool.image_uri ? (
            <Image source={{ uri: tool.image_uri }} style={s.img} />
          ) : (
            <View style={[s.img, s.imgPlaceholder]}>
              <Ionicons name="cube-outline" size={30} color={colors.textLight} />
            </View>
          )}
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={s.title}>{tool.name}</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 6, flexWrap: 'wrap' }}>
              {tool.category_name && (
                <Badge text={tool.category_name} tone="info" />
              )}
              <Badge text={conditionInfo.label} tone={conditionInfo.tone} />
              {isLow && <Badge text="كمية منخفضة" tone="danger" />}
              {tool.available_qty === 0 && <Badge text="غير متاح" tone="warning" />}
            </View>
          </View>
        </View>

        <View style={s.qtyGrid}>
          <QtyBox label="الإجمالي" value={tool.total_quantity} color={colors.info} />
          <QtyBox label="المتاح" value={tool.available_qty} color={colors.success} />
          <QtyBox label="مسحوب" value={out} color={colors.accent} />
        </View>
      </Card>

      {/* أزرار العمليات */}
      <View style={{ flexDirection: 'row-reverse', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Button
            title="صرف"
            icon="arrow-down-circle-outline"
            onPress={() => router.push(`/withdraw/new?toolId=${String(tool.id)}` as any)}
            disabled={tool.available_qty === 0}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="إضافة كمية"
            icon="add-circle-outline"
            variant="success"
            onPress={() => router.push(`/addition/new?toolId=${String(tool.id)}` as any)}
          />
        </View>
      </View>

      {/* التفاصيل */}
      <Text style={s.section}>التفاصيل</Text>
      <Card>
        <InfoRow
          label="الرقم التسلسلي"
          value={tool.serial_number || '—'}
          icon="barcode-outline"
        />
        <InfoRow label="الباركود" value={tool.barcode || '—'} icon="qr-code-outline" />
        <InfoRow
          label="الموقع"
          value={tool.location || '—'}
          icon="location-outline"
        />
        <InfoRow
          label="حد التنبيه"
          value={String(tool.min_quantity)}
          icon="trending-down-outline"
        />
        <InfoRow
          label="حالة الأداة"
          value={conditionInfo.label}
          icon="information-circle-outline"
        />
        <InfoRow
          label="آخر تحديث"
          value={tool.updated_at?.slice(0, 16) ?? '-'}
          icon="time-outline"
        />
        {tool.description ? (
          <View style={{ paddingTop: 10 }}>
            <Text style={s.descLabel}>الوصف</Text>
            <Text style={s.descText}>{tool.description}</Text>
          </View>
        ) : null}
        {tool.notes ? (
          <View style={{ paddingTop: 10 }}>
            <Text style={s.descLabel}>ملاحظات</Text>
            <Text style={s.descText}>{tool.notes}</Text>
          </View>
        ) : null}
      </Card>

      {/* سجل الصرف */}
      <Text style={s.section}>سجل الصرف ({history.length})</Text>
      {history.length === 0 ? (
        <Card>
          <Text style={s.emptyText}>لا توجد عمليات صرف مسجلة لهذه الأداة</Text>
        </Card>
      ) : (
        history.slice(0, 20).map((w) => (
          <Card key={String(w.id)} style={{ padding: spacing.md, marginBottom: spacing.sm }}>
            <View style={s.histTop}>
              <Text style={s.histRecipient}>{w.recipient}</Text>
              <Badge
                text={statusAr(w.status)}
                tone={
                  w.status === 'approved'
                    ? 'success'
                    : w.status === 'pending'
                    ? 'warning'
                    : w.status === 'rejected'
                    ? 'muted'
                    : 'info'
                }
              />
            </View>
            <Text style={s.histMeta}>
              الكمية: {w.quantity} • بواسطة: {w.withdrawn_by} •{' '}
              {w.withdrawn_at?.slice(0, 16)}
            </Text>
            {w.reason ? <Text style={s.histMeta}>السبب: {w.reason}</Text> : null}
          </Card>
        ))
      )}

      {/* إدارة */}
      {canAddTools && (
        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          <Button
            title="نسخ الأداة"
            icon="copy-outline"
            variant="outline"
            onPress={onDuplicate}
          />
          <Button
            title="تعديل بيانات الأداة"
            icon="create-outline"
            variant="outline"
            onPress={() => router.push(`/tool/new?editId=${String(tool.id)}` as any)}
          />
          {isAdmin && (
            <Button
              title="حذف الأداة"
              icon="trash-outline"
              variant="danger"
              onPress={onDelete}
            />
          )}
        </View>
      )}
    </ScrollView>
  );
}

function QtyBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={s.qtyBox}>
      <Text style={[s.qtyValue, { color }]}>{value}</Text>
      <Text style={s.qtyLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row-reverse', gap: spacing.md, alignItems: 'center' },
  img: { width: 78, height: 78, borderRadius: radius.md, backgroundColor: colors.border },
  imgPlaceholder: {
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: font.h2,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
  },

  qtyGrid: {
    flexDirection: 'row-reverse',
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  qtyBox: { flex: 1, alignItems: 'center' },
  qtyValue: { fontSize: 22, fontWeight: '800' },
  qtyLabel: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },

  section: {
    fontSize: font.h3,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    textAlign: 'right',
  },
  descLabel: {
    fontSize: font.tiny,
    color: colors.textMuted,
    textAlign: 'right',
    marginBottom: 3,
  },
  descText: { fontSize: font.small, color: colors.text, textAlign: 'right', lineHeight: 21 },

  emptyText: {
    fontSize: font.small,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },

  histTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  histRecipient: { fontSize: font.small, fontWeight: '700', color: colors.text },
  histMeta: { fontSize: font.tiny, color: colors.textMuted, marginTop: 4, textAlign: 'right' },
});
