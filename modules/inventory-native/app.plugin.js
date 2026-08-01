/**
 * Config plugin للوحدة الأصلية المحلية (Kotlin).
 * الغرض: ضمان بقاء مجلد modules/inventory-native مرتبطاً تلقائياً
 * بمشروع أندرويد عند تنفيذ: npx expo prebuild
 *
 * لا يعتمد على أي خدمة سحابية. البناء محلي بالكامل.
 */
const { withProjectBuildGradle } = require('expo/config-plugins');

const withInventoryNative = (config) => {
  return withProjectBuildGradle(config, (cfg) => {
    // علامة تحقق فقط: expo-modules-autolinking يتكفل بالربط الفعلي
    // اعتماداً على وجود ملف expo-module.config.json داخل المجلد.
    if (!cfg.modResults.contents.includes('// inventory-native-linked')) {
      cfg.modResults.contents =
        '// inventory-native-linked\n' + cfg.modResults.contents;
    }
    return cfg;
  });
};

module.exports = withInventoryNative;
