/**
 * Микрозаметки «что можно есть спокойно» — чистые данные, без базы.
 */

export interface Food {
  id: string;
  name: string;
}

export const MAX_FOODS = 60;
export const MAX_NAME_LEN = 40;

/** Кнопки-подсказки, чтобы не печатать базовое руками. */
export const FOOD_PRESETS = ['Творог', 'Кефир', 'Желе', 'Яйца', 'Овсянка', 'Гречка'];

export function cleanFoodName(input: string): string {
  return input.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LEN);
}

export function normalizeFoods(raw: unknown): Food[] {
  if (!Array.isArray(raw)) return [];
  const out: Food[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    let name = '';
    let id = '';
    if (typeof item === 'string') {
      name = cleanFoodName(item);
    } else if (item && typeof item === 'object') {
      const row = item as Partial<Food>;
      name = typeof row.name === 'string' ? cleanFoodName(row.name) : '';
      id = typeof row.id === 'string' ? row.id : '';
    }
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: id || `food-${out.length}-${key}`, name });
    if (out.length >= MAX_FOODS) break;
  }
  return out;
}

export function addFood(list: Food[], input: string, now = Date.now()): Food[] {
  const name = cleanFoodName(input);
  if (!name) return list;
  if (list.length >= MAX_FOODS) return list;
  const key = name.toLowerCase();
  if (list.some((item) => item.name.toLowerCase() === key)) return list;
  return [...list, { id: `${now}-${Math.random().toString(36).slice(2, 7)}`, name }];
}

export function removeFood(list: Food[], id: string): Food[] {
  return list.filter((item) => item.id !== id);
}

export function hasFood(list: Food[], name: string): boolean {
  const key = cleanFoodName(name).toLowerCase();
  return list.some((item) => item.name.toLowerCase() === key);
}

/** Случайный вариант из списка — когда стоишь перед холодильником. */
export function pickFood(list: Food[], random = Math.random): Food | null {
  if (!list.length) return null;
  const index = Math.floor(random() * list.length) % list.length;
  return list[index];
}
