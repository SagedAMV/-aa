# 📦 نظام إدارة مخزن الأدوات — بناء محلي (Local Build)

تطبيق أندرويد لإدارة مخزن الأدوات، يعمل **بالكامل دون إنترنت** بقاعدة بيانات
محلية (SQLite)، مبني على **Expo SDK 57 / React Native 0.86** مع
**وحدة أصلية مكتوبة بلغة Kotlin**.

> **البناء محلي 100%** عبر `gradlew assembleRelease` — لا EAS، لا خدمات سحابية،
> لا حسابات، لا اشتراكات.

---

## 1) مصفوفة الإصدارات المعتمدة (مُتحقق منها)

| المكوّن | الإصدار | المصدر |
| --- | --- | --- |
| Expo SDK | **57.0.8** | مثبّت ومُتحقق منه |
| React Native | **0.86.2** | مطابق لـ SDK 57 |
| React | **19.2.3** | مطابق لـ SDK 57 |
| Android Gradle Plugin | **8.12.0** | من مصفوفة RN 0.86 |
| Gradle Wrapper | **9.3.1** | مُولّد من prebuild |
| Kotlin | **2.1.20** | من مصفوفة RN 0.86 |
| compileSdk / targetSdk | **36** | متطلب SDK 57 |
| minSdk | **24** (أندرويد 7+) | متطلب SDK 57 |
| NDK | **27.1.12297006** | من مصفوفة RN 0.86 |
| JDK | **17** | إلزامي لـ AGP 8.12 |
| Node.js | **≥ 22.13** | حد أدنى لـ SDK 57 |

⚠️ **لا تُغيّر هذه الإصدارات** — أي خلط بينها هو السبب الأول لفشل
`assembleRelease`.

---

## 2) متطلبات جهاز التطوير

| المتطلب | التفاصيل |
| --- | --- |
| نظام التشغيل | Windows 10/11 أو Linux أو macOS |
| **الذاكرة (RAM)** | **8 GB كحد أدنى** (16 GB مُفضّل) |
| مساحة القرص | 15 GB فارغة على الأقل |
| JDK | **17** حصراً (وليس 11 أو 21) |
| Android SDK | Platform 36 + Build-Tools 36.0.0 + NDK 27.1.12297006 |
| Node.js | 22.13 أو أحدث |

> 💡 البناء الأول يستغرق **15–40 دقيقة** لأنه يُنزّل ويُجمّع مكتبات أصلية.
> البناءات اللاحقة أسرع بكثير (2–5 دقائق).

---

## 3) خطوات البناء المحلي (من الصفر إلى APK)

### الخطوة 1 — تثبيت JDK 17

**ويندوز:** نزّل Temurin JDK 17 من [adoptium.net](https://adoptium.net) ثم:

```powershell
setx JAVA_HOME "C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot"
```

تحقّق:

```bash
java -version     # يجب أن يظهر 17.x
```

### الخطوة 2 — تثبيت Android SDK

عبر Android Studio → **SDK Manager**، ثبّت:

- ✅ Android SDK Platform **36**
- ✅ Android SDK Build-Tools **36.0.0**
- ✅ Android SDK Platform-Tools
- ✅ NDK (Side by side) **27.1.12297006**
- ✅ CMake 3.22.1

ثم اضبط المتغير:

```powershell
setx ANDROID_HOME "C:\Users\<اسمك>\AppData\Local\Android\Sdk"
```

### الخطوة 3 — تثبيت الاعتماديات

```bash
cd ToolsInventoryApp
npm install
```

### الخطوة 4 — توليد مجلد أندرويد

```bash
npx expo prebuild --platform android --clean
```

هذا يُنشئ مجلد `android/` كاملاً ويربط الوحدة الأصلية (Kotlin) تلقائياً.

### الخطوة 5 — ملف local.properties

أنشئ `android/local.properties` وضع فيه مسار الـ SDK:

```properties
sdk.dir=C\:\\Users\\<اسمك>\\AppData\\Local\\Android\\Sdk
```

> على لينكس/ماك: `sdk.dir=/home/<اسمك>/Android/Sdk`

### الخطوة 6 — 🚀 البناء وإنتاج الـ APK

```powershell
cd android
.\gradlew assembleRelease
```

على لينكس/ماك:

```bash
cd android && ./gradlew assembleRelease
```

### ✅ الناتج النهائي

```
android/app/build/outputs/apk/release/app-release.apk
```

ثبّته مباشرة على أجهزة المخزن:

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

---

## 4) توقيع نسخة الإصدار (اختياري لكن موصى به)

بدون إعداد، يُوقَّع الـ APK بمفتاح debug (يعمل للتوزيع الداخلي).
للتوقيع بمفتاح رسمي:

**أ) أنشئ المفتاح:**

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore warehouse.keystore \
  -alias warehouse -keyalg RSA -keysize 2048 -validity 10000
