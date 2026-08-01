import React, { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { findToolByCode } from '../src/db/toolsRepo';
import { Button, Loader } from '../src/components/UI';
import { colors, font, radius, spacing } from '../src/theme';

/**
 * مسح الباركود / QR باستخدام كاميرا الجهاز محلياً.
 * عند العثور على الأداة يفتح صفحتها، وإلا يعرض خيار إنشاء أداة بهذا الرمز.
 */
export default function ScanScreen() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const lockRef = useRef(false);

  if (!permission) return <Loader text="جارٍ التحقق من إذن الكاميرا..." />;

  if (!permission.granted) {
    return (
      <View style={s.center}>
        <Ionicons name="camera-outline" size={64} color={colors.textLight} />
        <Text style={s.permTitle}>يلزم إذن الكاميرا</Text>
        <Text style={s.permText}>
          يستخدم التطبيق الكاميرا لمسح باركود الأدوات محلياً على الجهاز فقط.
        </Text>
        <Button
          title="السماح باستخدام الكاميرا"
          icon="camera-outline"
          onPress={requestPermission}
        />
      </View>
    );
  }

  const onScanned = async (result: BarcodeScanningResult) => {
    if (lockRef.current) return;
    lockRef.current = true;

    const code = result.data?.trim();
    if (!code) {
      lockRef.current = false;
      return;
    }

    try {
      const tool = await findToolByCode(code);

      if (tool) {
        if (returnTo === 'withdraw') {
          router.replace(`/withdraw/new?toolId=${tool.id}`);
        } else {
          router.replace(`/tool/${tool.id}`);
        }
        return;
      }

      Alert.alert(
        'رمز غير مسجّل',
        `الرمز: ${code}\nلا توجد أداة مرتبطة بهذا الرمز.`,
        [
          {
            text: 'مسح مرة أخرى',
            style: 'cancel',
            onPress: () => {
              lockRef.current = false;
            },
          },
          {
            text: 'إنشاء أداة بهذا الرمز',
            onPress: () => router.replace(`/tool/new?barcode=${encodeURIComponent(code)}`),
          },
        ]
      );
    } catch (e) {
      Alert.alert('خطأ', (e as Error).message);
      lockRef.current = false;
    }
  };

  return (
    <View style={s.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: [
            'qr',
            'ean13',
            'ean8',
            'code39',
            'code93',
            'code128',
            'upc_a',
            'upc_e',
            'itf14',
            'datamatrix',
          ],
        }}
        onBarcodeScanned={onScanned}
      />

      {/* إطار التوجيه */}
      <View style={s.overlay} pointerEvents="none">
        <View style={s.frame}>
          <View style={[s.corner, s.tl]} />
          <View style={[s.corner, s.tr]} />
          <View style={[s.corner, s.bl]} />
          <View style={[s.corner, s.br]} />
        </View>
        <Text style={s.hint}>وجّه الكاميرا نحو الباركود أو رمز QR</Text>
      </View>

      {/* أدوات التحكم */}
      <View style={s.controls}>
        <Pressable style={s.ctrlBtn} onPress={() => setTorch((t) => !t)}>
          <Ionicons
            name={torch ? 'flashlight' : 'flashlight-outline'}
            size={24}
            color={colors.white}
          />
          <Text style={s.ctrlText}>الإضاءة</Text>
        </Pressable>
        <Pressable style={s.ctrlBtn} onPress={() => router.back()}>
          <Ionicons name="close-circle-outline" size={24} color={colors.white} />
          <Text style={s.ctrlText}>إغلاق</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.bg,
  },
  permTitle: { fontSize: font.h2, fontWeight: '800', color: colors.text },
  permText: {
    fontSize: font.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 22,
  },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: { width: 250, height: 250 },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: colors.primaryLight,
  },
  tl: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  tr: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  bl: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  br: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },

  hint: {
    color: colors.white,
    fontSize: font.small,
    marginTop: spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },

  controls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  ctrlBtn: { alignItems: 'center', gap: 4 },
  ctrlText: { color: colors.white, fontSize: font.tiny },
});
