import { describe, expect, it } from 'vitest';
import { parseBackup, summarize } from './backup';

const valid = {
  version: 2,
  checks: [{ date: '2026-01-01', minimum: true, full: true }],
  metrics: [{ date: '2026-01-01', kind: 'weight', value: 88 }],
  sets: [{ date: '2026-01-01', plan: 'A', exercise: 'Подтягивания', setIndex: 0 }],
  settings: [{ key: 'theme', value: 'blue' }],
};

describe('parseBackup', () => {
  it('принимает корректный файл', () => {
    const result = parseBackup(JSON.stringify(valid));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.checks).toHaveLength(1);
  });

  it('принимает версию 1 без заморозок', () => {
    const legacy = { ...valid, version: 1, checks: [{ date: '2026-01-01', minimum: true, full: false }] };
    const result = parseBackup(JSON.stringify(legacy));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.checks[0].frozen).toBeUndefined();
  });

  it('сохраняет флаг заморозки', () => {
    const withFreeze = { ...valid, checks: [{ date: '2026-01-01', minimum: false, full: false, frozen: true }] };
    const result = parseBackup(JSON.stringify(withFreeze));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.checks[0].frozen).toBe(true);
  });

  it('отклоняет битый JSON', () => {
    const result = parseBackup('{ не json');
    expect(result.ok).toBe(false);
  });

  it('отклоняет неизвестную версию', () => {
    const result = parseBackup(JSON.stringify({ ...valid, version: 99 }));
    expect(result.ok).toBe(false);
  });

  it('отклоняет файл без таблиц', () => {
    const result = parseBackup(JSON.stringify({ version: 2, checks: [] }));
    expect(result.ok).toBe(false);
  });

  it('отклоняет запись дня без даты', () => {
    const result = parseBackup(JSON.stringify({ ...valid, checks: [{ minimum: true }] }));
    expect(result.ok).toBe(false);
  });

  it('отклоняет замер с неверным типом', () => {
    const result = parseBackup(JSON.stringify({ ...valid, metrics: [{ date: '2026-01-01', kind: 'height', value: 1 }] }));
    expect(result.ok).toBe(false);
  });
});

describe('summarize', () => {
  it('считает записи', () => {
    const parsed = parseBackup(JSON.stringify(valid));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(summarize(parsed.data)).toBe('1 дн., 1 подходов, 1 замеров');
  });
});
