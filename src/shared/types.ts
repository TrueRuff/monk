export type DayType = 'gym' | 'A' | 'B' | 'cardio' | 'light' | 'rest';

export type Tab = 'today' | 'plan' | 'progress' | 'settings';

export type MetricKind = 'weight' | 'waist' | 'pullups';

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  /** Как делать — одна точная фраза. */
  cue: string;
  /** Пошаговая техника. */
  tech: string[];
  /** Частая ошибка. */
  mistake?: string;
  /** Если тяжело. */
  easier?: string;
  /** Если легко. */
  harder?: string;
}

export interface DayPlan {
  type: DayType;
  title: string;
  focus: string;
  /** Зачем этот день и что он даёт. */
  why: string;
  minutes: number;
  exercises: Exercise[];
}

export interface Check {
  /** YYYY-MM-DD */
  date: string;
  minimum: boolean;
  full: boolean;
}

export interface Metric {
  id?: number;
  date: string;
  kind: MetricKind;
  value: number;
}

export interface SetLog {
  id?: number;
  date: string;
  plan: string;
  exercise: string;
  setIndex: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

export interface AppSettings {
  notifications: boolean;
  name: string;
}
