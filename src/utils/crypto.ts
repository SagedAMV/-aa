import * as Crypto from 'expo-crypto';

/**
 * تجزئة كلمة المرور محلياً (SHA-256 + Salt عشوائي).
 * لا تُرسل أي بيانات خارج الجهاز.
 */
export async function hashPassword(
  password: string,
  existingSalt?: string
): Promise<{ hash: string; salt: string }> {
  const salt = existingSalt ?? bytesToHex(Crypto.getRandomBytes(16));
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}::${password}`
  );
  return { hash, salt };
}

/** التحقق من كلمة المرور مقابل التجزئة المخزنة */
export async function verifyPassword(
  password: string,
  storedHash: string,
  salt: string
): Promise<boolean> {
  const { hash } = await hashPassword(password, salt);
  return timingSafeEqual(hash, storedHash);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** مقارنة ثابتة الزمن لتقليل خطر تسريب المعلومات */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
