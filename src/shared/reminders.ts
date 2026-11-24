/**
 * Напоминания: чистые данные и математика «пора ли показывать».
 * Никаких обращений к API — чтобы это можно было проверить тестами.
 */

export interface Reminder {
  id: string;
  hour: number;
  minute: number;
  /** 0 — воскресенье, 6 — суббота. null — каждый день. */
  weekday: number | null;
  title: string;
  body: string;
}

export const DEFAULT_REMINDERS: Reminder[] = [
  { id: 'morning', hour: 7, minute: 30, weekday: null, title: 'Утро', body: 'Вакуум и Бадуаньцзинь, 10 минут' },
  { id: 'a', hour: 17, minute: 0, weekday: 2, title: 'Сегодня A', body: 'Тяга и ноги, 50 минут' },
  { id: 'b', hour: 18, minute: 20, weekday: 3, title: 'Сегодня B', body: 'Жим и мощь, 40 минут' },
  { id: 'cardio', hour: 16, minute: 30, weekday: 5, title: 'Кардио', body: 'Круг: бой с тенью, прыжки, бег на месте' },
  { id: 'safety', hour: 21, minute: 0, weekday: null, title: 'Страховка', body: '3 минуты: 1 подтягивание, 10 отжиманий, вакуум' },
  { id: 'week', hour: 20, minute: 0, weekday: 0, title: 'Итоги недели', body: 'Посмотри прогресс и реши, что меняем' },
];

const WEEKDAY_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export function dayLabel(weekday: number | null): string {
  return weekday === null ? 'каждый день' : `по ${WEEKDAY_SHORT[weekday] ?? '—'}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** «07:30» — в формате, который понимает <input type="time">. */
export function timeValue(reminder: Reminder): string {
  return `${pad2(reminder.hour)}:${pad2(reminder.minute)}`;
}

export function parseTime(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function validTime(hour: unknown, minute: unknown): boolean {
  return (
    typeof hour === 'number' &&
    typeof minute === 'number' &&
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  );
}

/**
 * Приводит что угодно из базы к списку из DEFAULT_REMINDERS.
 * Неизвестные id выбрасываем, время чиним, порядок не меняем:
 * так новые напоминания из обновлений появятся сами.
 */
export function normalizeReminders(raw: unknown): Reminder[] {
  const base = DEFAULT_REMINDERS.map((item) => ({ ...item }));
  if (!Array.isArray(raw)) return base;

  const stored = new Map<string, Reminder>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Partial<Reminder>;
    if (typeof row.id !== 'string') continue;
    if (!validTime(row.hour, row.minute)) continue;
    stored.set(row.id, {
      id: row.id,
      hour: row.hour as number,
      minute: row.minute as number,
      weekday:
        row.weekday === null || row.weekday === undefined
          ? null
          : typeof row.weekday === 'number' && row.weekday >= 0 && row.weekday <= 6
            ? row.weekday
            : null,
      title: typeof row.title === 'string' && row.title ? row.title : 'Напоминание',
      body: typeof row.body === 'string' ? row.body : '',
    });
  }

  return base.map((item) => {
    const saved = stored.get(item.id);
    if (!saved) return item;
    return { ...item, hour: saved.hour, minute: saved.minute };
  });
}

/** Ближайшее срабатывание в конкретный день или null, если сегодня не тот день. */
export function occurrenceOn(reminder: Reminder, day: Date): Date | null {
  if (reminder.weekday !== null && day.getDay() !== reminder.weekday) return null;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), reminder.hour, reminder.minute, 0, 0);
}

/** Что уже пора показать: время наступило и опоздание не больше окна. */
export function dueAt(reminders: Reminder[], now: Date, windowMs: number): Reminder[] {
  const out: Reminder[] = [];
  for (const reminder of reminders) {
    const at = occurrenceOn(reminder, now);
    if (!at) continue;
    const delta = now.getTime() - at.getTime();
    if (delta >= 0 && delta <= windowMs) out.push(reminder);
  }
  return out;
}

/** Ключ «это напоминание за этот день уже показано». */
export function firedKey(reminder: Reminder, at: Date): string {
  return `${reminder.id}:${at.getTime()}`;
}
