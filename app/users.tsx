import React, { useState, useEffect } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  where,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../src/services/firebase';
import { hashPassword } from '../src/utils/crypto';
import { useAuth } from '../src/context/AuthContext';
import { Badge, Button, Card, Field, Sheet } from '../src/components/UI';
import { colors, font, radius, spacing } from '../src/theme';
import type { User, PermissionLevel } from '../src/types';

const WITHDRAW_LEVELS: { key: PermissionLevel; label: string }[] = [
  { key: 'none', label: 'ممنوع' },
  { key: 'with_approval', label: 'بموافقة' },
  { key: 'direct', label: 'مباشر' },
];

const ADDITION_LEVELS: { key: PermissionLevel; label: string }[] = [
  { key: 'none', label: 'ممنوع' },
  { key: 'with_approval', label: 'بموافقة' },
  { key: 'direct', label: 'مباشر' },
];

export default function UsersScreen() {
  const { user: me, isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [sheet, setSheet] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // البيانات الأساسية
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');

  // الصلاحيات الثلاثية
  const [withdrawLevel, setWithdrawLevel] = useState<PermissionLevel>('none');
  const [additionLevel, setAdditionLevel] = useState<PermissionLevel>('none');

  // الصلاحيات الأخرى
  const [canScan, setCanScan] = useState(true);
  const [canViewReports, setCanViewReports] = useState(true);
  const [canExport, setCanExport] = useState(true);
  const [canImport, setCanImport] = useState(false);
  const [canManageCategories, setCanManageCategories] = useState(false);
  const [canManageTools, setCanManageTools] = useState(false);
  const [canViewAudit, setCanViewAudit] = useState(false);

  // حالة الحساب
  const [isActive, setIsActive] = useState(true);
  const [disabledReason, setDisabledReason] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('username'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(docSnap => {
        const data = docSnap.data() as any;
        return {
          id: docSnap.id as any,
          username: data.username,
          full_name: data.full_name,
          role: data.role ?? 'user',
          can_withdraw_direct: data.can_withdraw_direct ?? 0,
          can_add_tools: data.can_add_tools ?? 0,
          is_active: data.is_active ?? 1,
          created_at: data.created_at?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
          permissions: data.permissions,
          disabled_reason: data.disabled_reason,
        } as User;
      });
      setUsers(usersData);
    });
    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setUsername('');
    setFullName('');
    setPassword('');
    setRole('user');
    setWithdrawLevel('none');
    setAdditionLevel('none');
    setCanScan(true);
    setCanViewReports(true);
    setCanExport(true);
    setCanImport(false);
    setCanManageCategories(false);
    setCanManageTools(false);
    setCanViewAudit(false);
    setIsActive(true);
    setDisabledReason('');
    setEditingUser(null);
  };

  const openEditSheet = (u: User) => {
    setEditingUser(u);
    setUsername(u.username);
    setFullName(u.full_name);
    setPassword('');
    setRole(u.role);
    setWithdrawLevel(u.permissions?.withdraw_level ?? (u.can_withdraw_direct ? 'direct' : 'none'));
    setAdditionLevel(u.permissions?.addition_level ?? (u.can_add_tools ? 'direct' : 'none'));
    setCanScan(u.permissions?.can_scan !== false);
    setCanViewReports(u.permissions?.can_view_reports !== false);
    setCanExport(u.permissions?.can_export !== false);
    setCanImport(u.permissions?.can_import ?? false);
    setCanManageCategories(u.permissions?.can_manage_categories ?? false);
    setCanManageTools(u.permissions?.can_manage_tools ?? false);
    setCanViewAudit(u.permissions?.can_view_audit ?? false);
    setIsActive(u.is_active !== 0);
    setDisabledReason(u.disabled_reason ?? '');
    setSheet(true);
  };

  const onSave = async () => {
    if (!editingUser) {
      // إنشاء مستخدم جديد
      if (!username.trim() || !fullName.trim() || password.length < 6) {
        Alert.alert('تنبيه', 'أكمل الحقول — كلمة المرور 6 أحرف على الأقل');
        return;
      }
      const uname = username.trim().toLowerCase();
      if (!/^[a-z0-9_.-]{3,30}$/.test(uname)) {
        Alert.alert('تنبيه', 'اسم المستخدم: 3-30 حرف إنجليزي/أرقام/ _ . - فقط');
        return;
      }

      try {
        const { hash, salt } = await hashPassword(password);
        const userRef = doc(collection(db, 'users'));
        await setDoc(userRef, {
          username: uname,
          full_name: fullName.trim(),
          password_hash: hash,
          salt,
          role,
          permissions: {
            withdraw_level: withdrawLevel,
            addition_level: additionLevel,
            can_scan: canScan,
            can_view_reports: canViewReports,
            can_export: canExport,
            can_import: canImport,
            can_manage_categories: canManageCategories,
            can_manage_tools: canManageTools,
            can_view_audit: canViewAudit,
          },
          can_withdraw_direct: withdrawLevel === 'direct' ? 1 : 0,
          can_add_tools: additionLevel === 'direct' ? 1 : 0,
          is_active: isActive ? 1 : 0,
          disabled_reason: isActive ? null : disabledReason || null,
          disabled_at: isActive ? null : serverTimestamp(),
          disabled_by: isActive ? null : me?.username,
          created_at: serverTimestamp(),
        });

        // Audit
        try {
          await addDoc(collection(db, 'audit_logs'), {
            actor: me?.username ?? 'system',
            action: 'create',
            entity: 'user',
            entity_id: userRef.id,
            details: `إنشاء مستخدم: ${uname}`,
            created_at: serverTimestamp(),
          });
        } catch {}

        Alert.alert('تم', `تم إنشاء المستخدم ${uname}`);
        setSheet(false);
        resetForm();
      } catch (e: any) {
        Alert.alert('خطأ', e.message ?? 'فشل إنشاء المستخدم');
      }
    } else {
      // تعديل مستخدم موجود
      try {
        const userRef = doc(db, 'users', String(editingUser.id));
        const updateData: any = {
          full_name: fullName.trim(),
          role,
          permissions: {
            withdraw_level: withdrawLevel,
            addition_level: additionLevel,
            can_scan: canScan,
            can_view_reports: canViewReports,
            can_export: canExport,
            can_import: canImport,
            can_manage_categories: canManageCategories,
            can_manage_tools: canManageTools,
            can_view_audit: canViewAudit,
          },
          can_withdraw_direct: withdrawLevel === 'direct' ? 1 : 0,
          can_add_tools: additionLevel === 'direct' ? 1 : 0,
          is_active: isActive ? 1 : 0,
          disabled_reason: isActive ? null : disabledReason || null,
        };

        if (password.length >= 6) {
          const { hash, salt } = await hashPassword(password);
          updateData.password_hash = hash;
          updateData.salt = salt;
        }

        if (!isActive) {
          updateData.disabled_at = serverTimestamp();
          updateData.disabled_by = me?.username;
        }

        await updateDoc(userRef, updateData);

        // Audit
        try {
          await addDoc(collection(db, 'audit_logs'), {
            actor: me?.username ?? 'system',
            action: 'update',
            entity: 'user',
            entity_id: String(editingUser.id),
            details: `تعديل صلاحيات: ${username} — الدور: ${role}`,
            created_at: serverTimestamp(),
          });
        } catch {}

        Alert.alert('تم', `تم تحديث بيانات ${username}`);
        setSheet(false);
        resetForm();
      } catch (e: any) {
        Alert.alert('خطأ', e.message ?? 'فشل التحديث');
      }
    }
  };

  // ========== حذف مستخدم ==========
  const onDeleteUser = async (targetUser: User) => {
    const targetId = String(targetUser.id);
    const myId = String(me?.id);

    // حماية: لا يمكن حذف نفسه
    if (targetId === myId) {
      Alert.alert('تنبيه', 'لا يمكنك حذف حسابك الخاص');
      return;
    }

    // حماية: لا يمكن حذف حساب admin الافتراضي
    if (targetUser.username === 'admin') {
      Alert.alert('تنبيه', 'لا يمكن حذف حساب المدير الافتراضي');
      return;
    }

    // فحص العمليات المعلقة
    let pendingCount = 0;
    try {
      const wdSnap = await getDocs(
        query(collection(db, 'withdrawals'), where('withdrawn_by', '==', targetUser.username), where('status', '==', 'pending'))
      );
      pendingCount = wdSnap.size;
    } catch {}

    let message = `هل أنت متأكد من حذف المستخدم "${targetUser.full_name}" (${targetUser.username})؟`;
    if (pendingCount > 0) {
      message += `\n\n⚠️ تنبيه: يوجد ${pendingCount} عملية صرف معلقة باسم هذا المستخدم.`;
    }
    message += '\n\nهذا الإجراء لا يمكن التراجع عنه.';

    Alert.alert(
      '🗑️ حذف مستخدم',
      message,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف نهائي',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(targetId);
            try {
              await deleteDoc(doc(db, 'users', targetId));

              // Audit
              try {
                await addDoc(collection(db, 'audit_logs'), {
                  actor: me?.username ?? 'system',
                  action: 'delete',
                  entity: 'user',
                  entity_id: targetId,
                  details: `حذف مستخدم: ${targetUser.username} — ${targetUser.full_name}`,
                  created_at: serverTimestamp(),
                });
              } catch {}

              Alert.alert('تم', `تم حذف المستخدم ${targetUser.username}`);
            } catch (e: any) {
              Alert.alert('خطأ', e.message ?? 'فشل حذف المستخدم');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  // ========== تعطيل/تفعيل سريع ==========
  const onToggleActive = async (targetUser: User) => {
    const isCurrentlyActive = targetUser.is_active !== 0;

    if (String(targetUser.id) === String(me?.id)) {
      Alert.alert('تنبيه', 'لا يمكنك تعطيل حسابك الخاص');
      return;
    }

    if (targetUser.username === 'admin') {
      Alert.alert('تنبيه', 'لا يمكن تعطيل حساب المدير الافتراضي');
      return;
    }

    try {
      const userRef = doc(db, 'users', String(targetUser.id));
      if (isCurrentlyActive) {
        // تعطيل
        await updateDoc(userRef, {
          is_active: 0,
          disabled_at: serverTimestamp(),
          disabled_by: me?.username,
        });
      } else {
        // تفعيل
        await updateDoc(userRef, {
          is_active: 1,
          disabled_reason: null,
          disabled_at: null,
        });
      }

      // Audit
      try {
        await addDoc(collection(db, 'audit_logs'), {
          actor: me?.username ?? 'system',
          action: isCurrentlyActive ? 'disable_user' : 'enable_user',
          entity: 'user',
          entity_id: String(targetUser.id),
          details: `${isCurrentlyActive ? 'تعطيل' : 'تفعيل'} مستخدم: ${targetUser.username}`,
          created_at: serverTimestamp(),
        });
      } catch {}
    } catch (e: any) {
      Alert.alert('خطأ', e.message ?? 'فشل العملية');
    }
  };

  if (!isAdmin && me?.username !== 'admin') {
    return (
      <View style={s.center}>
        <Text style={s.centerText}>هذه الصفحة متاحة للمدير فقط</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={users}
        keyExtractor={(u) => String(u.id)}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 90 }}
        renderItem={({ item }) => {
          const wl = item.permissions?.withdraw_level ?? (item.can_withdraw_direct ? 'direct' : 'none');
          const al = item.permissions?.addition_level ?? (item.can_add_tools ? 'direct' : 'none');
          const isMe = item.id === me?.id;
          const isDefaultAdmin = item.username === 'admin' && item.id === 'admin';
          const isDisabled = item.is_active === 0;
          const isDeleting = deletingId === String(item.id);

          return (
            <Card style={{ padding: spacing.md, marginBottom: spacing.sm, opacity: isDeleting ? 0.5 : 1 }}>
              <Pressable onPress={() => openEditSheet(item)} disabled={isDeleting}>
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{item.full_name}</Text>
                    <Text style={s.username}>
                      {item.username} {isMe ? '(أنت)' : ''}
                    </Text>
                  </View>
                  <View style={s.cardBadges}>
                    <Badge text={item.role === 'admin' ? 'مدير' : 'مستخدم'} tone={item.role === 'admin' ? 'danger' : 'info'} />
                    {isDisabled && <Badge text="معطّل" tone="muted" />}
                  </View>
                </View>
                <View style={s.perms}>
                  <Badge text={`صرف: ${wl === 'direct' ? 'مباشر' : wl === 'with_approval' ? 'بموافقة' : 'ممنوع'}`} tone={wl === 'direct' ? 'success' : wl === 'with_approval' ? 'warning' : 'muted'} />
                  <Badge text={`إضافة: ${al === 'direct' ? 'مباشر' : al === 'with_approval' ? 'بموافقة' : 'ممنوع'}`} tone={al === 'direct' ? 'success' : al === 'with_approval' ? 'warning' : 'muted'} />
                </View>
              </Pressable>

              {/* أزرار الإجراءات السريعة */}
              {!isMe && !isDefaultAdmin && (
                <View style={s.actionRow}>
                  {/* تعطيل/تفعيل */}
                  <Pressable
                    style={[s.actionBtn, isDisabled ? s.actionBtnSuccess : s.actionBtnWarn]}
                    onPress={() => onToggleActive(item)}
                  >
                    <Ionicons
                      name={isDisabled ? 'person-add-outline' : 'person-remove-outline'}
                      size={15}
                      color={isDisabled ? colors.success : colors.warning}
                    />
                    <Text style={[s.actionBtnText, { color: isDisabled ? colors.success : colors.warning }]}>
                      {isDisabled ? 'تفعيل' : 'تعطيل'}
                    </Text>
                  </Pressable>

                  {/* حذف */}
                  <Pressable
                    style={s.actionBtnDanger}
                    onPress={() => onDeleteUser(item)}
                    disabled={isDeleting}
                  >
                    <Ionicons name="trash-outline" size={15} color={colors.danger} />
                    <Text style={[s.actionBtnText, { color: colors.danger }]}>حذف</Text>
                  </Pressable>
                </View>
              )}

              {/* تنبيه للمحظورات */}
              {(isMe || isDefaultAdmin) && (
                <View style={s.protectedBadge}>
                  <Ionicons name="shield-checkmark-outline" size={13} color={colors.textLight} />
                  <Text style={s.protectedText}>
                    {isMe ? 'لا يمكن تعديل أو حذف حسابك من هنا' : 'حساب محمي'}
                  </Text>
                </View>
              )}
            </Card>
          );
        }}
        ListEmptyComponent={<Text style={s.empty}>لا يوجد مستخدمون بعد</Text>}
      />

      <View style={s.bottomBtn}>
        <Button
          title="إضافة مستخدم"
          icon="person-add-outline"
          onPress={() => { resetForm(); setSheet(true); }}
        />
      </View>

      {/* Sheet التعديل */}
      <Sheet visible={sheet} onClose={() => { setSheet(false); resetForm(); }} title={editingUser ? 'تعديل مستخدم' : 'مستخدم جديد'}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={s.sectionTitle}>البيانات الأساسية</Text>
          <Field label="اسم المستخدم (إنجليزي)" required value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="ahmed.saleh" editable={!editingUser} />
          <Field label="الاسم الكامل" required value={fullName} onChangeText={setFullName} placeholder="أحمد صالح" />
          <Field
            label={editingUser ? 'كلمة مرور جديدة (اتركها فارغة للإبقاء)' : 'كلمة المرور'}
            required={!editingUser}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="6 أحرف على الأقل"
          />
          <View style={s.row}>
            <Text style={s.rowLabel}>مدير مخزن؟</Text>
            <Switch value={role === 'admin'} onValueChange={(v) => setRole(v ? 'admin' : 'user')} trackColor={{ true: colors.primary }} />
          </View>

          <Text style={s.sectionTitle}>صلاحيات الصرف</Text>
          <View style={s.levelRow}>
            {WITHDRAW_LEVELS.map((l) => (
              <Pressable
                key={l.key}
                onPress={() => setWithdrawLevel(l.key)}
                style={[s.levelBtn, withdrawLevel === l.key && s.levelBtnActive]}
              >
                <Text style={[s.levelText, withdrawLevel === l.key && { color: colors.white }]}>
                  {l.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={s.sectionTitle}>صلاحيات إضافة الكميات</Text>
          <View style={s.levelRow}>
            {ADDITION_LEVELS.map((l) => (
              <Pressable
                key={l.key}
                onPress={() => setAdditionLevel(l.key)}
                style={[s.levelBtn, additionLevel === l.key && s.levelBtnActive]}
              >
                <Text style={[s.levelText, additionLevel === l.key && { color: colors.white }]}>
                  {l.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={s.sectionTitle}>صلاحيات أخرى</Text>
          <View style={s.row}>
            <Text style={s.rowLabel}>مسح الباركود</Text>
            <Switch value={canScan} onValueChange={setCanScan} trackColor={{ true: colors.primary }} />
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>عرض التقارير</Text>
            <Switch value={canViewReports} onValueChange={setCanViewReports} trackColor={{ true: colors.primary }} />
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>تصدير Excel/PDF</Text>
            <Switch value={canExport} onValueChange={setCanExport} trackColor={{ true: colors.primary }} />
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>استيراد من Excel</Text>
            <Switch value={canImport} onValueChange={setCanImport} trackColor={{ true: colors.primary }} />
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>إدارة التصنيفات</Text>
            <Switch value={canManageCategories} onValueChange={setCanManageCategories} trackColor={{ true: colors.primary }} />
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>إضافة/تعديل/حذف أدوات</Text>
            <Switch value={canManageTools} onValueChange={setCanManageTools} trackColor={{ true: colors.primary }} />
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>عرض سجل الإجراءات</Text>
            <Switch value={canViewAudit} onValueChange={setCanViewAudit} trackColor={{ true: colors.primary }} />
          </View>

          <Text style={s.sectionTitle}>حالة الحساب</Text>
          <View style={s.row}>
            <Text style={s.rowLabel}>الحساب مفعّل</Text>
            <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: colors.success, false: colors.dangerLight }} />
          </View>
          {!isActive && (
            <Field
              label="سبب التعطيل"
              value={disabledReason}
              onChangeText={setDisabledReason}
              placeholder="مثال: إجازة طويلة — مخالفة..."
            />
          )}

          <Button
            title={editingUser ? 'حفظ التعديلات' : 'إنشاء المستخدم'}
            icon="save-outline"
            onPress={onSave}
            style={{ marginTop: spacing.lg, marginBottom: spacing.xl }}
          />
        </ScrollView>
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.xl },
  centerText: { fontSize: font.h3, color: colors.textMuted, textAlign: 'center' },
  cardTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  cardBadges: { flexDirection: 'row-reverse', gap: 4 },
  name: { fontSize: font.body, fontWeight: '800', color: colors.text, textAlign: 'right' },
  username: { fontSize: font.small, color: colors.textMuted, textAlign: 'right', marginTop: 2 },
  perms: { flexDirection: 'row-reverse', gap: 6, marginTop: spacing.sm, flexWrap: 'wrap' },
  empty: { textAlign: 'center', color: colors.textMuted, padding: spacing.xxl },
  bottomBtn: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { fontSize: font.small, fontWeight: '700', color: colors.text, textAlign: 'right' },
  sectionTitle: { fontSize: font.small, fontWeight: '800', color: colors.primary, marginTop: spacing.lg, marginBottom: spacing.sm, textAlign: 'right' },
  levelRow: { flexDirection: 'row-reverse', gap: spacing.sm, marginBottom: spacing.md },
  levelBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.card },
  levelBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  levelText: { fontSize: font.tiny, fontWeight: '700', color: colors.textMuted },
  // أزرار الإجراءات
  actionRow: { flexDirection: 'row-reverse', gap: spacing.sm, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  actionBtn: {
    flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1,
  },
  actionBtnWarn: { borderColor: colors.warningLight, backgroundColor: colors.warningLight + '40' },
  actionBtnSuccess: { borderColor: colors.successLight, backgroundColor: colors.successLight + '40' },
  actionBtnDanger: {
    flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 8, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.dangerLight, backgroundColor: colors.dangerLight + '40',
  },
  actionBtnText: { fontSize: font.tiny, fontWeight: '700' },
  // محمي
  protectedBadge: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border,
  },
  protectedText: { fontSize: font.tiny, color: colors.textLight },
});
