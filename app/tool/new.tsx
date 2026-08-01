import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  createTool,
  getTool,
  listCategories,
  updateTool,
} from '../../src/db/toolsRepo';
import { useAuth } from '../../src/context/AuthContext';
import { Button, Field, Loader } from '../../src/components/UI';
import { colors, font, radius, spacing } from '../../src/theme';
import type { Category } from '../../src/types';

/** شاشة إضافة/تعديل أداة — تُستخدم للحالتين عبر باراميتر editId */
export default function ToolFormScreen() {
  const { editId, barcode } = useLocalSearchParams<{
    editId?: string;
    barcode?: string;
  }>();
  const { user, canAddTools } = useAuth();
  const isEdit = !!editId;

  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [serial, setSerial] = useState('');
  const [code, setCode] = useState(barcode ?? '');
  const [catId, setCatId] = useState<string | null>(null);
  const [desc, setDesc] = useState('');
  const [location, setLocation] = useState('');
  const [qty, setQty] = useState('1');
  const [minQty, setMinQty] = useState('0');
  const [notes, setNotes] = useState('');
  const [image, setImage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const c = await listCategories();
    setCats(c);
    if (isEdit && editId) {
      const t = await getTool(String(editId));
      if (t) {
        setName(t.name);
        setSerial(t.serial_number ?? '');
        setCode(t.barcode ?? '');
        setCatId(t.category_id ? String(t.category_id) : null);
        setDesc(t.description ?? '');
        setLocation(t.location ?? '');
        setQty(String(t.total_quantity));
        setMinQty(String(t.min_quantity));
        setNotes(t.notes ?? '');
        setImage(t.image_uri);
      }
      setLoading(false);
    }
  }, [editId, isEdit]);

  useEffect(() => {
    load();
  }, [load]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('تنبيه', 'يلزم إذن الوصول للصور');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: true,
    });
    if (!res.canceled && res.assets?.length) setImage(res.assets[0].uri);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('تنبيه', 'يلزم إذن الكاميرا');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.6,
      allowsEditing: true,
    });
    if (!res.canceled && res.assets?.length) setImage(res.assets[0].uri);
  };

  const onSave = async () => {
    if (!canAddTools) {
      Alert.alert('غير مصرّح', 'ليس لديك صلاحية إضافة أو تعديل الأدوات');
      return;
    }
    if (!name.trim()) {
      Alert.alert('تنبيه', 'اسم الأداة مطلوب');
      return;
    }
    const q = parseInt(qty, 10);
    if (!Number.isFinite(q) || q < 0) {
      Alert.alert('تنبيه', 'الكمية غير صالحة');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        serial_number: serial.trim() || null,
        barcode: code.trim() || null,
        category_id: catId,
        description: desc.trim() || null,
        location: location.trim() || null,
        total_quantity: q,
        min_quantity: parseInt(minQty, 10) || 0,
        image_uri: image,
        notes: notes.trim() || null,
      };

      if (isEdit && editId) {
        await updateTool(String(editId), payload as any, user?.username ?? 'system');
        Alert.alert('تم', 'تم تحديث الأداة بنجاح', [
          { text: 'حسناً', onPress: () => router.back() },
        ]);
      } else {
        await createTool(payload as any, user?.username ?? 'system');
        Alert.alert('تم', 'تمت إضافة الأداة بنجاح', [
          { text: 'حسناً', onPress: () => router.back() },
        ]);
      }
    } catch (e: any) {
      Alert.alert('خطأ', e.message ?? 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader text="جارٍ تحميل..." />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* الصورة */}
      <View style={s.imageSection}>
        {image ? (
          <Image source={{ uri: image }} style={s.image} />
        ) : (
          <View style={[s.image, s.imagePlaceholder]}>
            <Ionicons name="image-outline" size={34} color={colors.textLight} />
          </View>
        )}
        <View style={{ gap: 8, flex: 1 }}>
          <Button
            title="التقاط صورة"
            icon="camera-outline"
            variant="outline"
            onPress={takePhoto}
          />
          <Button
            title="اختيار من المعرض"
            icon="images-outline"
            variant="outline"
            onPress={pickImage}
          />
          {image && (
            <Button
              title="إزالة الصورة"
              variant="ghost"
              onPress={() => setImage(null)}
            />
          )}
        </View>
      </View>

      <Field
        label="اسم الأداة"
        required
        value={name}
        onChangeText={setName}
        placeholder="مثال: مفك براغي كهربائي"
      />

      <Field
        label="الرقم التسلسلي"
        value={serial}
        onChangeText={setSerial}
        placeholder="SN-0001"
      />

      <View style={{ flexDirection: 'row-reverse', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Field
            label="الباركود / QR"
            value={code}
            onChangeText={setCode}
            placeholder="امسح أو اكتب"
          />
        </View>
        <Pressable
          style={s.scanBtn}
          onPress={() => router.push('/scan?returnTo=form' as any)}
        >
          <Ionicons name="qr-code-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {/* التصنيف */}
      <Text style={s.label}>التصنيف</Text>
      <View style={s.catWrap}>
        {cats.map((c) => (
          <Pressable
            key={String(c.id)}
            onPress={() => setCatId(catId === String(c.id) ? null : String(c.id))}
            style={[
              s.catChip,
              catId === String(c.id) && { backgroundColor: c.color, borderColor: c.color },
            ]}
          >
            <Text
              style={[s.catText, catId === String(c.id) && { color: colors.white }]}
            >
              {c.name}
            </Text>
          </Pressable>
        ))}
        {cats.length === 0 && <Text style={s.noCat}>لا توجد تصنيفات - أضف من الإعدادات</Text>}
      </View>

      <Field
        label="الموقع في المخزن"
        value={location}
        onChangeText={setLocation}
        placeholder="مثال: رف A1 / صندوق 3"
      />

      <View style={{ flexDirection: 'row-reverse', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Field
            label="الكمية الإجمالية"
            required
            value={qty}
            onChangeText={setQty}
            keyboardType="number-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="حد التنبيه"
            value={minQty}
            onChangeText={setMinQty}
            keyboardType="number-pad"
            hint="تنبيه عند الوصول لهذا الحد"
          />
        </View>
      </View>

      <Field
        label="الوصف"
        value={desc}
        onChangeText={setDesc}
        multiline
        placeholder="وصف مختصر للأداة"
      />

      <Field
        label="ملاحظات"
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="أي ملاحظات إضافية"
      />

      <Button
        title={isEdit ? 'حفظ التعديلات' : 'إضافة الأداة'}
        icon="save-outline"
        onPress={onSave}
        loading={saving}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  imageSection: {
    flexDirection: 'row-reverse',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  image: { width: 110, height: 110, borderRadius: radius.md, backgroundColor: colors.border },
  imagePlaceholder: {
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    textAlign: 'right',
  },
  catWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.lg,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  catText: { fontSize: font.tiny, fontWeight: '700', color: colors.textMuted },
  noCat: { fontSize: font.tiny, color: colors.textMuted },
  scanBtn: {
    width: 50,
    height: 48,
    marginTop: 24,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
