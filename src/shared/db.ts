import Dexie, { type Table } from 'dexie';
import type { Check, Metric, SetLog, Setting } from './types';
import type { BackupData } from './backup';

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
  const data: BackupData = { version: 2, checks, metrics, sets, settings };
  return JSON.stringify(data, null, 2);
}

function metricKey(metric: Metric): string {
  return `${metric.date}|${metric.kind}`;
}

function setKey(set: SetLog): string {
  return `${set.date}|${set.plan}|${set.exercise}|${set.setIndex}`;
}

export async function importAll(data: BackupData, mode: 'replace' | 'merge'): Promise<void> {
  await db.transaction('rw', db.checks, db.metrics, db.sets, db.settings, async () => {
    if (mode === 'replace') {
      await db.checks.clear();
      await db.metrics.clear();
      await db.sets.clear();
      await db.settings.clear();
    }

    await db.checks.bulkPut(data.checks);
    await db.settings.bulkPut(data.settings);

    const existingMetrics = await db.metrics.toArray();
    const seenMetrics = new Set(existingMetrics.map(metricKey));
    const metricsToAdd = data.metrics.filter((metric) => !seenMetrics.has(metricKey(metric)));
    if (metricsToAdd.length) await db.metrics.bulkAdd(metricsToAdd);

    const existingSets = await db.sets.toArray();
    const seenSets = new Set(existingSets.map(setKey));
    const setsToAdd = data.sets.filter((item) => !seenSets.has(setKey(item)));
    if (setsToAdd.length) await db.sets.bulkAdd(setsToAdd);
  });
}
