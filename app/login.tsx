import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Field } from '../src/components/UI';
import { useAuth } from '../src/context/AuthContext';
import { colors, font, radius, spacing } from '../src/theme';

export default function LoginScreen() {
  const { signIn, loading } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');

  const onSubmit = async () => {
    if (!username.trim() || !password) {
      Alert.alert('تنبيه', 'يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }
    try {
      await signIn(username, password);
      router.replace('/(tabs)/home');
    } catch (e) {
      Alert.alert('فشل تسجيل الدخول', (e as Error).message);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.logoWrap}>
            <Image
              source={require('../assets/icon.png')}
              style={s.logo}
              resizeMode="contain"
            />
            <Text style={s.title}>نظام إدارة مخزن الأدوات</Text>
            <Text style={s.subtitle}>
              يعمل بالكامل دون إنترنت — قاعدة بيانات محلية
            </Text>
          </View>

          <View style={s.form}>
            <Field
              label="اسم المستخدم"
              required
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              placeholder="admin"
            />
            <Field
              label="كلمة المرور"
              required
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              onSubmitEditing={onSubmit}
            />
            <Button
              title="تسجيل الدخول"
              icon="log-in-outline"
              onPress={onSubmit}
              loading={loading}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  logoWrap: { alignItems: 'center', marginBottom: spacing.xxl },
  logo: { width: 96, height: 96, borderRadius: radius.xl },
  title: {
    fontSize: font.h1,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: font.small,
    color: colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  form: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
});
