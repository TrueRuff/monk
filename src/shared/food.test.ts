import { describe, expect, it } from 'vitest';
import {
  addFood,
  cleanFoodName,
  FOOD_PRESETS,
  hasFood,
  MAX_FOODS,
  MAX_NAME_LEN,
  normalizeFoods,
  pickFood,
  removeFood,
  type Food,
} from './food';

const food = (id: string, name: string): Food => ({ id, name });

describe('cleanFoodName', () => {
  it('убирает лишние пробелы', () => {
    expect(cleanFoodName('  творог  5%  ')).toBe('творог 5%');
    expect(cleanFoodName('творог\n')).toBe('творог');
  });

  it('обрезает слишком длинное название', () => {
    expect(cleanFoodName('а'.repeat(80))).toHaveLength(MAX_NAME_LEN);
  });

  it('пустое остаётся пустым', () => {
    expect(cleanFoodName('   ')).toBe('');
  });
});

describe('normalizeFoods', () => {
  it('на мусор отвечает пустым списком', () => {
    expect(normalizeFoods(null)).toEqual([]);
    expect(normalizeFoods(42)).toEqual([]);
    expect(normalizeFoods([null, {}, 3])).toEqual([]);
  });

  it('понимает строки из старых версий', () => {
    expect(normalizeFoods(['Творог', 'Желе']).map((item) => item.name)).toEqual(['Творог', 'Желе']);
  });

  it('выбрасывает дубли без учёта регистра', () => {
    const result = normalizeFoods(['Творог', 'творог', 'Желе']);
    expect(result.map((item) => item.name)).toEqual(['Творог', 'Желе']);
  });

  it('восстанавливает id, если его нет', () => {
    const result = normalizeFoods([{ name: 'Творог' }]);
    expect(result).toHaveLength(1);
    expect(result[0].id.length).toBeGreaterThan(0);
  });
});

describe('addFood', () => {
  it('добавляет новое', () => {
    const result = addFood([], 'Творог', 1000);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Творог');
  });

  it('не добавляет пустое и дубли', () => {
    const list = [food('1', 'Творог')];
    expect(addFood(list, '   ')).toBe(list);
    expect(addFood(list, 'творог')).toBe(list);
  });

  it('не добавляет сверх лимита', () => {
    const list = Array.from({ length: MAX_FOODS }, (_, index) => food(String(index), `еда ${index}`));
    expect(addFood(list, 'Творог')).toBe(list);
  });

  it('не мутирует исходный список', () => {
    const list = [food('1', 'Творог')];
    addFood(list, 'Кефир');
    expect(list).toHaveLength(1);
  });
});

describe('removeFood / hasFood', () => {
  it('удаляет по id', () => {
    const list = [food('1', 'Творог'), food('2', 'Желе')];
    expect(removeFood(list, '1').map((item) => item.name)).toEqual(['Желе']);
  });

  it('ищет без учёта регистра', () => {
    expect(hasFood([food('1', 'Творог')], 'творог')).toBe(true);
    expect(hasFood([food('1', 'Творог')], 'кефир')).toBe(false);
  });

  it('все подсказки из пресетов распознаются', () => {
    const list = FOOD_PRESETS.map((name, index) => food(String(index), name));
    for (const name of FOOD_PRESETS) expect(hasFood(list, name)).toBe(true);
  });
});

describe('pickFood', () => {
  it('возвращает null на пустом списке', () => {
    expect(pickFood([])).toBeNull();
  });

  it('берёт элемент по индексу из генератора', () => {
    const list = [food('1', 'Творог'), food('2', 'Желе')];
    expect(pickFood(list, () => 0)?.name).toBe('Творог');
    expect(pickFood(list, () => 0.99)?.name).toBe('Желе');
    expect(pickFood(list, () => 1)?.name).toBe('Творог');
  });
});
