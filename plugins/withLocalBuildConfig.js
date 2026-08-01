/**
 * Config Plugin — تهيئة البناء المحلي (Local Build)
 * ---------------------------------------------------
 * يعالج ثلاث نقاط حرجة تضمن نجاح: .\gradlew assembleRelease
 *
 * 1) اسم المشروع بالإنجليزية داخل settings.gradle
 *    (الاسم العربي يسبب فشل Gradle على ويندوز بسبب الترميز)،
 *    مع إبقاء الاسم العربي ظاهراً للمستخدم في strings.xml.
 *
 * 2) إعداد توقيع release حقيقي يقرأ مفاتيحه من gradle.properties،
 *    ويرجع تلقائياً لمفتاح debug إن لم تُعرَّف — حتى لا يفشل البناء أبداً.
 *
 * 3) ضبط خصائص Gradle اللازمة (الذاكرة، AndroidX، Hermes).
 */

const {
  withAppBuildGradle,
  withSettingsGradle,
  withStringsXml,
  withGradleProperties,
} = require('expo/config-plugins');

/** اسم المشروع بالإنجليزية لتفادي مشاكل الترميز في Gradle */
const SAFE_PROJECT_NAME = 'ToolsInventory';
/** الاسم الظاهر للمستخدم على شاشة الهاتف */
const DISPLAY_NAME = 'مخزن الأدوات';

const withSafeProjectName = (config) =>
  withSettingsGradle(config, (cfg) => {
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /rootProject\.name\s*=\s*['"].*?['"]/,
      `rootProject.name = '${SAFE_PROJECT_NAME}'`
    );
    return cfg;
  });

const withArabicAppName = (config) =>
  withStringsXml(config, (cfg) => {
    const strings = cfg.modResults.resources.string ?? [];
    const entry = strings.find((s) => s.$.name === 'app_name');
    if (entry) {
      entry._ = DISPLAY_NAME;
    } else {
      strings.push({ $: { name: 'app_name' }, _: DISPLAY_NAME });
    }
    cfg.modResults.resources.string = strings;
    return cfg;
  });

const withReleaseSigning = (config) =>
  withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    // (أ) إضافة signingConfig خاص بالإصدار
    if (!contents.includes('RELEASE_STORE_FILE')) {
      contents = contents.replace(
        /signingConfigs\s*\{\s*\n(\s*)debug\s*\{/,
        `signingConfigs {
        // توقيع الإصدار — يُقرأ من android/gradle.properties أو من سطر الأوامر
        release {
            if (project.hasProperty('RELEASE_STORE_FILE')) {
                storeFile file(project.property('RELEASE_STORE_FILE'))
                storePassword project.property('RELEASE_STORE_PASSWORD')
                keyAlias project.property('RELEASE_KEY_ALIAS')
                keyPassword project.property('RELEASE_KEY_PASSWORD')
            }
        }
$1debug {`
      );
    }

    // (ب) استخدام مفتاح الإصدار إن وُجد، وإلا مفتاح debug (حتى لا يفشل البناء)
    contents = contents.replace(
      /\/\/ see https:\/\/reactnative\.dev\/docs\/signed-apk-android\.\s*\n\s*signingConfig signingConfigs\.debug/,
      `// see https://reactnative.dev/docs/signed-apk-android.
            signingConfig project.hasProperty('RELEASE_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`
    );

    cfg.modResults.contents = contents;
    return cfg;
  });

const withBuildProperties = (config) =>
  withGradleProperties(config, (cfg) => {
    const set = (key, value) => {
      const existing = cfg.modResults.find(
        (i) => i.type === 'property' && i.key === key
      );
      if (existing) existing.value = value;
      else cfg.modResults.push({ type: 'property', key, value });
    };

    // ملاحظة حول NDK:
    // إصدار NDK لا يُضبط عبر gradle.properties ولا عبر expo-build-properties.
    // مصدره الوحيد هو version catalog الخاص بـ React Native:
    //   node_modules/react-native/gradle/libs.versions.toml  →  ndkVersion = "27.1.12297006"
    // ويقرأه expo-root-project ثم يمرّره إلى android/app/build.gradle
    // عبر: ndkVersion rootProject.ext.ndkVersion
    // لذلك يجب تثبيت NDK 27.1.12297006 من SDK Manager دون محاولة تغييره هنا.

    // ========== إصلاح خطأ SoftwareComponent 'release' في Expo SDK 57 + AGP 8.12 + Gradle 9 ==========
    // هذا الخطأ يظهر كـ: "SoftwareComponent with name 'release' not found" في مشروع ':expo'
    set('android.disableAutomaticComponentCreation', 'true');
    set('android.nonTransitiveRClass', 'false');
    set('android.suppressUnsupportedCompileSdk', '36');

    // ذاكرة كافية لعملية التجميع و R8 محلياً
    set(
      'org.gradle.jvmargs',
      '-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8'
    );
    set('org.gradle.parallel', 'true');
    set('org.gradle.caching', 'true');
    set('android.useAndroidX', 'true');
    set('android.enableJetifier', 'false');
    set('hermesEnabled', 'true');
    set('newArchEnabled', 'true');
    // تفعيل تصغير الحجم في نسخة الإصدار
    set('android.enableMinifyInReleaseBuilds', 'true');
    set('android.enableShrinkResourcesInReleaseBuilds', 'true');

    return cfg;
  });

module.exports = function withLocalBuildConfig(config) {
  config = withSafeProjectName(config);
  config = withArabicAppName(config);
  config = withReleaseSigning(config);
  config = withBuildProperties(config);
  return config;
};
