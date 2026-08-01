import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import type { Tool } from '../types';

/**
 * تنبيهات محلية بالكامل (Local Notifications).
 * لا تستخدم أي خدمة Push سحابية — كل شيء يُجدول على الجهاز.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function initNotifications(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('inventory', {
      name: 'تنبيهات المخزن',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0F766E',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
}

/** إشعار فوري */
export async function notifyNow(title: string, body: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch (e) {
    console.warn('notifyNow failed', e);
  }
}

/** تنبيه الكميات المنخفضة */
export async function checkLowStockAndNotify(): Promise<number> {
  try {
    const q = query(collection(db, 'tools'), where('is_deleted', '==', false));
    const snapshot = await getDocs(q);
    const tools = snapshot.docs.map(d => d.data() as any as Tool);
    const lowStock = tools.filter(t => t.min_quantity && t.available_qty <= t.min_quantity);

    if (lowStock.length > 0) {
      await notifyNow(
        `📉 ${lowStock.length} أداة بكمية منخفضة`,
        lowStock
          .slice(0, 3)
          .map((r) => `${r.name}: ${r.available_qty}`)
          .join('، ')
      );
    }
    return lowStock.length;
  } catch (e) {
    console.warn('checkLowStock failed', e);
    return 0;
  }
}

/** تنبيه الأدوات المتأخرة (إن وجد حقل expected_return) */
export async function checkOverdueAndNotify(): Promise<number> {
  try {
    const snap = await getDocs(collection(db, 'withdrawals'));
    const now = new Date();
    let overdue = 0;
    const overdueNames: string[] = [];

    snap.docs.forEach(d => {
      const data = d.data() as any;
      if (data.status !== 'approved') return;
      if (!data.expected_return) return;
      try {
        const exp = new Date(data.expected_return);
        if (exp < now) {
          overdue++;
          if (overdueNames.length < 3) overdueNames.push(data.tool_name ?? data.tool_id);
        }
      } catch {}
    });

    if (overdue > 0) {
      await notifyNow(
        `⏰ ${overdue} أداة متأخرة في الإرجاع`,
        overdueNames.join('، ')
      );
    }
    return overdue;
  } catch (e) {
    console.warn('checkOverdue failed', e);
    return 0;
  }
}

/** جدولة تذكير إرجاع (stub - يمكن تطويره لاحقاً) */
export async function scheduleReturnReminder(toolName: string, expectedDate: string): Promise<void> {
  try {
    const exp = new Date(expectedDate);
    if (isNaN(exp.getTime())) return;
    // Simple immediate check, for now just schedule a notification at expected date if in future
    const now = new Date();
    const diffMs = exp.getTime() - now.getTime();
    if (diffMs <= 0) return;

    // For demo, we won't schedule far future, just notify now that reminder is set
    // Real implementation would use Notifications.scheduleNotificationAsync with date trigger
    // await Notifications.scheduleNotificationAsync({
    //   content: { title: 'تذكير إرجاع', body: `${toolName} موعد إرجاعه ${expectedDate}` },
    //   trigger: { date: exp },
    // });
  } catch {}
}

export async function cancelAllReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}
