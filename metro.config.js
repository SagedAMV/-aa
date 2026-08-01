// Metro config محلي — بدون أي اعتماد على خدمات سحابية
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// دعم قراءة ملفات Excel/القوالب المرفقة داخل الحزمة إن لزم
config.resolver.assetExts.push('xlsx', 'db', 'sqlite');

module.exports = config;
