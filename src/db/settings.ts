import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'setting:';

export async function getSetting(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, value);
  } catch (e) {
    console.warn('setSetting failed', e);
  }
}

export async function getBoolSetting(key: string, defaultValue: boolean): Promise<boolean> {
  const v = await getSetting(key);
  if (v === null) return defaultValue;
  return v === '1' || v === 'true';
}

export async function getStringSetting(key: string, defaultValue: string): Promise<string> {
  const v = await getSetting(key);
  return v ?? defaultValue;
}
