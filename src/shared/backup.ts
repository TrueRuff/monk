import type { Check, Metric, MetricKind, SetLog, Setting } from './types';

export interface BackupData {
  version: number;
  checks: Check[];
  metrics: Metric[];
  sets: SetLog[];
  settings: Setting[];
}

export type ParseResult = { ok: true; data: BackupData } | { ok: false; error: string };

const MAX_BYTES = 5 * 1024 * 1024;
const METRIC_KINDS: MetricKind[] = ['weight', 'waist', 'pullups'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseBackup(text: string): ParseResult {
  if (text.length > MAX_BYTES) {
    return { ok: false, error: 'Файл слишком большой (больше 5 МБ)' };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Это не JSON — файл повреждён или выбран не тот' };
  }

  if (!isRecord(raw)) {
    return { ok: false, error: 'В файле ожидался объект с данными' };
  }

  const version = raw.version;
  if (typeof version !== 'number' || version < 1 || version > 2) {
    return { ok: false, error: 'Неизвестная версия бэкапа' };
  }

  const { checks, metrics, sets, settings } = raw;
  if (
    !Array.isArray(checks) ||
    !Array.isArray(metrics) ||
    !Array.isArray(sets) ||
    !Array.isArray(settings)
  ) {
    return { ok: false, error: 'В файле не хватает таблиц: checks, metrics, sets, settings' };
  }

  const validChecks: Check[] = [];
  for (const item of checks) {
    if (!isRecord(item) || typeof item.date !== 'string') {
      return { ok: false, error: 'В таблице дней есть запись без даты' };
    }
    validChecks.push({
      date: item.date,
      minimum: Boolean(item.minimum),
      full: Boolean(item.full),
      ...(item.frozen ? { frozen: true } : {}),
    });
  }

  const validMetrics: Metric[] = [];
  for (const item of metrics) {
    if (
      !isRecord(item) ||
      typeof item.date !== 'string' ||
      typeof item.value !== 'number' ||
      !METRIC_KINDS.includes(item.kind as MetricKind)
    ) {
      return { ok: false, error: 'В замерах есть запись с неверным типом или значением' };
    }
    validMetrics.push({ date: item.date, kind: item.kind as MetricKind, value: item.value });
  }

  const validSets: SetLog[] = [];
  for (const item of sets) {
    if (!isRecord(item) || typeof item.date !== 'string' || typeof item.exercise !== 'string') {
      return { ok: false, error: 'В подходах есть запись без даты или упражнения' };
    }
    validSets.push({
      date: item.date,
      plan: String(item.plan ?? ''),
      exercise: item.exercise,
      setIndex: Number(item.setIndex ?? 0),
    });
  }

  const validSettings: Setting[] = [];
  for (const item of settings) {
    if (!isRecord(item) || typeof item.key !== 'string') {
      return { ok: false, error: 'В настройках есть запись без ключа' };
    }
    validSettings.push({ key: item.key, value: item.value });
  }

  return {
    ok: true,
    data: {
      version,
      checks: validChecks,
      metrics: validMetrics,
      sets: validSets,
      settings: validSettings,
    },
  };
}

export function summarize(data: BackupData): string {
  const days = data.checks.length;
  const sets = data.sets.length;
  const metrics = data.metrics.length;
  return `${days} дн., ${sets} подходов, ${metrics} замеров`;
}
