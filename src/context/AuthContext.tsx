import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { hashPassword, verifyPassword } from '../utils/crypto';
import type { User, PermissionLevel } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  ready: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  canWithdrawDirect: boolean;
  canAddTools: boolean;
  changePassword: (oldPw: string, newPw: string) => Promise<void>;
  // الصلاحيات الجديدة
  withdrawLevel: PermissionLevel;
  additionLevel: PermissionLevel;
  canScan: boolean;
  canViewReports: boolean;
  canExport: boolean;
  canImport: boolean;
  canManageCategories: boolean;
  canManageTools: boolean;
  canViewAudit: boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);
const SESSION_KEY = 'user_session';

// دالة مساعدة لاستخراج مستوى الصلاحية
function getPermissionLevel(user: User, type: 'withdraw' | 'addition'): PermissionLevel {
  if (user.role === 'admin') return 'direct';
  
  const perms = user.permissions;
  if (!perms) {
    // Backward compatibility: استخدم الحقول القديمة
    if (type === 'withdraw') {
      return user.can_withdraw_direct === 1 ? 'direct' : 'none';
    }
    return user.can_add_tools === 1 ? 'direct' : 'none';
  }
  
  return type === 'withdraw' ? perms.withdraw_level : perms.addition_level;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const session = await AsyncStorage.getItem(SESSION_KEY);
        if (session) {
          const parsed = JSON.parse(session);
          if (parsed && parsed.username) {
            setUser(parsed);
          }
        }
      } catch (e) {
        console.error('Failed to load session', e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      const trimmed = username.trim().toLowerCase();
      if (!trimmed || !password) throw new Error('أدخل اسم المستخدم وكلمة المرور');

      // Special bootstrap admin
      if (trimmed === 'admin' && password === 'admin123') {
        try {
          const q = query(collection(db, 'users'), where('username', '==', 'admin'));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const docData = snap.docs[0].data();
            const u = snap.docs[0].id;
            if (docData.password_hash && docData.salt) {
              const ok = await verifyPassword(password, docData.password_hash, docData.salt);
              if (!ok) throw new Error('كلمة المرور غير صحيحة');
            }
            // Check if disabled
            if (docData.is_active === 0) {
              const reason = docData.disabled_reason || 'لا يوجد سبب محدد';
              throw new Error(`حسابك معطل — ${reason}\nتواصل مع المدير`);
            }
            const realUser: User = {
              id: u as any,
              username: docData.username,
              full_name: docData.full_name ?? 'مدير المخزن',
              role: docData.role ?? 'admin',
              can_withdraw_direct: docData.can_withdraw_direct ?? 1,
              can_add_tools: docData.can_add_tools ?? 1,
              is_active: docData.is_active ?? 1,
              created_at: docData.created_at?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
              permissions: docData.permissions,
            };
            setUser(realUser);
            await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(realUser));
            return;
          }
        } catch (err) {
          console.warn('Admin firestore check failed, using local fallback', err);
        }

        const adminUser: User = {
          id: 'admin' as any,
          username: 'admin',
          full_name: 'مدير المخزن',
          role: 'admin',
          can_withdraw_direct: 1,
          can_add_tools: 1,
          is_active: 1,
          created_at: new Date().toISOString(),
        };
        setUser(adminUser);
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(adminUser));
        return;
      }

      // Normal Firestore auth
      const q = query(collection(db, 'users'), where('username', '==', trimmed));
      const snap = await getDocs(q);
      if (snap.empty) throw new Error('اسم المستخدم غير موجود');

      const docSnap = snap.docs[0];
      const data = docSnap.data();

      // Check if disabled
      if (data.is_active === 0) {
        const reason = data.disabled_reason || 'لا يوجد سبب محدد';
        throw new Error(`حسابك معطل — ${reason}\nتواصل مع المدير`);
      }

      if (!data.password_hash || !data.salt) {
        throw new Error('حساب بدون كلمة مرور، يرجى إعادة تعيينه');
      }

      const valid = await verifyPassword(password, data.password_hash, data.salt);
      if (!valid) throw new Error('كلمة المرور غير صحيحة');

      const loggedUser: User = {
        id: docSnap.id as any,
        username: data.username,
        full_name: data.full_name,
        role: data.role ?? 'user',
        can_withdraw_direct: data.can_withdraw_direct ?? 0,
        can_add_tools: data.can_add_tools ?? 0,
        is_active: data.is_active ?? 1,
        created_at: data.created_at?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
        permissions: data.permissions,
      };

      setUser(loggedUser);
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(loggedUser));

      // Log to audit
      try {
        const { addDoc, serverTimestamp } = await import('firebase/firestore');
        await addDoc(collection(db, 'audit_logs'), {
          actor: loggedUser.username,
          actor_id: loggedUser.id,
          action: 'login',
          entity: 'user',
          entity_id: loggedUser.id,
          details: 'login',
          created_at: serverTimestamp(),
        });
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (user) {
      try {
        const { addDoc, serverTimestamp } = await import('firebase/firestore');
        await addDoc(collection(db, 'audit_logs'), {
          actor: user.username,
          actor_id: user.id,
          action: 'logout',
          entity: 'user',
          entity_id: user.id,
          details: 'logout',
          created_at: serverTimestamp(),
        });
      } catch {}
    }
    setUser(null);
    await AsyncStorage.removeItem(SESSION_KEY);
  }, [user]);

  const changePassword = useCallback(async (oldPw: string, newPw: string) => {
    if (!user) throw new Error('غير مسجل دخول');
    if (newPw.length < 6) throw new Error('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');

    if (user.id === 'admin') {
      throw new Error('حساب admin الافتراضي لا يمكن تغيير كلمته من هنا.');
    }

    const { doc, getDoc, updateDoc } = await import('firebase/firestore');
    const userRef = doc(db, 'users', String(user.id));
    const snap = await getDoc(userRef);
    if (!snap.exists()) throw new Error('المستخدم غير موجود');

    const data = snap.data();
    const ok = await verifyPassword(oldPw, data.password_hash, data.salt);
    if (!ok) throw new Error('كلمة المرور الحالية غير صحيحة');

    const { hash, salt } = await hashPassword(newPw);
    await updateDoc(userRef, { password_hash: hash, salt });

    try {
      const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
      await addDoc(collection(db, 'audit_logs'), {
        actor: user.username,
        actor_id: user.id,
        action: 'change_password',
        entity: 'user',
        entity_id: user.id,
        created_at: serverTimestamp(),
      });
    } catch {}
  }, [user]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      ready,
      signIn,
      signOut,
      changePassword,
      isAdmin: user?.role === 'admin',
      canWithdrawDirect: user?.role === 'admin' || user?.can_withdraw_direct === 1,
      canAddTools: user?.role === 'admin' || user?.can_add_tools === 1,
      // الصلاحيات الجديدة
      withdrawLevel: user ? getPermissionLevel(user, 'withdraw') : 'none',
      additionLevel: user ? getPermissionLevel(user, 'addition') : 'none',
      canScan: user?.role === 'admin' || user?.permissions?.can_scan !== false,
      canViewReports: user?.role === 'admin' || user?.permissions?.can_view_reports !== false,
      canExport: user?.role === 'admin' || user?.permissions?.can_export !== false,
      canImport: user?.role === 'admin' || user?.permissions?.can_import === true,
      canManageCategories: user?.role === 'admin' || user?.permissions?.can_manage_categories === true,
      canManageTools: user?.role === 'admin' || user?.permissions?.can_manage_tools === true,
      canViewAudit: user?.role === 'admin' || user?.permissions?.can_view_audit === true,
    }),
    [user, loading, ready, signIn, signOut, changePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
