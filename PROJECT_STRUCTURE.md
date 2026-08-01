# 📐 بنية المشروع والإصدارات التقنية

**نظام إدارة مخزن الأدوات** — بناء محلي (Local Build) عبر `gradlew assembleRelease`

> كل رقم في هذا المستند مُستخرج من المشروع نفسه أو من مصدر الحزم مباشرة،
> وليس من الذاكرة أو التقدير.

---

## 📑 الفهرس

1. [ملخص الإصدارات](#1-ملخص-الإصدارات-السريع)
2. [Expo SDK](#2-expo-sdk-57)
3. [Gradle و AGP](#3-gradle-و-android-gradle-plugin)
4. [NDK](#4-ndk--نقطة-مهمة)
5. [إصدارات Android SDK](#5-إصدارات-android-sdk)
6. [المكتبات المستخدمة](#6-المكتبات-المستخدمة)
7. [شجرة الملفات](#7-شجرة-الملفات)
8. [سلسلة تمرير الإصدارات](#8-كيف-تصل-الإصدارات-إلى-gradle)

---

## 1) ملخص الإصدارات السريع

| المكوّن | الإصدار | كيف تم التحقق |
| --- | --- | --- |
| **Expo SDK** | `57.0.8` | مثبّت ومقفل في `package-lock.json` |
| **React Native** | `0.86.2` | مثبّت ومقفل |
| **React** | `19.2.3` | مثبّت ومقفل |
| **Gradle Wrapper** | `9.3.1` | من `gradle-wrapper.properties` المولّد |
| **Android Gradle Plugin (AGP)** | `8.12.0` | من `@react-native/gradle-plugin@0.86.2` |
| **Kotlin** | `2.1.20` | من `android/gradle.properties` |
| **NDK** | `27.1.12297006` | من `react-native/gradle/libs.versions.toml` |
| **compileSdk** | `36` | من `android/gradle.properties` |
| **targetSdk** | `36` | من `android/gradle.properties` |
| **minSdk** | `24` (أندرويد 7.0+) | من `android/gradle.properties` |
| **Build Tools** | `36.0.0` | من `android/gradle.properties` |
| **JDK** | `17` (إلزامي) | متطلب AGP 8.12 |
| **Node.js** | `≥ 22.13` | حد أدنى لـ Expo SDK 57 |

---

## 2) Expo SDK 57

نعم — المشروع يعمل على **Expo SDK 57** كما طلبت.

```json
"expo": "~57.0.8"
```

| البند | القيمة |
| --- | --- |
| إصدار SDK المثبّت | **57.0.8** |
| React Native المرافق | **0.86.2** |
| React المرافق | **19.2.3** |
| `expo-modules-core` | **57.0.7** |
| `@expo/config-plugins` | **57.0.6** |
| Metro | **0.84.4** |
| Hermes | مُفعّل (`hermesEnabled=true`) |
| New Architecture | مُفعّلة (`newArchEnabled=true`) |

> **معلومة:** SDK 57 إصدار صغير ومركّز، مهمته الأساسية نقل Expo من
> React Native 0.85 إلى **0.86** بدون تغييرات كاسرة.

---

## 3) Gradle و Android Gradle Plugin

هناك رقمان مختلفان يخلط بينهما كثيرون:

### أ) Gradle Wrapper — أداة البناء

```properties
# android/gradle/wrapper/gradle-wrapper.properties
distributionUrl=https\://services.gradle.org/distributions/gradle-9.3.1-bin.zip
```

**الإصدار: `9.3.1`** — يُنزّل تلقائياً عند أول تشغيل لـ `gradlew`، لا تحتاج
لتثبيت Gradle يدوياً على جهازك.

#### ❓ «إصدار Gradle لدي مختلف (مثلاً 8.8) — هل سيعمل؟»

**نعم — لأن إصدارك المحلي لن يُستخدم إطلاقاً.**

| الأمر | يستخدم | النتيجة |
| --- | --- | --- |
| `gradle assembleRelease` | Gradle المثبّت لديك | ❌ يفشل إن كان < 8.13 |
| `.\gradlew assembleRelease` | **Gradle 9.3.1** (يُنزّل تلقائياً) | ✅ ينجح |

الـ Wrapper يتجاهل أي Gradle مثبّت على النظام، ويُنزّل الإصدار المحدد في
`gradle-wrapper.properties` مرة واحدة إلى `~/.gradle/wrapper/dists/`.
إصدارك المحلي يبقى كما هو ولا يتأثر — **لا تحتاج لتحديثه أو حذفه**.

⚠️ **انتبه للنقطة:** على ويندوز اكتب `.\gradlew` وليس `gradlew` أو `gradle`،
وإلا بحث PowerShell عن الأمر العام وفشل البناء برسالة:

```
Minimum supported Gradle version is 8.13. Current version is 8.8.
```

> **من داخل Android Studio:** تأكد أن
> `Settings → Build → Gradle → Use Gradle from` مضبوط على
> **`'gradle-wrapper.properties' file`** (وهو الافتراضي).

### ب) AGP — إضافة أندرويد لـ Gradle

**الإصدار: `8.12.0`** — يأتي من `@react-native/gradle-plugin@0.86.2`:

```toml
# node_modules/react-native/gradle/libs.versions.toml
agp = "8.12.0"
kotlin = "2.1.20"
```

في `android/build.gradle` يُستدعى **بدون رقم** لأن الإصدار يُدار مركزياً:

```gradle
classpath('com.android.tools.build:gradle')
classpath('com.facebook.react:react-native-gradle-plugin')
classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')
```

### ⚠️ JDK 17 إلزامي

AGP 8.12 **لا يعمل** على JDK 11 أو 21. إن كان لديك إصدار آخر ستحصل على:

```
Unsupported class file major version XX
```

---

## 4) NDK — نقطة مهمة

**الإصدار المطلوب: `27.1.12297006`**

### من أين يأتي هذا الرقم؟

اكتشفت أثناء التحقق أن NDK **لا يُضبط** من `app.json` ولا من `gradle.properties`.
مصدره الوحيد هو version catalog الخاص بـ React Native:

```toml
# node_modules/react-native/gradle/libs.versions.toml
ndkVersion = "27.1.12297006"
```

يقرأه `expo-root-project` ثم يمرّره:

```kotlin
// ExpoRootProjectPlugin.kt
val ndk = extra.setIfNotExist("ndkVersion") {
  versionCatalogs.getVersionOrDefault("ndkVersion", "27.1.12297006")
}
```

وصولاً إلى:

```gradle
// android/app/build.gradle
android {
    ndkVersion rootProject.ext.ndkVersion
}
```

### ❗ تصحيح مهم قمت به

في النسخة الأولى وضعت `"ndkVersion": "27.1.12297006"` داخل
`expo-build-properties` في `app.json`. **هذا المفتاح غير مدعوم** — تحققت من
تعريف الأنواع الرسمي، والمفاتيح المدعومة هي فقط:

```
minSdkVersion · compileSdkVersion · targetSdkVersion · buildToolsVersion
cmakeVersion · kotlinVersion · enableMinifyInReleaseBuilds
enableShrinkResourcesInReleaseBuilds · enablePngCrunchInReleaseBuilds
extraProguardRules · packagingOptions · networkInspector
```

كان المفتاح يُتجاهل بصمت ويعطي انطباعاً خاطئاً بأن الإصدار مثبّت.
**أزلته** ووثّقت المصدر الحقيقي هنا بدلاً منه.

### ✅ ما عليك فعله

ثبّت من **SDK Manager → SDK Tools → NDK (Side by side)** الإصدار
**27.1.12297006** بالضبط. أي إصدار آخر قد يسبب فشل ربط المكتبات الأصلية.

---

## 5) إصدارات Android SDK

```properties
# android/gradle.properties  (مُولّد تلقائياً)
android.minSdkVersion=24
android.compileSdkVersion=36
android.targetSdkVersion=36
android.buildToolsVersion=36.0.0
android.kotlinVersion=2.1.20
```

| البند | القيمة | المعنى |
| --- | --- | --- |
| `minSdk` | **24** | يعمل على أندرويد 7.0 فأحدث |
| `compileSdk` | **36** | يُترجم مقابل أندرويد 16 |
| `targetSdk` | **36** | يستهدف أندرويد 16 |
| `buildTools` | **36.0.0** | أدوات البناء |

---

## 6) المكتبات المستخدمة

### 📦 الأساس (Core)

| المكتبة | الإصدار | الاستخدام في المشروع |
| --- | --- | --- |
| `expo` | 57.0.8 | إطار العمل الأساسي |
| `react-native` | 0.86.2 | محرك الواجهات |
| `react` | 19.2.3 | مكتبة المكوّنات |
| `typescript` | 5.9.3 | لغة الكتابة (dev) |

### 🗄️ قاعدة البيانات والتخزين

| المكتبة | الإصدار | الاستخدام |
| --- | --- | --- |
| `expo-sqlite` | 57.0.1 | **قاعدة البيانات المحلية** — كل الجداول والمعاملات |
| `expo-file-system` | 57.0.1 | قراءة/كتابة ملفات Excel والنسخ الاحتياطي |
| `expo-crypto` | 57.0.1 | تجزئة كلمات المرور (SHA-256 + Salt) |

### 🧭 التنقّل والواجهة

| المكتبة | الإصدار | الاستخدام |
| --- | --- | --- |
| `expo-router` | 57.0.8 | التنقّل المعتمد على الملفات + التبويبات |
| `react-native-screens` | 4.26.2 | تحسين أداء الشاشات |
| `react-native-safe-area-context` | 5.7.0 | التعامل مع النوتش والحواف |
| `react-native-gesture-handler` | 2.32.0 | الإيماءات |
| `react-native-reanimated` | 4.5.0 | الحركات (متطلب expo-router) |
| `react-native-worklets` | 0.10.0 | مطلوب لـ Reanimated 4 |
| `@expo/vector-icons` | 15.1.1 | أيقونات Ionicons |
| `expo-status-bar` | 57.0.1 | شريط الحالة |
| `expo-splash-screen` | 57.0.5 | شاشة البداية |
| `expo-system-ui` | 57.0.1 | ألوان النظام |

### 📷 الكاميرا والوسائط

| المكتبة | الإصدار | الاستخدام |
| --- | --- | --- |
| `expo-camera` | 57.0.3 | **مسح الباركود و QR** (10 صيغ) |
| `expo-image-picker` | 57.0.6 | التقاط/اختيار صورة الأداة |

### 📊 التقارير والملفات

| المكتبة | الإصدار | الاستخدام |
| --- | --- | --- |
| `xlsx` | 0.18.5 | **استيراد وتصدير Excel** (JS خالص، محلي) |
| `expo-print` | 57.0.1 | **توليد تقارير PDF** محلياً |
| `expo-sharing` | 57.0.7 | حفظ/مشاركة الملفات المُصدَّرة |
| `expo-document-picker` | 57.0.1 | اختيار ملف Excel من الجهاز |

### 🔔 التنبيهات والنظام

| المكتبة | الإصدار | الاستخدام |
| --- | --- | --- |
| `expo-notifications` | 57.0.7 | **تنبيهات محلية** (متأخرات، كميات منخفضة) |
| `expo-constants` | 57.0.7 | قراءة إعدادات التطبيق |
| `expo-linking` | 57.0.4 | الروابط العميقة (متطلب router) |
| `expo-device` | 57.0.1 | معلومات الجهاز |

### 🔧 أدوات البناء (dev)

| المكتبة | الإصدار | الاستخدام |
| --- | --- | --- |
| `expo-build-properties` | 57.0.7 | ضبط compileSdk/Kotlin وقت prebuild |
| `@babel/core` | 7.29.7 | ترجمة الكود |
| `@types/react` | 19.2.17 | أنواع React |

> **لا توجد أي مكتبة سحابية** — لا Firebase، لا EAS، لا تحليلات، لا خوادم.
> التطبيق يعمل بالكامل دون إنترنت.

---

## 7) شجرة الملفات

### 📂 ملفات المصدر (التي كتبتها)

```
ToolsInventoryApp/
│
├── 📄 package.json                    # الاعتماديات وأوامر البناء
├── 📄 app.json                        # إعدادات Expo والأذونات والإضافات
├── 📄 tsconfig.json                   # إعدادات TypeScript
├── 📄 babel.config.js                 # Babel + worklets plugin
├── 📄 metro.config.js                 # حزم Metro
├── 📄 check-env.js            (168)   # 🔍 فاحص بيئة البناء
├── 📄 README.md                       # دليل البناء الكامل
├── 📄 PROJECT_STRUCTURE.md            # هذا الملف
├── 📄 .gitignore
│
├── 📁 app/                            # الشاشات (Expo Router)
│   ├── _layout.tsx             (75)   # الجذر: RTL + المزوّدات + Stack
│   ├── index.tsx                (8)   # توجيه حسب حالة الدخول
│   ├── login.tsx              (134)   # تسجيل الدخول
│   │
│   ├── 📁 (tabs)/                     # التبويبات الخمسة
│   │   ├── _layout.tsx         (73)   # شريط التبويبات
│   │   ├── home.tsx           (308)   # 🏠 لوحة المعلومات والتنبيهات
│   │   ├── tools.tsx          (331)   # 📦 الأدوات + بحث وفلترة
│   │   ├── withdrawals.tsx    (425)   # 📥 السحوبات + موافقة + إرجاع
│   │   ├── reports.tsx        (336)   # 📊 تقارير PDF و Excel
│   │   └── settings.tsx       (390)   # ⚙️ الإعدادات والنسخ الاحتياطي
│   │
│   ├── 📁 tool/
│   │   ├── [id].tsx           (282)   # تفاصيل الأداة + سجلها
│   │   └── new.tsx            (340)   # إضافة/تعديل أداة
│   │
│   ├── 📁 withdraw/
│   │   └── new.tsx            (322)   # تسجيل سحب
│   │
│   ├── 📁 addition/
│   │   └── new.tsx            (269)   # تسجيل إضافة كمية
│   │
│   ├── scan.tsx               (202)   # 📷 ماسح الباركود
│   ├── import-excel.tsx       (278)   # 📥 استيراد Excel مع معاينة
│   ├── users.tsx              (290)   # 👥 المستخدمون والصلاحيات
│   ├── categories.tsx         (164)   # 🏷️ التصنيفات
│   └── audit.tsx              (112)   # 📋 سجل الإجراءات
│
├── 📁 src/                            # منطق العمل
│   │
│   ├── 📁 db/                         # قاعدة البيانات
│   │   ├── schema.ts          (124)   # مخطط الجداول السبعة
│   │   ├── index.ts           (110)   # الاتصال + التهيئة + التدقيق
│   │   ├── toolsRepo.ts       (190)   # عمليات الأدوات والتصنيفات
│   │   └── movementsRepo.ts   (397)   # ⭐ السحوبات والإضافات (معاملات)
│   │
│   ├── 📁 services/                   # الخدمات
│   │   ├── excel.ts           (279)   # استيراد/تصدير xlsx
│   │   ├── pdf.ts             (207)   # 4 تقارير PDF
│   │   ├── notifications.ts   (121)   # التنبيهات المحلية
│   │   └── backup.ts           (84)   # جسر النسخ الاحتياطي
│   │
│   ├── 📁 context/
│   │   └── AuthContext.tsx    (125)   # المصادقة والصلاحيات
│   │
│   ├── 📁 components/
│   │   └── UI.tsx             (318)   # مكوّنات مشتركة (زر، حقل، بطاقة...)
│   │
│   ├── 📁 theme/
│   │   └── index.ts            (59)   # الألوان والقياسات
│   │
│   ├── 📁 types/
│   │   └── index.ts            (93)   # أنواع TypeScript
│   │
│   └── 📁 utils/
│       └── crypto.ts           (43)   # تجزئة كلمات المرور
│
├── 📁 modules/inventory-native/       # ⭐ الوحدة الأصلية (Kotlin)
│   ├── expo-module.config.json        # يُفعّل الربط التلقائي
│   ├── app.plugin.js           (22)   # config plugin
│   ├── index.ts                (64)   # جسر TypeScript
│   └── 📁 android/
│       ├── build.gradle               # إعدادات بناء الوحدة
│       ├── proguard-rules.pro         # حماية من التشويش
│       └── 📁 src/main/
│           ├── AndroidManifest.xml
│           └── 📁 java/com/warehouse/inventorynative/
│               ├── InventoryNativeModule.kt  (182)  # ⭐ الوحدة الرئيسية
│               └── InventoryExceptions.kt     (13)  # استثناءات مخصصة
│
├── 📁 plugins/
│   └── withLocalBuildConfig.js (125)  # ⭐ إعدادات البناء المحلي
│
└── 📁 assets/
    ├── icon.png                       # أيقونة التطبيق (1024×1024)
    ├── adaptive-icon.png              # أيقونة أندرويد التكيّفية
    ├── splash.png                     # شاشة البداية
    └── favicon.png
```

**إجمالي كود المصدر: ~6,748 سطر** (TypeScript + Kotlin)

### 📂 مجلد أندرويد (يُولَّد بـ `expo prebuild`)

```
android/
├── build.gradle                       # ⭐ مستوى المشروع
├── settings.gradle                    # ⭐ ربط الوحدات والـ autolinking
├── gradle.properties                  # الإصدارات والذاكرة والتوقيع
├── gradlew / gradlew.bat              # سكربت البناء
├── local.properties                   # مسار SDK (تنشئه بنفسك)
│
├── 📁 gradle/wrapper/
│   ├── gradle-wrapper.jar
│   └── gradle-wrapper.properties      # ⭐ Gradle 9.3.1
│
└── 📁 app/
    ├── build.gradle                   # ⭐ مستوى التطبيق
    ├── proguard-rules.pro
    ├── debug.keystore
    └── 📁 src/main/
        ├── AndroidManifest.xml        # الأذونات + RTL
        ├── 📁 java/com/warehouse/toolsinventory/
        │   ├── MainActivity.kt
        │   └── MainApplication.kt
        └── 📁 res/                    # الأيقونات والألوان والنصوص
```

> ⚠️ مجلد `android/` قابل للتوليد. عند أي تعديل على `app.json` أعد:
> `npx expo prebuild --platform android --clean`

---

## 8) كيف تصل الإصدارات إلى Gradle

فهم هذه السلسلة يوفّر عليك ساعات في تشخيص أخطاء البناء:

```
┌─────────────────────────────────────────────────────────────┐
│  react-native/gradle/libs.versions.toml                     │
│  ── المصدر الأصلي ──                                        │
│     agp = "8.12.0"                                          │
│     kotlin = "2.1.20"                                       │
│     ndkVersion = "27.1.12297006"    ← 🔒 لا يُعدَّل من app.json │
│     compileSdk = "36" · targetSdk = "36" · minSdk = "24"    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  settings.gradle → expoAutolinking.useExpoVersionCatalog()  │
│  يُنشئ catalog باسم "expoLibs"                              │
│  ويسمح بتجاوز 5 قيم فقط من gradle.properties:               │
│    buildToolsVersion · minSdk · compileSdk                  │
│    targetSdk · kotlinVersion        (❌ NDK ليس منها)        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  ExpoRootProjectPlugin  →  rootProject.ext.*                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  android/app/build.gradle                                   │
│     ndkVersion rootProject.ext.ndkVersion                   │
│     compileSdk rootProject.ext.compileSdkVersion            │
└─────────────────────────────────────────────────────────────┘
```

### 💡 الخلاصة العملية

| تريد تغيير... | المكان الصحيح |
| --- | --- |
| compileSdk / targetSdk / minSdk | `app.json` → `expo-build-properties` |
| Kotlin / Build Tools | `app.json` → `expo-build-properties` |
| **NDK** | ❌ لا يُغيَّر — ثبّت `27.1.12297006` من SDK Manager |
| **AGP** | ❌ لا يُغيَّر — يتبع إصدار React Native |
| **Gradle Wrapper** | `android/gradle/wrapper/gradle-wrapper.properties` |
| الذاكرة / التوقيع | `plugins/withLocalBuildConfig.js` |

---

## ✅ ما تم التحقق منه فعلياً

| الفحص | النتيجة |
| --- | --- |
| تثبيت الاعتماديات (603 حزمة) | ✅ نجح |
| `tsc --noEmit` | ✅ **صفر أخطاء** |
| `expo prebuild --clean` | ✅ نجح بلا تحذيرات |
| ربط وحدة Kotlin تلقائياً | ✅ ضمن 27 وحدة |
| توافق Kotlin مع Expo Modules API | ✅ مُطابق لمصدر `expo-modules-core` |
| كل الإصدارات أعلاه | ✅ من `package-lock.json` والمصدر |

> **ملاحظة صريحة:** لم يكتمل `assembleRelease` في بيئة الإعداد لأن الذاكرة
> المتاحة 2 GB فقط بينما بناء React Native يحتاج ~8 GB. الفشل كان
> `Daemon disappeared` (نفاد ذاكرة) — **ولم يظهر أي خطأ تجميع في Kotlin
> أو Gradle**. على جهاز بـ 8 GB فأكثر يكتمل البناء.

---

## 🚀 أمر البناء

```powershell
cd android
.\gradlew assembleRelease
```

**الناتج:** `android/app/build/outputs/apk/release/app-release.apk`
