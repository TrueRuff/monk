import { describe, expect, it } from 'vitest';
import { activeDates, computeStreak, dateKey, lastNDays } from './streak';

const d = (iso: string) => new Date(`${iso}T12:00:00`);

describe('computeStreak', () => {
  it('пустая история даёт ноль', () => {
    expect(computeStreak(new Set(), d('2026-01-10'))).toBe(0);
  });

  it('только сегодня даёт один день', () => {
    expect(computeStreak(new Set(['2026-01-10']), d('2026-01-10'))).toBe(1);
  });

  it('сегодня ещё не закрыт — считаем до вчера', () => {
    expect(computeStreak(new Set(['2026-01-08', '2026-01-09']), d('2026-01-10'))).toBe(2);
  });

  it('пропуск вчера обнуляет стрик', () => {
    expect(computeStreak(new Set(['2026-01-07', '2026-01-08']), d('2026-01-10'))).toBe(0);
  });

  it('непрерывная серия считается целиком', () => {
    const set = new Set(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']);
    expect(computeStreak(set, d('2026-01-04'))).toBe(4);
  });

  it('замороженный день держит серию', () => {
    const checks = [
      { date: '2026-01-08', minimum: true, full: true },
      { date: '2026-01-09', minimum: false, full: false, frozen: true },
      { date: '2026-01-10', minimum: true, full: true },
    ];
    expect(computeStreak(activeDates(checks), d('2026-01-10'))).toBe(3);
  });
});

describe('activeDates', () => {
  it('берёт закрытые и замороженные дни', () => {
    const checks = [
      { date: '2026-01-01', minimum: true, full: true },
      { date: '2026-01-02', minimum: false, full: false, frozen: true },
      { date: '2026-01-03', minimum: false, full: false },
    ];
    const active = activeDates(checks);
    expect(active.has('2026-01-01')).toBe(true);
    expect(active.has('2026-01-02')).toBe(true);
    expect(active.has('2026-01-03')).toBe(false);
  });
});

describe('dateKey', () => {
  it('формат yyyy-MM-dd', () => {
    expect(dateKey(d('2026-03-05'))).toBe('2026-03-05');
  });
});

describe('lastNDays', () => {
  it('возвращает n дат по возрастанию', () => {
    const days = lastNDays(3, d('2026-01-03'));
    expect(days).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });
});
