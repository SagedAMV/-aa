import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Switch,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import {
  createBackup,
  formatBytes,
  getDatabaseSize,
  getNativeInfo,
  getStorageInfo,
  restoreBackup,
} from '../../src/services/backup';
import { exportTemplate } from '../../src/services/excel';
import {
  checkLowStockAndNotify,
  checkOverdueAndNotify,
} from '../../src/services/notifications';
import { useAuth } from '../../src/context/AuthContext';
import { Button, Card, Field, Sheet } from '../../src/components/UI';
import { colors, font, radius, spacing } from '../../src/theme';
import { getBoolSetting, getStringSetting, setSetting } from '../../src/db/settings';

export default function SettingsScreen() {
  const { user, isAdmin, signOut, changePassword } = useAuth();
  const [dbSize, setDbSize] = useState(0);
  const [storage, setStorage] = useState<{
    freeBytes: number;
    totalBytes: number;
    deviceModel: string;
    androidRelease: string;
  } | null>(null);
  const [nativeInfo, setNativeInfo] = useState<{
    moduleVersion: string;
    sdkInt: number;
  } | null>(null);

  const [backupBusy, setBackupBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const [pwSheet, setPwSheet] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  
  // Table settings states
  const [showCategory, setShowCategory] = useState(true);
  const [defaultSort, setDefaultSort] = useState<'name' | 'quantity'>('name');

  const load = useCallback(async () => {
    try {
      const size = getDatabaseSize();
      setDbSize(size);
      const st = getStorageInfo();
      setStorage(st as any);
      const ni = getNativeInfo();
      setNativeInfo(ni as any);

      const sc = await getBoolSetting('show_category_column', true);
      setShowCategory(sc);
      const ds = await getStringSetting('default_sort', 'name');
      setDefaultSort(ds === 'quantity' ? 'quantity' : 'name');
    } catch (e) {
      console.warn('load settings failed', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );
  
  const toggleShowCategory = async (value: boolean) => {
    setShowCategory(value);
    await setSetting('show_category_column', value ? '1' : '0');
  };

  const updateDefaultSort = async (value: 'name' | 'quantity') => {
    setDefaultSort(value);
    await setSetting('default_sort', value);
  };

  const onBackup = async () => {
    setBackupBusy(true);
    setProgress(0);
    try {
      const res = await createBackup((p) => setProgress(p));
      Alert.alert(
        'تم إنشاء النسخة الاحتياطية',
        `الحجم: ${formatBytes(res.sizeBytes)}\nالمسار: ${res.path.slice(0,100)}...\nالبصمة: ${res.checksum.slice(0, 16)}...`
      );
      load();
    } catch (e: any) {
      Alert.alert('خطأ', e.message ?? 'فشل النسخ الاحتياطي');
    } finally {
      setBackupBusy(false);
      setProgress(0);
    }
  };

  const onRestore = async () => {
    Alert.alert(
      'تحذير',
      'الاستعادة ستستبدل البيانات الحالية بالكامل. هل أنت متأكد؟ هذه العملية تجريبية.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'متابعة',
          style: 'destructive',
          onPress: async () => {
            try {
              const ok = await restoreBackup();
              if (ok) {
                Alert.alert('تم', 'تمت الاستعادة — يُنصح بإعادة تشغيل التطبيق');
                load();
              }
            } catch (e: any) {
              Alert.alert('تنبيه', e.message ?? 'فشل الاستعادة');
            }
          },
        },
      ]
    );
  };

  const onChangePw = async () => {
    if (!oldPw || !newPw) {
      Alert.alert('تنبيه', 'أدخل كلمة المرور الحالية والجديدة');
      return;
    }
    try {
      await changePassword(oldPw, newPw);
      setPwSheet(false);
      setOldPw('');
      setNewPw('');
      Alert.alert('تم', 'تم تغيير كلمة المرور بنجاح');
    } catch (e: any) {
      Alert.alert('خطأ', e.message ?? 'فشل تغيير كلمة المرور');
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
    >
      {/* الحساب */}
      <Card>
        <View style={s.profile}>
          <View style={s.avatar}>
            <Ionicons name="person" size={26} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{user?.full_name ?? user?.username}</Text>
            <Text style={s.role}>
              {user?.username} — {isAdmin ? 'مدير المخزن' : 'مستخدم عادي'}
            </Text>
          </View>
        </View>
      </Card>

      {/* البيانات */}
      <Text style={s.section}>البيانات والنسخ الاحتياطي</Text>
      <Card style={{ padding: spacing.sm }}>
        <Row
          icon="cube-outline"
          title="جدول الأصناف"
          subtitle="عرض كافة الأدوات والبحث"
          onPress={() => router.push('/tools_table')}
        />
        <Row
          icon="cloud-upload-outline"
          title="استيراد من Excel"
          subtitle="تغذية المخزن من ملف xlsx"
          onPress={() => router.push('/import-excel')}
        />
        <Row
          icon="document-outline"
          title="تنزيل قالب Excel"
          subtitle="ملف جاهز بالأعمدة المطلوبة"
          onPress={() => exportTemplate().catch((e) => Alert.alert('خطأ', e.message))}
        />
        <Row
          icon="save-outline"
          title="نسخة احتياطية"
          subtitle={
            backupBusy ? `جارٍ الضغط... ${progress}%` : 'تصدير كل البيانات كـ JSON'
          }
          onPress={onBackup}
          disabled={backupBusy}
        />
        <Row
          icon="refresh-outline"
          title="استعادة نسخة"
          subtitle="استبدال البيانات الحالية (تجريبي)"
          onPress={onRestore}
          danger
          last
        />
      </Card>

      {/* تخصيصات الجدول */}
      <Text style={s.section}>تخصيص جدول الأصناف</Text>
      <Card style={{ padding: spacing.sm }}>
        <View style={s.row}>
          <View style={s.rowIcon}><Ionicons name="eye-outline" size={19} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>إظهار عمود التصنيف</Text>
            <Text style={s.rowSub}>في جدول الأصناف المفصل</Text>
          </View>
          <Switch value={showCategory} onValueChange={toggleShowCategory} trackColor={{ true: colors.primary }} />
        </View>
        <View style={[s.row, s.rowBorder]}>
          <View style={s.rowIcon}><Ionicons name="list-outline" size={19} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>الفرز الافتراضي</Text>
            <Text style={s.rowSub}>ترتيب الأدوات عند الفتح</Text>
          </View>
          <View style={{flexDirection: 'row', gap: 8}}>
             <Pressable onPress={() => updateDefaultSort('name')} style={[s.sortBtn, defaultSort === 'name' && s.sortBtnActive]}>
                <Text style={[s.sortText, defaultSort === 'name' && s.sortTextActive]}>الاسم</Text>
             </Pressable>
             <Pressable onPress={() => updateDefaultSort('quantity')} style={[s.sortBtn, defaultSort === 'quantity' && s.sortBtnActive]}>
                <Text style={[s.sortText, defaultSort === 'quantity' && s.sortTextActive]}>الكمية</Text>
             </Pressable>
          </View>
        </View>
      </Card>

      {/* الإدارة */}
      {isAdmin && (
        <>
          <Text style={s.section}>الإدارة</Text>
          <Card style={{ padding: spacing.sm }}>
            <Row
              icon="people-outline"
              title="إدارة المستخدمين"
              subtitle="إضافة وتعديل الصلاحيات"
              onPress={() => router.push('/users')}
            />
            <Row
              icon="pricetags-outline"
              title="إدارة التصنيفات"
              subtitle="تصنيفات الأدوات"
              onPress={() => router.push('/categories')}
            />
            <Row
              icon="list-outline"
              title="سجل الإجراءات"
              subtitle="تتبع كل عملية ومن نفّذها"
              onPress={() => router.push('/audit')}
              last
            />
          </Card>
        </>
      )}

      {/* التنبيهات */}
      <Text style={s.section}>التنبيهات المحلية</Text>
      <Card style={{ padding: spacing.sm }}>
        <Row
          icon="alarm-outline"
          title="فحص الأدوات المتأخرة"
          subtitle="إرسال تنبيه فوري بالمتأخرات"
          onPress={async () => {
            const n = await checkOverdueAndNotify();
            Alert.alert('النتيجة', n ? `${n} أداة متأخرة` : 'لا توجد أدوات متأخرة ✅');
          }}
        />
        <Row
          icon="trending-down-outline"
          title="فحص الكميات المنخفضة"
          subtitle="تنبيه بالأدوات القريبة من النفاد"
          onPress={async () => {
            const n = await checkLowStockAndNotify();
            Alert.alert('النتيجة', n ? `${n} أداة بكمية منخفضة` : 'الكميات جيدة ✅');
          }}
          last
        />
      </Card>

      {/* معلومات النظام */}
      <Text style={s.section}>معلومات النظام</Text>
      <Card>
        <Info label="إصدار التطبيق" value={Constants.expoConfig?.version ?? '1.0.0'} />
        <Info label="حجم قاعدة البيانات" value={dbSize ? formatBytes(dbSize) : 'غير متاح (Firestore سحابي)'} />
        {storage && (
          <>
            <Info label="الجهاز" value={storage.deviceModel ?? 'غير معروف'} />
            <Info label="نظام أندرويد" value={storage.androidRelease ?? '-'} />
            <Info
              label="المساحة المتاحة"
              value={storage.freeBytes ? `${formatBytes(storage.freeBytes)} من ${formatBytes(storage.totalBytes)}` : 'غير متاح'}
            />
          </>
        )}
        {nativeInfo && (
          <Info
            label="الوحدة الأصلية (Kotlin)"
            value={`v${nativeInfo.moduleVersion} — API ${nativeInfo.sdkInt}`}
          />
        )}
        <Info label="نوع البناء" value="Firestore + محلي — Expo 57" />
        <Info label="المستخدم الحالي" value={user?.username ?? '-'} />
      </Card>

      {/* الحساب */}
      <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
        <Button
          title="تغيير كلمة المرور"
          icon="key-outline"
          variant="outline"
          onPress={() => setPwSheet(true)}
        />
        <Button
          title="تسجيل الخروج"
          icon="log-out-outline"
          variant="danger"
          onPress={() => {
            signOut();
            router.replace('/login');
          }}
        />
      </View>

      <Sheet visible={pwSheet} onClose={() => setPwSheet(false)} title="تغيير كلمة المرور">
        <Field
          label="كلمة المرور الحالية"
          value={oldPw}
          onChangeText={setOldPw}
          secureTextEntry
          placeholder="الحالية"
        />
        <Field
          label="كلمة المرور الجديدة"
          value={newPw}
          onChangeText={setNewPw}
          secureTextEntry
          hint="6 أحرف على الأقل"
          placeholder="الجديدة"
        />
        <Button title="حفظ" icon="save-outline" onPress={onChangePw} />
      </Sheet>
    </ScrollView>
  );
}

function Row({
  icon,
  title,
  subtitle,
  onPress,
  danger,
  last,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.row,
        !last && s.rowBorder,
        { opacity: pressed || disabled ? 0.6 : 1 },
      ]}
    >
      <View
        style={[
          s.rowIcon,
          { backgroundColor: danger ? colors.dangerLight : colors.primaryLight },
        ]}
      >
        <Ionicons name={icon} size={19} color={danger ? colors.danger : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowTitle, danger && { color: colors.danger }]}>{title}</Text>
        <Text style={s.rowSub}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-back" size={17} color={colors.textLight} />
    </Pressable>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.info}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  profile: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: font.h3, fontWeight: '800', color: colors.text, textAlign: 'right' },
  role: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2, textAlign: 'right' },

  section: {
    fontSize: font.h3,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    textAlign: 'right',
  },

  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: font.small, fontWeight: '700', color: colors.text, textAlign: 'right' },
  rowSub: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2, textAlign: 'right' },

  sortBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  sortBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sortText: { fontSize: font.tiny, color: colors.textMuted, fontWeight: '700' },
  sortTextActive: { color: colors.white },

  info: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  infoLabel: { fontSize: font.small, color: colors.textMuted },
  infoValue: { fontSize: font.small, fontWeight: '700', color: colors.text, flexShrink: 1, textAlign: 'left' },
});
