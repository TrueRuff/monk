import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REMINDERS,
  dayLabel,
  dueAt,
  firedKey,
  normalizeReminders,
  occurrenceOn,
  parseTime,
  timeValue,
  type Reminder,
} from './reminders';

const at = (hour: number, minute = 0, weekday: number | null = 3): Reminder => ({
  ...DEFAULT_REMINDERS[0],
  id: 'test',
  hour,
  minute,
  weekday,
});

describe('normalizeReminders', () => {
  it('возвращает настройки по умолчанию, если в базе мусор', () => {
    expect(normalizeReminders(null)).toHaveLength(DEFAULT_REMINDERS.length);
    expect(normalizeReminders('вчера')).toHaveLength(DEFAULT_REMINDERS.length);
    expect(normalizeReminders({})).toHaveLength(DEFAULT_REMINDERS.length);
  });

  it('подхватывает сохранённое время', () => {
    const result = normalizeReminders([{ id: 'morning', hour: 6, minute: 5 }]);
    const morning = result.find((item) => item.id === 'morning');
    expect(morning?.hour).toBe(6);
    expect(morning?.minute).toBe(5);
    expect(result).toHaveLength(DEFAULT_REMINDERS.length);
  });

  it('игнорирует несуществующее время и чужие id', () => {
    const result = normalizeReminders([
      { id: 'morning', hour: 25, minute: 0 },
      { id: 'ghost', hour: 10, minute: 0 },
      { id: 'a', hour: 9.5, minute: 0 },
    ]);
    const morning = result.find((item) => item.id === 'morning');
    expect(morning?.hour).toBe(DEFAULT_REMINDERS[0].hour);
    expect(result.some((item) => item.id === 'ghost')).toBe(false);
  });

  it('не меняет порядок дней недели у напоминания', () => {
    const result = normalizeReminders([{ id: 'week', hour: 19, minute: 0, weekday: 5 }]);
    expect(result.find((item) => item.id === 'week')?.weekday).toBe(0);
  });
});

describe('parseTime / timeValue', () => {
  it('понимает время с ведущим нулём и без', () => {
    expect(parseTime('07:30')).toEqual({ hour: 7, minute: 30 });
    expect(parseTime('7:05')).toEqual({ hour: 7, minute: 5 });
    expect(parseTime(' 21:00 ')).toEqual({ hour: 21, minute: 0 });
  });

  it('отбрасывает невозможное время', () => {
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('07:60')).toBeNull();
    expect(parseTime('вечер')).toBeNull();
    expect(parseTime('')).toBeNull();
  });

  it('печатает время для поля ввода', () => {
    expect(timeValue(at(7, 5))).toBe('07:05');
    expect(timeValue(at(21, 0))).toBe('21:00');
  });
});

describe('occurrenceOn', () => {
  it('срабатывает только в свой день недели', () => {
    const wednesday = new Date(2026, 10, 25, 12, 0, 0);
    expect(wednesday.getDay()).toBe(3);
    expect(occurrenceOn(at(18, 20, 3), wednesday)?.getHours()).toBe(18);
    expect(occurrenceOn(at(18, 20, 5), wednesday)).toBeNull();
  });

  it('ежедневное напоминание срабатывает каждый день', () => {
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(2026, 10, 22 + day, 9, 0, 0);
      expect(occurrenceOn(at(7, 30, null), date)).not.toBeNull();
    }
  });
});

describe('dueAt', () => {
  const window = 10 * 60 * 1000;

  it('срабатывает ровно в назначенную минуту', () => {
    const now = new Date(2026, 10, 25, 18, 20, 0);
    expect(dueAt([at(18, 20, 3)], now, window)).toHaveLength(1);
  });

  it('срабатывает с небольшим опозданием', () => {
    const now = new Date(2026, 10, 25, 18, 25, 0);
    expect(dueAt([at(18, 20, 3)], now, window)).toHaveLength(1);
  });

  it('не срабатывает заранее и с большим опозданием', () => {
    const early = new Date(2026, 10, 25, 18, 19, 0);
    const late = new Date(2026, 10, 25, 18, 40, 0);
    expect(dueAt([at(18, 20, 3)], early, window)).toHaveLength(0);
    expect(dueAt([at(18, 20, 3)], late, window)).toHaveLength(0);
  });

  it('пропускает чужие дни недели', () => {
    const now = new Date(2026, 10, 25, 18, 20, 0);
    expect(dueAt([at(18, 20, 5)], now, window)).toHaveLength(0);
  });
});

describe('firedKey', () => {
  it('различает напоминания и дни', () => {
    const day1 = new Date(2026, 10, 24, 18, 20, 0);
    const day2 = new Date(2026, 10, 25, 18, 20, 0);
    expect(firedKey(at(18, 20), day1)).not.toBe(firedKey(at(18, 20), day2));
  });
});

describe('dayLabel', () => {
  it('пишет день словами', () => {
    expect(dayLabel(null)).toBe('каждый день');
    expect(dayLabel(2)).toBe('по вт');
    expect(dayLabel(0)).toBe('по вс');
  });
});
