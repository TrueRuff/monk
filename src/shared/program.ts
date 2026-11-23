import { differenceInCalendarDays, parseISO } from 'date-fns';

export interface Phase {
  id: 1 | 2 | 3 | 4;
  name: string;
  goal: string;
  from: number;
  to: number;
}

export const TOTAL_WEEKS = 26;

export const PHASES: Phase[] = [
  {
    id: 1,
    name: 'База',
    goal: 'Техника, привычка, первые подтягивания. Вес уходит медленно и не мешает.',
    from: 1,
    to: 8,
  },
  {
    id: 2,
    name: 'Объём',
    goal: 'Больше подходов и подходов на тягу. Цель — 6–8 подтягиваний.',
    from: 9,
    to: 16,
  },
  {
    id: 3,
    name: 'Скорость',
    goal: 'Спринты, прыжки, мощь. Цель — 9–11 подтягиваний и 100 м на время.',
    from: 17,
    to: 22,
  },
  {
    id: 4,
    name: 'Пик',
    goal: 'Разгрузка, тесты, сдача нормативов. Ничего нового не добавляем.',
    from: 23,
    to: 26,
  },
];

/** Номер недели плана, начиная с 1. */
export function weekNumber(startDate: string, today: Date = new Date()): number {
  const start = parseISO(startDate);
  if (Number.isNaN(start.getTime())) return 1;
  const days = differenceInCalendarDays(today, start);
  if (days < 0) return 1;
  return Math.floor(days / 7) + 1;
}

export function phaseFor(week: number): Phase | null {
  return PHASES.find((phase) => week >= phase.from && week <= phase.to) ?? null;
}

/** Каждая пятая неделя — разгрузочная. */
export function isDeload(week: number): boolean {
  return week > 0 && week % 5 === 0;
}

export function isFinished(week: number): boolean {
  return week > TOTAL_WEEKS;
}
