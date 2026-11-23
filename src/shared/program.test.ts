import { describe, expect, it } from 'vitest';
import { isDeload, isFinished, phaseFor, TOTAL_WEEKS, weekNumber } from './program';

describe('weekNumber', () => {
  it('первая неделя в день старта', () => {
    expect(weekNumber('2026-01-01', new Date('2026-01-01T12:00:00'))).toBe(1);
  });

  it('последний день недели ещё первая', () => {
    expect(weekNumber('2026-01-01', new Date('2026-01-07T12:00:00'))).toBe(1);
  });

  it('восьмой день — вторая неделя', () => {
    expect(weekNumber('2026-01-01', new Date('2026-01-08T12:00:00'))).toBe(2);
  });

  it('дата раньше старта даёт первую неделю', () => {
    expect(weekNumber('2026-01-10', new Date('2026-01-01T12:00:00'))).toBe(1);
  });

  it('битая дата не ломает расчёт', () => {
    expect(weekNumber('не дата', new Date('2026-01-01T12:00:00'))).toBe(1);
  });
});

describe('phaseFor', () => {
  it('границы фаз', () => {
    expect(phaseFor(1)?.name).toBe('База');
    expect(phaseFor(8)?.name).toBe('База');
    expect(phaseFor(9)?.name).toBe('Объём');
    expect(phaseFor(16)?.name).toBe('Объём');
    expect(phaseFor(17)?.name).toBe('Скорость');
    expect(phaseFor(22)?.name).toBe('Скорость');
    expect(phaseFor(23)?.name).toBe('Пик');
    expect(phaseFor(26)?.name).toBe('Пик');
  });

  it('за пределами цикла фазы нет', () => {
    expect(phaseFor(27)).toBeNull();
    expect(phaseFor(0)).toBeNull();
  });
});

describe('isDeload', () => {
  it('каждая пятая неделя', () => {
    expect([5, 10, 15, 20, 25].every(isDeload)).toBe(true);
  });

  it('остальные недели не разгрузочные', () => {
    expect([1, 4, 6, 9, 26].some(isDeload)).toBe(false);
  });
});

describe('isFinished', () => {
  it('после последней недели цикл закончен', () => {
    expect(isFinished(TOTAL_WEEKS)).toBe(false);
    expect(isFinished(TOTAL_WEEKS + 1)).toBe(true);
  });
});
