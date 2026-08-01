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
import type { User } from '../types';

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
}

const AuthContext = createContext<AuthState | undefined>(undefined);
const SESSION_KEY = 'user_session';

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
          // Backward compatibility: handle old mock admin
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

      // Special bootstrap admin - works even if Firestore empty
      if (trimmed === 'admin' && password === 'admin123') {
        // Try to check if real admin exists in Firestore, if not keep mock but with proper shape
        try {
          const q = query(collection(db, 'users'), where('username', '==', 'admin'));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const docData = snap.docs[0].data();
            const u = snap.docs[0].id;
            // Verify against stored hash if exists
            if (docData.password_hash && docData.salt) {
              const ok = await verifyPassword(password, docData.password_hash, docData.salt);
              if (!ok) throw new Error('كلمة المرور غير صحيحة');
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
            };
            setUser(realUser);
            await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(realUser));
            return;
          }
        } catch (err) {
          // If Firestore fails, fallback to local mock
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

      if (data.is_active === 0) throw new Error('هذا الحساب معطل');

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
      };

      setUser(loggedUser);
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(loggedUser));

      // Optional: log action to audit (fire and forget)
      try {
        const { addDoc, serverTimestamp } = await import('firebase/firestore');
        await addDoc(collection(db, 'audit_logs'), {
          actor: loggedUser.username,
          action: 'login',
          entity: 'user',
          entity_id: loggedUser.id,
          details: `login`,
          created_at: serverTimestamp(),
        });
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setUser(null);
    await AsyncStorage.removeItem(SESSION_KEY);
  }, []);

  const changePassword = useCallback(async (oldPw: string, newPw: string) => {
    if (!user) throw new Error('غير مسجل دخول');
    if (newPw.length < 6) throw new Error('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');

    // Admin local mock cannot change password via this method
    if (user.id === 'admin') {
      throw new Error('حساب admin الافتراضي لا يمكن تغيير كلمته من هنا. أنشئ مستخدم admin في Firestore أولاً.');
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

    // audit
    try {
      const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
      await addDoc(collection(db, 'audit_logs'), {
        actor: user.username,
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
