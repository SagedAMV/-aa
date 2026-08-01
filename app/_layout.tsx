import React, { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { initNotifications } from '../src/services/notifications';
import { Loader } from '../src/components/UI';
import { colors } from '../src/theme';

// دعم اتجاه الواجهة من اليمين لليسار
try {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
} catch {
  // بعض الأجهزة قد تمنع التبديل أثناء التشغيل
}

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { ready } = useAuth();

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
      initNotifications().catch(() => {});
    }
  }, [ready]);

  if (!ready) return <Loader text="جارٍ تهيئة قاعدة البيانات المحلية..." />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '800' },
        headerTitleAlign: 'center',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="tool/[id]"
        options={{ title: 'تفاصيل الأداة', presentation: 'card' }}
      />
      <Stack.Screen name="tool/new" options={{ title: 'إضافة أداة جديدة' }} />
      <Stack.Screen name="scan" options={{ title: 'مسح الباركود' }} />
      <Stack.Screen name="withdraw/new" options={{ title: 'تسجيل سحب' }} />
      <Stack.Screen name="addition/new" options={{ title: 'تسجيل إضافة' }} />
      <Stack.Screen name="import-excel" options={{ title: 'استيراد من Excel' }} />
      <Stack.Screen name="users" options={{ title: 'إدارة المستخدمين' }} />
      <Stack.Screen name="categories" options={{ title: 'إدارة التصنيفات' }} />
      <Stack.Screen name="audit" options={{ title: 'سجل الإجراءات' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
