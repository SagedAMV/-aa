import React, { useRef, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  commitImport,
  exportTemplate,
  pickAndParseExcel,
  type ImportPreview,
} from '../src/services/excel';
import { useAuth } from '../src/context/AuthContext';
import { Badge, Button, Card } from '../src/components/UI';
import { colors, font, radius, spacing } from '../src/theme';

/**
 * استيراد الأدوات من ملف Excel محلي، مع معاينة وفحص الأخطاء
 * قبل الحفظ في قاعدة البيانات (حسب الخطوات الواردة في المستند).
 */
export default function ImportExcelScreen() {
  const { user, canAddTools } = useAuth();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  // الحماية بالـ ref فورية؛ فلا يمكن بدء منتقي ملفات ثانٍ قبل أن تنتهي العملية الأولى.
  const pickingRef = useRef(false);

  const onPick = async () => {
    if (pickingRef.current || busy) return;

    pickingRef.current = true;
    setBusy(true);
    try {
      const res = await pickAndParseExcel();
      if (res) setPreview(res);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'تعذر اختيار أو قراءة الملف';
      Alert.alert('تعذّر قراءة الملف', message);
    } finally {
      pickingRef.current = false;
      setBusy(false);
    }
  };

  const onCommit = async () => {
    if (busy || !preview || preview.valid.length === 0) return;
    if (!canAddTools) {
      Alert.alert('غير مصرّح', 'ليس لديك صلاحية إضافة الأدوات');
      return;
    }

    Alert.alert(
      'تأكيد الاستيراد',
      `سيتم إضافة ${preview.valid.length} أداة إلى بيانات المخزن.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'بدء الاستيراد',
          onPress: async () => {
            setBusy(true);
            try {
              const res = await commitImport(preview.valid, user?.username ?? 'system');
              Alert.alert(
                'اكتمل الاستيراد',
                `تمت إضافة ${res.inserted} أداة${res.failed ? ` — فشل ${res.failed}` : ''}`,
                [{ text: 'حسناً', onPress: () => router.replace('/(tabs)/tools') }]
              );
            } catch (e) {
              Alert.alert('خطأ', (e as Error).message);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
    >
      {/* التعليمات */}
      <Card>
        <Text style={s.title}>الأعمدة المطلوبة في الملف</Text>
        <View style={s.colsTable}>
          <ColRow col="A" field="الاسم" req />
          <ColRow col="B" field="الرقم التسلسلي" />
          <ColRow col="C" field="التصنيف" />
          <ColRow col="D" field="الموقع" />
          <ColRow col="E" field="الكمية" hint="افتراضي 1" />
          <ColRow col="F" field="ملاحظات" last />
        </View>
        <Button
          title="تنزيل قالب جاهز"
          icon="download-outline"
          variant="outline"
          onPress={() => exportTemplate().catch((e) => Alert.alert('خطأ', e.message))}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      {/* اختيار الملف */}
      <Button
        title={preview ? 'اختيار ملف آخر' : 'اختيار ملف Excel'}
        icon="folder-open-outline"
        onPress={onPick}
        loading={busy && !preview}
        disabled={busy}
        style={{ marginBottom: spacing.lg }}
      />

      {/* المعاينة */}
      {preview && (
        <>
          <Card>
            <View style={s.fileRow}>
              <Ionicons name="document-text" size={22} color={colors.primary} />
              <Text style={s.fileName} numberOfLines={1}>
                {preview.fileName}
              </Text>
            </View>
            <View style={s.statsRow}>
              <View style={s.statBox}>
                <Text style={[s.statNum, { color: colors.success }]}>
                  {preview.valid.length}
                </Text>
                <Text style={s.statLabel}>صف صالح</Text>
              </View>
              <View style={s.statBox}>
                <Text style={[s.statNum, { color: colors.danger }]}>
                  {preview.invalid.length}
                </Text>
                <Text style={s.statLabel}>صف به خطأ</Text>
              </View>
            </View>
          </Card>

          {/* أخطاء */}
          {preview.invalid.length > 0 && (
            <Card style={{ backgroundColor: colors.dangerLight }}>
              <Text style={[s.title, { color: colors.danger }]}>
                صفوف سيتم تجاهلها
              </Text>
              {preview.invalid.slice(0, 8).map((r) => (
                <Text key={r.__row} style={s.errText}>
                  • الصف {r.__row}: {r.__error}
                </Text>
              ))}
              {preview.invalid.length > 8 && (
                <Text style={s.errText}>
                  ... و{preview.invalid.length - 8} صف آخر
                </Text>
              )}
            </Card>
          )}

          {/* معاينة البيانات */}
          {preview.valid.length > 0 && (
            <>
              <Text style={s.section}>معاينة أول 10 صفوف</Text>
              <FlatList
                scrollEnabled={false}
                data={preview.valid.slice(0, 10)}
                keyExtractor={(r) => String(r.__row)}
                renderItem={({ item }) => (
                  <View style={s.previewRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.pName}>{item.name}</Text>
                      <Text style={s.pMeta}>
                        {[item.category, item.location, item.serial]
                          .filter(Boolean)
                          .join(' • ') || '—'}
                      </Text>
                    </View>
                    <Badge text={`${item.quantity}`} tone="info" />
                  </View>
                )}
              />

              <Button
                title={`بدء استيراد ${preview.valid.length} أداة`}
                icon="cloud-upload-outline"
                onPress={onCommit}
                loading={busy}
                disabled={busy}
                style={{ marginTop: spacing.lg }}
              />
            </>
          )}
        </>
      )}

      <Text style={s.note}>
        📴 تتم قراءة الملف ومعاينته على الجهاز أولاً، ثم تُحفظ البيانات فقط بعد تأكيدك
      </Text>
    </ScrollView>
  );
}

function ColRow({
  col,
  field,
  req,
  hint,
  last,
}: {
  col: string;
  field: string;
  req?: boolean;
  hint?: string;
  last?: boolean;
}) {
  return (
    <View style={[s.colRow, !last && s.colBorder]}>
      <View style={s.colBadge}>
        <Text style={s.colBadgeText}>{col}</Text>
      </View>
      <Text style={s.colField}>{field}</Text>
      {req ? (
        <Text style={s.reqMark}>مطلوب</Text>
      ) : (
        <Text style={s.optMark}>{hint ?? 'اختياري'}</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  title: {
    fontSize: font.h3,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'right',
  },
  colsTable: { borderRadius: radius.md, overflow: 'hidden' },
  colRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, paddingVertical: 9 },
  colBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  colBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colBadgeText: { fontSize: font.tiny, fontWeight: '800', color: colors.primary },
  colField: { flex: 1, fontSize: font.small, color: colors.text, textAlign: 'right' },
  reqMark: { fontSize: font.tiny, color: colors.danger, fontWeight: '700' },
  optMark: { fontSize: font.tiny, color: colors.textLight },

  fileRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  fileName: { flex: 1, fontSize: font.small, fontWeight: '700', color: colors.text, textAlign: 'right' },
  statsRow: { flexDirection: 'row-reverse', marginTop: spacing.md },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: font.h1, fontWeight: '800' },
  statLabel: { fontSize: font.tiny, color: colors.textMuted },

  errText: { fontSize: font.tiny, color: colors.danger, textAlign: 'right', marginBottom: 3 },

  section: {
    fontSize: font.h3,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    textAlign: 'right',
  },
  previewRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: 8,
    gap: spacing.md,
  },
  pName: { fontSize: font.small, fontWeight: '700', color: colors.text, textAlign: 'right' },
  pMeta: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2, textAlign: 'right' },

  note: {
    fontSize: font.tiny,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
