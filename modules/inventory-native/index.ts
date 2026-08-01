import { requireNativeModule, EventSubscription } from 'expo-modules-core';

/* ===== أنواع البيانات المتبادلة مع Kotlin ===== */

export interface BackupResult {
  path: string;
  uri: string;
  sizeBytes: number;
  checksum: string;
  createdAt: string;
}

export interface RestoreResult {
  restored: boolean;
  path: string;
  sizeBytes: number;
}

export interface StorageInfo {
  freeBytes: number;
  totalBytes: number;
  usedBytes: number;
  deviceModel: string;
  androidRelease: string;
}

export interface BackupProgressEvent {
  stage: 'compressing' | 'hashing' | 'done';
  percent: number;
}

interface InventoryNativeModuleType {
  readonly deviceModel: string;
  readonly androidRelease: string;
  readonly sdkInt: number;
  readonly moduleVersion: string;

  backupDatabase(dbName: string, destinationDir: string): Promise<BackupResult>;
  restoreDatabase(sourcePath: string, dbName: string): Promise<RestoreResult>;
  fileChecksum(path: string): Promise<string>;
  getStorageInfo(): StorageInfo;
  databaseSize(dbName: string): number;

  addListener(
    eventName: 'onBackupProgress',
    listener: (event: BackupProgressEvent) => void
  ): EventSubscription;
}

/**
 * جسر الاتصال مع الوحدة الأصلية المكتوبة بلغة Kotlin.
 * الاسم "InventoryNative" مطابق تماماً لـ Name(...) داخل InventoryNativeModule.kt
 */
const InventoryNative =
  requireNativeModule<InventoryNativeModuleType>('InventoryNative');

export default InventoryNative;

/** الاستماع لتقدم عملية النسخ الاحتياطي (يُرسله Kotlin عبر sendEvent) */
export function addBackupProgressListener(
  listener: (event: BackupProgressEvent) => void
): EventSubscription {
  return InventoryNative.addListener('onBackupProgress', listener);
}