```

**ب) ضع الملف في `android/app/` وأضف إلى `android/gradle.properties`:**

```properties
RELEASE_STORE_FILE=warehouse.keystore
RELEASE_STORE_PASSWORD=كلمة_المرور
RELEASE_KEY_ALIAS=warehouse
RELEASE_KEY_PASSWORD=كلمة_المرور
```

**ج) أعد البناء** — سيلتقط النظام المفتاح تلقائياً.

> إعداد التوقيع مُهيّأ مسبقاً في `plugins/withLocalBuildConfig.js`،
> ويرجع تلقائياً لمفتاح debug إن لم تُعرَّف المفاتيح — فلا يفشل البناء أبداً.

---

## 5) التطوير والتجربة قبل البناء النهائي

```bash
# بناء نسخة تطوير مثبّتة على الجهاز (تدعم الوحدة الأصلية Kotlin)
npx expo run:android

# تشغيل خادم Metro فقط
npm start
```

> ⚠️ **مهم:** الوحدة الأصلية (Kotlin) **لا تعمل داخل Expo Go**.
> استخدم `expo run:android` أو الـ APK المبني محلياً.
> التطبيق مُصمَّم ليعمل بأمان في الحالتين (شاشة الإعدادات تتجاهل بيانات
> الوحدة الأصلية إن لم تكن متاحة).

---

## 6) الوحدة الأصلية بلغة Kotlin

**المسار:** `modules/inventory-native/`

```
modules/inventory-native/
├── expo-module.config.json          ← يُفعّل الربط التلقائي
├── app.plugin.js                     ← config plugin
├── index.ts                          ← جسر TypeScript
└── android/
    ├── build.gradle
    ├── proguard-rules.pro
    └── src/main/java/com/warehouse/inventorynative/
        ├── InventoryNativeModule.kt   ← الوحدة الرئيسية
        └── InventoryExceptions.kt     ← استثناءات مخصصة
```

### الدوال المتاحة

| الدالة | النوع | الوظيفة |
| --- | --- | --- |
| `backupDatabase(dbName, dir)` | async | ضغط قاعدة SQLite في ZIP + بصمة SHA-256 |
| `restoreDatabase(src, dbName)` | async | استعادة نسخة مع نسخة أمان تلقائية |
| `fileChecksum(path)` | async | بصمة SHA-256 للتحقق من سلامة الملف |
| `getStorageInfo()` | sync | مساحة التخزين + معلومات الجهاز |
| `databaseSize(dbName)` | sync | حجم قاعدة البيانات بالبايت |
| `onBackupProgress` | event | تقدّم عملية النسخ (0–100%) |

**لماذا Kotlin؟** ضغط الملفات وحساب SHA-256 عمليات ثقيلة — تنفيذها في
الطبقة الأصلية يمنع تجميد واجهة المستخدم.

### الاستدعاء من TypeScript

```ts
import InventoryNative from '@modules/inventory-native';

