import Dexie, { type Table } from 'dexie';
import type { Check, Metric, SetLog, Setting } from './types';

class MonkDB extends Dexie {
  checks!: Table<Check, string>;
  metrics!: Table<Metric, number>;
  sets!: Table<SetLog, number>;
  settings!: Table<Setting, string>;

  constructor() {
    super('monk');
    this.version(1).stores({
      checks: 'date',
      metrics: '++id, date, kind',
      sets: '++id, date, plan',
      settings: 'key',
    });
  }
}

export const db = new MonkDB();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

export async function ensureCheck(date: string): Promise<Check> {
  const found = await db.checks.get(date);
  if (found) return found;
  const fresh: Check = { date, minimum: false, full: false };
  await db.checks.put(fresh);
  return fresh;
}

export async function exportAll(): Promise<string> {
  const [checks, metrics, sets, settings] = await Promise.all([
    db.checks.toArray(),
    db.metrics.toArray(),
    db.sets.toArray(),
    db.settings.toArray(),
  ]);
  return JSON.stringify({ version: 1, checks, metrics, sets, settings }, null, 2);
}
