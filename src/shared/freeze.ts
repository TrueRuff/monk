import { format } from 'date-fns';
import { db, getSetting, setSetting } from './db';

export const FREEZE_LIMIT = 2;

export function monthKey(d: Date = new Date()): string {
  return format(d, 'yyyy-MM');
}

export async function freezesUsed(): Promise<Record<string, number>> {
  return getSetting<Record<string, number>>('freezeUsed', {});
}

export async function freezesLeft(today: Date = new Date()): Promise<number> {
  const used = await freezesUsed();
  return Math.max(0, FREEZE_LIMIT - (used[monthKey(today)] ?? 0));
}

/** Замораживает пропущенный день. Возвращает false, если бюджет кончился. */
export async function applyFreeze(date: string): Promise<boolean> {
  const left = await freezesLeft();
  if (left <= 0) return false;

  const existing = await db.checks.get(date);
  if (existing?.frozen) return false;

  await db.checks.put({
    date,
    minimum: existing?.minimum ?? false,
    full: existing?.full ?? false,
    frozen: true,
  });

  const used = await freezesUsed();
  const key = monthKey();
  used[key] = (used[key] ?? 0) + 1;
  await setSetting('freezeUsed', used);
  return true;
}

export async function undoFreeze(date: string): Promise<void> {
  const existing = await db.checks.get(date);
  if (!existing?.frozen) return;

  const used = await freezesUsed();
  const key = monthKey();
  used[key] = Math.max(0, (used[key] ?? 0) - 1);
  await setSetting('freezeUsed', used);

  if (!existing.minimum && !existing.full) {
    await db.checks.delete(date);
    return;
  }
  await db.checks.put({ ...existing, frozen: false });
}
