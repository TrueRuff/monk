import { format, subDays } from 'date-fns';

export const dateKey = (d: Date = new Date()): string => format(d, 'yyyy-MM-dd');

/** Стрик: сегодняшний день прощается, пока не закончился. */
export function computeStreak(doneDates: Set<string>, today = new Date()): number {
  let cursor = new Date(today);
  if (!doneDates.has(dateKey(cursor))) {
    cursor = subDays(cursor, 1);
  }
  let streak = 0;
  while (doneDates.has(dateKey(cursor))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }
  return streak;
}

export function lastNDays(n: number, today = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => dateKey(subDays(today, n - 1 - i)));
}
