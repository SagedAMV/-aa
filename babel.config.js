module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxRuntime: 'automatic' }]],
    plugins: [
      // يجب أن يبقى هذا الإضافة الأخيرة دائماً
      'react-native-worklets/plugin',
    ],
  };
};
