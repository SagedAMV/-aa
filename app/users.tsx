import React, { useState, useEffect } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { collection, query, orderBy, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../src/services/firebase';
import { hashPassword } from '../src/utils/crypto';
import { useAuth } from '../src/context/AuthContext';
import { Badge, Button, Card, Field, Sheet } from '../src/components/UI';
import { colors, font, radius, spacing } from '../src/theme';
import type { User } from '../src/types';

export default function UsersScreen() {
  const { user: me, isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [sheet, setSheet] = useState(false);

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [canWithdraw, setCanWithdraw] = useState(false);
  const [canAdd, setCanAdd] = useState(false);

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
        } as User;
      });
      setUsers(usersData);
    }, (err) => {
      console.error('users snapshot error', err);
    });
    return () => unsubscribe();
  }, []);

  const onCreate = async () => {
    if (!username.trim() || !fullName.trim() || password.length < 6) {
      Alert.alert('تنبيه', 'أكمل الحقول — كلمة المرور 6 أحرف على الأقل');
      return;
    }
    if (!isAdmin && me?.username !== 'admin') {
      Alert.alert('غير مصرح', 'فقط المدير يمكنه إنشاء مستخدمين');
      return;
    }
    const uname = username.trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,30}$/.test(uname)) {
      Alert.alert('تنبيه', 'اسم المستخدم يجب أن يكون 3-30 حرف إنجليزي/أرقام/ _ . - فقط');
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
        can_withdraw_direct: canWithdraw ? 1 : 0,
        can_add_tools: canAdd ? 1 : 0,
        is_active: 1,
        created_at: serverTimestamp(),
      });

      // audit
      try {
        const { addDoc } = await import('firebase/firestore');
        await addDoc(collection(db, 'audit_logs'), {
          actor: me?.username ?? 'system',
          action: 'create',
          entity: 'user',
          entity_id: userRef.id,
          details: `created user ${uname}`,
          created_at: serverTimestamp(),
        });
      } catch {}

      Alert.alert('تم', `تم إنشاء المستخدم ${uname}`);
      setSheet(false);
      setUsername('');
      setFullName('');
      setPassword('');
      setRole('user');
      setCanWithdraw(false);
      setCanAdd(false);
    } catch (e: any) {
      console.error(e);
      Alert.alert('خطأ', e.message ?? 'فشل إنشاء المستخدم');
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
        renderItem={({ item }) => (
          <Card style={{ padding: spacing.md, marginBottom: spacing.sm }}>
            <View style={s.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.full_name}</Text>
                <Text style={s.username}>{item.username} {item.id === me?.id ? '(أنت)' : ''}</Text>
              </View>
              <Badge text={item.role === 'admin' ? 'مدير' : 'مستخدم'} tone={item.role === 'admin' ? 'danger' : 'info'} />
            </View>
            <View style={s.perms}>
              {item.can_withdraw_direct ? <Badge text="صرف مباشر" tone="success" /> : null}
              {item.can_add_tools ? <Badge text="إضافة أدوات" tone="info" /> : null}
              {item.is_active === 0 ? <Badge text="معطل" tone="muted" /> : null}
            </View>
          </Card>
        )}
        ListEmptyComponent={<Text style={s.empty}>لا يوجد مستخدمون بعد</Text>}
      />

      <View style={s.bottomBtn}>
        <Button title="إضافة مستخدم" icon="person-add-outline" onPress={() => setSheet(true)} />
      </View>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="مستخدم جديد">
        <Field label="اسم المستخدم (إنجليزي)" required value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="ahmed.saleh" />
        <Field label="الاسم الكامل" required value={fullName} onChangeText={setFullName} placeholder="أحمد صالح" />
        <Field label="كلمة المرور" required value={password} onChangeText={setPassword} secureTextEntry placeholder="6 أحرف على الأقل" />
        <View style={s.row}>
          <Text style={s.rowLabel}>مدير مخزن؟</Text>
          <Switch value={role === 'admin'} onValueChange={(v) => setRole(v ? 'admin' : 'user')} trackColor={{ true: colors.primary }} />
        </View>
        <View style={s.row}>
          <View>
            <Text style={s.rowLabel}>صلاحية الصرف المباشر؟</Text>
            <Text style={s.rowHint}>يمكنه صرف بدون موافقة</Text>
          </View>
          <Switch value={canWithdraw} onValueChange={setCanWithdraw} trackColor={{ true: colors.primary }} />
        </View>
        <View style={s.row}>
          <View>
            <Text style={s.rowLabel}>صلاحية إضافة أدوات؟</Text>
            <Text style={s.rowHint}>يمكنه إضافة أصناف وكميات</Text>
          </View>
          <Switch value={canAdd} onValueChange={setCanAdd} trackColor={{ true: colors.primary }} />
        </View>
        <Button title="حفظ المستخدم" icon="save-outline" onPress={onCreate} style={{ marginTop: spacing.lg }} />
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.xl },
  centerText: { fontSize: font.h3, color: colors.textMuted, textAlign: 'center' },
  cardTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  name: { fontSize: font.body, fontWeight: '800', color: colors.text, textAlign: 'right' },
  username: { fontSize: font.small, color: colors.textMuted, textAlign: 'right', marginTop: 2 },
  perms: { flexDirection: 'row-reverse', gap: 6, marginTop: spacing.sm, flexWrap: 'wrap' },
  empty: { textAlign: 'center', color: colors.textMuted, padding: spacing.xxl },
  bottomBtn: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { fontSize: font.small, fontWeight: '700', color: colors.text, textAlign: 'right' },
  rowHint: { fontSize: font.tiny, color: colors.textMuted, textAlign: 'right' },
});
