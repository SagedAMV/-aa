#!/usr/bin/env node
/**
 * فاحص بيئة البناء المحلي
 * التشغيل:  node check-env.js
 *
 * يتحقق من كل متطلبات البناء عبر gradlew assembleRelease
 * ويخبرك بالضبط ما ينقص قبل أن تضيّع وقتاً في بناء فاشل.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', B = '\x1b[1m', X = '\x1b[0m';
let errors = 0, warnings = 0;

const ok = (m) => console.log(`  ${G}✔${X} ${m}`);
const bad = (m, fix) => {
  console.log(`  ${R}✘${X} ${m}`);
  if (fix) console.log(`     ${Y}→ ${fix}${X}`);
  errors++;
};
const warn = (m, fix) => {
  console.log(`  ${Y}!${X} ${m}`);
  if (fix) console.log(`     ${Y}→ ${fix}${X}`);
  warnings++;
};

const sh = (cmd) => {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  } catch {
    return null;
  }
};

console.log(`\n${B}═══ فحص بيئة البناء المحلي (Local Build) ═══${X}\n`);

/* ---------- 1) Node.js ---------- */
console.log(`${B}[1] Node.js${X}`);
const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
const nodeMinor = parseInt(process.versions.node.split('.')[1], 10);
if (nodeMajor > 22 || (nodeMajor === 22 && nodeMinor >= 13)) {
  ok(`Node ${process.versions.node}`);
} else {
  bad(
    `Node ${process.versions.node} — Expo SDK 57 يتطلب 22.13 أو أحدث`,
    'حدّث من nodejs.org'
  );
}

/* ---------- 2) JDK 17 ---------- */
console.log(`\n${B}[2] JDK${X}`);
const javaOut = sh('java -version 2>&1');
if (!javaOut) {
  bad('Java غير مثبّت', 'ثبّت Temurin JDK 17 من adoptium.net');
} else {
  const m = javaOut.match(/version "(\d+)/);
  const v = m ? parseInt(m[1], 10) : 0;
  if (v === 17) ok(`JDK ${v}`);
  else
    bad(
      `JDK ${v} — مطلوب 17 بالضبط (AGP 8.12 لا يدعم غيره)`,
      'ثبّت JDK 17 واضبط JAVA_HOME عليه'
    );
}
if (process.env.JAVA_HOME) ok(`JAVA_HOME = ${process.env.JAVA_HOME}`);
else warn('JAVA_HOME غير مضبوط', 'اضبطه على مجلد JDK 17');

/* ---------- 3) Android SDK ---------- */
console.log(`\n${B}[3] Android SDK${X}`);
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk) {
  bad('ANDROID_HOME غير مضبوط', 'اضبطه على مجلد Android SDK');
} else if (!fs.existsSync(sdk)) {
  bad(`المسار غير موجود: ${sdk}`);
} else {
  ok(`ANDROID_HOME = ${sdk}`);

  const plat36 = path.join(sdk, 'platforms', 'android-36');
  fs.existsSync(plat36)
    ? ok('Platform android-36')
    : bad('Platform 36 غير مثبّت', 'SDK Manager → Android SDK Platform 36');

  const bt = path.join(sdk, 'build-tools', '36.0.0');
  fs.existsSync(bt)
    ? ok('Build-Tools 36.0.0')
    : bad('Build-Tools 36.0.0 غير مثبّت', 'SDK Manager → Build-Tools 36.0.0');

  const ndk = path.join(sdk, 'ndk', '27.1.12297006');
  fs.existsSync(ndk)
    ? ok('NDK 27.1.12297006')
    : warn(
        'NDK 27.1.12297006 غير موجود',
        'SDK Manager → NDK (Side by side) → 27.1.12297006'
      );
}

/* ---------- 4) ملفات المشروع ---------- */
console.log(`\n${B}[4] ملفات المشروع${X}`);
[
  'package.json',
  'app.json',
  'babel.config.js',
  'metro.config.js',
  'tsconfig.json',
  'modules/inventory-native/expo-module.config.json',
  'modules/inventory-native/android/src/main/java/com/warehouse/inventorynative/InventoryNativeModule.kt',
  'plugins/withLocalBuildConfig.js',
].forEach((f) =>
  fs.existsSync(path.join(__dirname, f)) ? ok(f) : bad(`مفقود: ${f}`)
);

fs.existsSync(path.join(__dirname, 'node_modules'))
  ? ok('node_modules')
  : bad('الاعتماديات غير مثبّتة', 'شغّل: npm install');

/* ---------- 5) مجلد أندرويد ---------- */
console.log(`\n${B}[5] مجلد أندرويد${X}`);
const andr = path.join(__dirname, 'android');
if (!fs.existsSync(andr)) {
  warn(
    'مجلد android غير موجود',
    'شغّل: npx expo prebuild --platform android --clean'
  );
} else {
  ok('مجلد android موجود');

  // إصدار Gradle Wrapper (وليس Gradle المثبّت على النظام)
  const wrapProps = path.join(andr, 'gradle', 'wrapper', 'gradle-wrapper.properties');
  if (fs.existsSync(wrapProps)) {
    const m = fs
      .readFileSync(wrapProps, 'utf8')
      .match(/gradle-([\d.]+)-(?:bin|all)\.zip/);
    if (m) ok(`Gradle Wrapper ${m[1]} (يُنزّل تلقائياً — إصدارك المحلي لا يهم)`);
  }
  const gw = path.join(andr, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
  fs.existsSync(gw)
    ? ok(`سكربت البناء: ${path.basename(gw)}`)
    : bad('سكربت gradlew مفقود', 'أعد: npx expo prebuild --platform android --clean');

  const lp = path.join(andr, 'local.properties');
  if (fs.existsSync(lp)) ok('local.properties');
  else
    bad(
      'local.properties مفقود',
      `أنشئه وضع فيه: sdk.dir=${(sdk || '/path/to/Sdk').replace(/\\/g, '\\\\')}`
    );
}

/* ---------- 6) الذاكرة ---------- */
console.log(`\n${B}[6] موارد الجهاز${X}`);
const gb = os.totalmem() / 1024 ** 3;
if (gb >= 8) ok(`الذاكرة: ${gb.toFixed(1)} GB`);
else if (gb >= 4)
  warn(
    `الذاكرة: ${gb.toFixed(1)} GB — قد يبطؤ البناء`,
    'قلّل org.gradle.jvmargs إلى -Xmx2048m'
  );
else
  bad(
    `الذاكرة: ${gb.toFixed(1)} GB — غير كافية`,
    'بناء React Native يحتاج 8 GB'
  );
ok(`المعالجات: ${os.cpus().length}`);

/* ---------- النتيجة ---------- */
console.log(`\n${B}═══════════════════════════════${X}`);
if (errors === 0 && warnings === 0) {
  console.log(`${G}${B}✅ البيئة جاهزة تماماً!${X}`);
  console.log(`\nنفّذ الآن:\n  ${B}cd android${X}`);
  console.log(
    `  ${B}${process.platform === 'win32' ? '.\\gradlew assembleRelease' : './gradlew assembleRelease'}${X}\n`
  );
} else if (errors === 0) {
  console.log(`${Y}${B}⚠ جاهز مع ${warnings} تنبيه${X}\n`);
} else {
  console.log(`${R}${B}✘ ${errors} خطأ${X}${warnings ? ` و ${warnings} تنبيه` : ''}`);
  console.log(`${Y}عالج الأخطاء أعلاه ثم أعد الفحص.${X}\n`);
  process.exit(1);
}
