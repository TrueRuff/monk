import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';

const DAYS_AHEAD = 21;
const idFloor = 1000;

export const isNative = (): boolean => Capacitor.isNativePlatform();

export async function requestPermission(): Promise<boolean> {
  if (!isNative()) return false;
  const result = await LocalNotifications.requestPermissions();
  return result.display === 'granted';
}

export async function clearAll(): Promise<void> {
  if (!isNative()) return;
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter((n) => n.id >= idFloor);
  if (ours.length) {
    await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  }
}

interface Reminder {
  hour: number;
  minute: number;
  /** 0 — воскресенье. null — каждый день. */
  weekday: number | null;
  title: string;
  body: string;
}

const REMINDERS: Reminder[] = [
  { hour: 7, minute: 30, weekday: null, title: 'Утро', body: 'Вакуум и Бадуаньцзинь, 10 минут' },
  { hour: 17, minute: 0, weekday: 2, title: 'Сегодня A', body: 'Тяга и ноги, 50 минут' },
  { hour: 18, minute: 20, weekday: 3, title: 'Сегодня B', body: 'Жим и мощь, 40 минут' },
  { hour: 16, minute: 30, weekday: 5, title: 'Кардио', body: 'Круг: бой с тенью, прыжки, бег на месте' },
  { hour: 21, minute: 0, weekday: null, title: 'Страховка', body: '3 минуты: 1 подтягивание, 10 отжиманий, вакуум' },
  { hour: 20, minute: 0, weekday: 0, title: 'Итоги недели', body: 'Посмотри прогресс и реши, что меняем' },
];

function nextOccurrences(hour: number, minute: number, weekday: number | null): Date[] {
  const out: Date[] = [];
  const start = new Date();
  start.setHours(hour, minute, 0, 0);
  for (let i = 0; i <= DAYS_AHEAD + 7; i += 1) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    if (d.getTime() <= Date.now()) continue;
    if (weekday !== null && d.getDay() !== weekday) continue;
    out.push(d);
  }
  return out;
}

export async function scheduleAll(): Promise<void> {
  if (!isNative()) return;
  await clearAll();
  const granted = await requestPermission();
  if (!granted) return;

  const heads: LocalNotificationSchema[] = [];
  let id = idFloor;
  for (const r of REMINDERS) {
    for (const date of nextOccurrences(r.hour, r.minute, r.weekday)) {
      heads.push({
        id: id++,
        title: r.title,
        body: r.body,
        schedule: { at: date, allowWhileIdle: true },
      });
    }
  }
  if (heads.length) {
    await LocalNotifications.schedule({ notifications: heads });
  }
}
