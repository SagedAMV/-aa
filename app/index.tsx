import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

/** نقطة الدخول: توجيه حسب حالة تسجيل الدخول */
export default function Index() {
  const { user } = useAuth();
  return <Redirect href={user ? '/(tabs)/home' : '/login'} />;
}