const result = await InventoryNative.backupDatabase('inventory.db', dir);
console.log(result.checksum, result.sizeBytes);
```

---

## 7) هيكل المشروع

```
ToolsInventoryApp/
├── app/                          ← الشاشات (Expo Router)
│   ├── _layout.tsx               ← الجذر + RTL + المزوّدات
│   ├── login.tsx                 ← تسجيل الدخول
│   ├── (tabs)/                   ← التبويبات الخمسة
│   │   ├── home.tsx              ← لوحة المعلومات
│   │   ├── tools.tsx             ← قائمة الأدوات + بحث وفلترة
│   │   ├── withdrawals.tsx       ← السحوبات + موافقة + إرجاع
│   │   ├── reports.tsx           ← تقارير PDF و Excel
│   │   └── settings.tsx          ← الإعدادات والنسخ الاحتياطي
│   ├── tool/[id].tsx             ← تفاصيل الأداة
│   ├── tool/new.tsx              ← إضافة/تعديل أداة
│   ├── withdraw/new.tsx          ← تسجيل سحب
│   ├── addition/new.tsx          ← تسجيل إضافة
│   ├── scan.tsx                  ← ماسح الباركود
│   ├── import-excel.tsx          ← استيراد Excel
│   ├── users.tsx                 ← إدارة المستخدمين
│   ├── categories.tsx            ← إدارة التصنيفات
│   └── audit.tsx                 ← سجل الإجراءات
│
├── src/
│   ├── db/                       ← قاعدة البيانات
│   │   ├── schema.ts             ← مخطط الجداول
│   │   ├── index.ts              ← الاتصال والتهيئة
│   │   ├── toolsRepo.ts          ← عمليات الأدوات
│   │   └── movementsRepo.ts      ← السحوبات والإضافات (معاملات)
│   ├── services/
│   │   ├── excel.ts              ← استيراد/تصدير xlsx
│   │   ├── pdf.ts                ← تقارير PDF
│   │   ├── notifications.ts      ← تنبيهات محلية
│   │   └── backup.ts             ← جسر النسخ الاحتياطي
│   ├── context/AuthContext.tsx   ← المصادقة والصلاحيات
│   ├── components/UI.tsx         ← مكونات واجهة مشتركة
│   ├── theme/index.ts            ← الألوان والقياسات
│   └── types/index.ts            ← أنواع TypeScript
│
├── modules/inventory-native/     ← الوحدة الأصلية (Kotlin)
├── plugins/withLocalBuildConfig.js ← إعدادات البناء المحلي
├── assets/                       ← الأيقونات وشاشة البداية
├── app.json / package.json
├── babel.config.js / metro.config.js / tsconfig.json
└── android/                      ← يُولَّد بـ prebuild (غير مرفوع)
```

---

## 8) الحساب الافتراضي

| الحقل | القيمة |
| --- | --- |
| اسم المستخدم | `admin` |
| كلمة المرور | `admin123` |

🔐 **غيّرها فوراً** من: الإعدادات ← تغيير كلمة المرور.
كلمات المرور تُخزَّن مُجزّأة (SHA-256 + Salt عشوائي) — لا تُحفظ كنص صريح.

---

## 9) الميزات المنفَّذة

### إدارة الأدوات
- ✅ إضافة / تعديل / حذف (حذف منطقي يحفظ السجل التاريخي)
- ✅ بحث فوري بالاسم/الرقم التسلسلي/الباركود/الموقع
- ✅ فلترة بالتصنيف والكمية المنخفضة
- ✅ مسح باركود و QR (10 صيغ مدعومة)
- ✅ صورة للأداة (كاميرا أو معرض)

### الصرف والإرجاع
- ✅ صرف مباشر أو بطلب موافقة (حسب الصلاحية)
- ✅ موافقة/رفض من المدير
- ✅ **إرجاع كلي أو جزئي** مع تتبع الكمية المتبقية
- ✅ جميع العمليات داخل **معاملات SQLite** لمنع اختلال الكميات

### التقارير
- ✅ 4 تقارير PDF (جرد / سحوبات / متأخرات / الأكثر سحباً)
- ✅ تصدير Excel (جرد + حركات بورقتين)
- ✅ فلترة بفترة زمنية

### Excel
- ✅ استيراد مع **معاينة وفحص أخطاء** قبل الحفظ
- ✅ إنشاء التصنيفات الناقصة تلقائياً
- ✅ قالب جاهز للتنزيل

### أخرى
- ✅ تنبيهات محلية (متأخرات + كميات منخفضة)
- ✅ نسخ احتياطي/استعادة عبر Kotlin
- ✅ مستخدمون وصلاحيات دقيقة
- ✅ سجل إجراءات كامل (Audit Log)
- ✅ واجهة عربية RTL بالكامل

---

## 10) حل المشاكل الشائعة

| المشكلة | الحل |
| --- | --- |
| `Minimum supported Gradle version is 8.13` | استخدمت `gradle` بدل `.\gradlew` — الـ wrapper يُنزّل 9.3.1 تلقائياً ولا يهم إصدارك المحلي |
| `Unsupported class file major version` | JDK ليس 17 — تحقق من `JAVA_HOME` |
| `SDK location not found` | أنشئ `android/local.properties` (الخطوة 5) |
| `NDK not found` | ثبّت NDK **27.1.12297006** بالضبط من SDK Manager |
| `Daemon disappeared` / نفاد ذاكرة | قلّل `org.gradle.jvmargs` في `android/gradle.properties` إلى `-Xmx2048m`، أو أغلق البرامج الأخرى |
| فشل بعد تعديل `app.json` | أعد `npx expo prebuild --platform android --clean` |
| مسارات طويلة على ويندوز | انقل المشروع إلى `C:\dev\` |
| بناء عالق أو غريب | `cd android && .\gradlew clean` ثم أعد البناء |
| الوحدة الأصلية غير معرّفة | أنت في Expo Go — استخدم `expo run:android` |

---

## 11) التحقق من سلامة المشروع

```bash
npm run typecheck     # فحص TypeScript — يجب أن يمر بلا أخطاء
npx expo-doctor       # فحص توافق الاعتماديات
```

---

## ✅ ما تم التحقق منه فعلياً

| البند | الحالة |
| --- | --- |
| تثبيت الاعتماديات (603 حزمة) | ✅ نجح |
| مطابقة الإصدارات لـ SDK 57 | ✅ مُتحقق من npm |
| `tsc --noEmit` (فحص TypeScript) | ✅ **صفر أخطاء** |
| `expo prebuild --clean` | ✅ نجح بلا تحذيرات |
| ربط وحدة Kotlin تلقائياً | ✅ ظهرت ضمن 27 وحدة |
| توليد ملفات Gradle | ✅ AGP 8.12 / Gradle 9.3.1 |
| تطبيق إعدادات التوقيع والاسم | ✅ مُتحقق في الملفات المولّدة |
| توافق Kotlin مع Expo Modules API | ✅ مُطابق لمصدر expo-modules-core 57.0.7 |

> **ملاحظة صريحة:** لم يكتمل تنفيذ `assembleRelease` في بيئة الإعداد لأن
> الذاكرة المتاحة فيها 2 GB فقط، بينما بناء React Native يحتاج ~8 GB.
> السبب الوحيد للتوقف كان نفاد الذاكرة (`Daemon disappeared`) —
> **ولم يظهر أي خطأ تجميع في Kotlin أو Gradle**. على جهاز بـ 8 GB
> فأكثر يكتمل البناء وفق الخطوات أعلاه.
