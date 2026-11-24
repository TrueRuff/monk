import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { getSetting, setSetting } from './db';
import {
  DEFAULT_REMINDERS,
  dueAt,
  firedKey,
  normalizeReminders,
  occurrenceOn,
  type Reminder,
} from './reminders';

const DAYS_AHEAD = 21;
const idFloor = 1000;
const TEST_ID = 999;
const FIRED_KEY = 'monk.remindersFired';
/** Опоздание, при котором напоминание ещё показываем. */
const MATCH_WINDOW_MS = 10 * 60 * 1000;
const TICK_MS = 20_000;
const PERIODIC_TAG = 'monk-reminders';

export const isNative = (): boolean => Capacitor.isNativePlatform();

export type WebPermission = 'unsupported' | 'default' | 'granted' | 'denied';

export function webPermission(): WebPermission {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as WebPermission;
}

// ---------------------------------------------------------------- хранение

export async function loadReminders(): Promise<Reminder[]> {
  return normalizeReminders(await getSetting<unknown>('reminders', DEFAULT_REMINDERS));
}

export async function saveReminders(list: Reminder[]): Promise<void> {
  await setSetting('reminders', normalizeReminders(list));
  if (isNative()) {
    await scheduleAll();
    return;
  }
  await syncServiceWorkerSchedule();
}

// ------------------------------------------------------------- разрешения

export async function requestPermission(): Promise<boolean> {
  if (!isNative()) return requestWebPermission();
  const result = await LocalNotifications.requestPermissions();
  return result.display === 'granted';
}

export async function requestWebPermission(): Promise<boolean> {
  if (webPermission() === 'granted') return true;
  if (webPermission() === 'unsupported') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ native

export async function clearAll(): Promise<void> {
  if (!isNative()) return;
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter((n) => n.id >= idFloor || n.id === TEST_ID);
  if (ours.length) {
    await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  }
}

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
  for (const reminder of await loadReminders()) {
    for (const date of nextOccurrences(reminder.hour, reminder.minute, reminder.weekday)) {
      heads.push({
        id: id++,
        title: reminder.title,
        body: reminder.body,
        schedule: { at: date, allowWhileIdle: true },
      });
    }
  }
  if (heads.length) {
    await LocalNotifications.schedule({ notifications: heads });
  }
}

// --------------------------------------------------------------------- web

type NotifyStats = { count: number; title: string; delivered: boolean };

function markFiredWeb(title: string, delivered: boolean): void {
  const scope = window as unknown as { __monkNotify?: NotifyStats };
  const prev = scope.__monkNotify;
  scope.__monkNotify = { count: (prev?.count ?? 0) + 1, title, delivered };
}

async function fireWeb(title: string, body: string, tag: string): Promise<void> {
  const icon = `${import.meta.env.BASE_URL}icon.svg`;
  const options: NotificationOptions = { body, tag, icon, badge: icon };
  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration) {
      await registration.showNotification(title, options);
      markFiredWeb(title, true);
      return;
    }
  } catch {
    /* ниже попробуем напрямую */
  }
  try {
    new Notification(title, options);
    markFiredWeb(title, true);
  } catch {
    markFiredWeb(title, false);
  }
}

function readFired(): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FIRED_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, number>;
  } catch {
    return {};
  }
}

function writeFired(map: Record<string, number>): void {
  const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const pruned: Record<string, number> = {};
  for (const [key, value] of Object.entries(map)) {
    if (typeof value === 'number' && value > cutoff) pruned[key] = value;
  }
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(pruned));
  } catch {
    /* переполнено — переживём */
  }
}

/** Один проход: проверить, что наступило, и показать. Возвращает показанные. */
export async function runReminderTick(now = new Date()): Promise<Reminder[]> {
  if (isNative()) return [];
  if (webPermission() !== 'granted') return [];

  const reminders = await loadReminders();
  const fired = readFired();
  const shown: Reminder[] = [];

  for (const reminder of dueAt(reminders, now, MATCH_WINDOW_MS)) {
    const at = occurrenceOn(reminder, now);
    if (!at) continue;
    const key = firedKey(reminder, at);
    if (fired[key]) continue;
    await fireWeb(reminder.title, reminder.body, `monk-${reminder.id}`);
    fired[key] = Date.now();
    shown.push(reminder);
  }

  if (shown.length) writeFired(fired);
  return shown;
}

/**
 * Тикающий планировщик. Работает, пока сайт открыт — в том числе свёрнутый.
 * Возвращает функцию остановки.
 */
export function startWebReminders(): () => void {
  if (isNative()) return () => {};
  const tick = () => {
    void runReminderTick().catch(() => {});
  };
  tick();
  const timer = window.setInterval(tick, TICK_MS);
  const onVisible = () => {
    if (document.visibilityState === 'visible') tick();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

/**
 * Отдаём расписание service worker'у: он может показать напоминание,
 * когда приложение установлено и закрыто (Periodic Background Sync).
 */
export async function syncServiceWorkerSchedule(): Promise<void> {
  if (isNative()) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const reminders = await loadReminders();
    registration.active?.postMessage({ type: 'monk-schedule', reminders, fired: readFired() });
    const periodic = (registration as unknown as {
      periodicSync?: { register: (tag: string, options: { minInterval: number }) => Promise<void> };
    }).periodicSync;
    if (periodic) {
      await periodic.register(PERIODIC_TAG, { minInterval: 12 * 60 * 60 * 1000 });
    }
  } catch {
    /* нет поддержки — обойдёмся открытым приложением */
  }
}

// --------------------------------------------------------------- проверка

/** Показывает тестовое уведомление прямо сейчас. */
export async function testNotification(): Promise<boolean> {
  const granted = await requestPermission();
  if (!granted) return false;

  if (isNative()) {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: TEST_ID,
          title: 'Проверка',
          body: 'Напоминания работают. Это тест.',
          schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true },
        },
      ],
    });
    return true;
  }

  await fireWeb('Проверка', 'Напоминания работают. Это тест.', 'monk-test');
  return true;
}
