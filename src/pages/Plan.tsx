import { useEffect, useState } from 'react';
import { getSetting, setSetting } from '../shared/db';
import {
  addFood,
  FOOD_PRESETS,
  hasFood,
  normalizeFoods,
  pickFood,
  removeFood,
  type Food,
} from '../shared/food';
import { WEEK } from '../shared/plan';
import { Toast } from '../shared/Toast';
import { Btn, Card, Label } from '../shared/ui';

const ORDER = [1, 2, 3, 4, 5, 6, 0];
const NAMES: Record<number, string> = {
  1: 'Понедельник',
  2: 'Вторник',
  3: 'Среда',
  4: 'Четверг',
  5: 'Пятница',
  6: 'Суббота',
  0: 'Воскресенье',
};

const FOODS_KEY = 'foods';

export default function Plan() {
  const today = new Date().getDay();
  const [open, setOpen] = useState<number | null>(today);
  const [foods, setFoods] = useState<Food[]>([]);
  const [draft, setDraft] = useState('');
  const [undo, setUndo] = useState<Food | null>(null);
  const [pick, setPick] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void getSetting<unknown>(FOODS_KEY, []).then((raw) => {
      setFoods(normalizeFoods(raw));
      setLoaded(true);
    });
  }, []);

  async function persist(next: Food[]) {
    setFoods(next);
    await setSetting(FOODS_KEY, next);
  }

  async function submit() {
    const next = addFood(foods, draft);
    if (next === foods) {
      if (draft.trim()) setDraft('');
      return;
    }
    setDraft('');
    setPick('');
    await persist(next);
  }

  async function addPreset(name: string) {
    const next = addFood(foods, name);
    if (next === foods) return;
    setPick('');
    await persist(next);
  }

  async function drop(food: Food) {
    const next = removeFood(foods, food.id);
    setUndo(food);
    if (pick === food.name) setPick('');
    await persist(next);
  }

  async function restore() {
    if (!undo) return;
    const next = addFood(foods, undo.name);
    setUndo(null);
    await persist(next);
  }

  const freePresets = FOOD_PRESETS.filter((name) => !hasFood(foods, name));

  return (
    <div className="screen">
      <div className="top">
        <div>
          <div className="top-date">Программа</div>
          <h1 className="h1">Неделя</h1>
        </div>
      </div>

      <Card>
        <Label>Еда без проблем</Label>
        <p className="hint" style={{ margin: '6px 0 12px' }}>
          Что можно есть спокойно и с пользой. Список под рукой — чтобы не думать заново каждый раз.
        </p>

        {loaded && foods.length ? (
          <div className="food-chips">
            {foods.map((food) => (
              <button
                key={food.id}
                type="button"
                className="food-chip"
                onClick={() => void drop(food)}
                aria-label={`Убрать ${food.name}`}
              >
                {food.name}
                <span className="food-x" aria-hidden="true">
                  ×
                </span>
              </button>
            ))}
          </div>
        ) : loaded ? (
          <p className="small muted" style={{ margin: 0 }}>
            Пока пусто. Добавь то, что уже ешь: творог, кефир, желе.
          </p>
        ) : null}

        <div className="input-row" style={{ marginTop: 12 }}>
          <input
            className="input"
            value={draft}
            placeholder="Творог, желе, кефир…"
            aria-label="Добавить еду"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void submit();
              }
            }}
          />
          <Btn variant="secondary" onClick={() => void submit()} disabled={!draft.trim()}>
            Добавить
          </Btn>
        </div>

        {freePresets.length ? (
          <div className="food-presets">
            {freePresets.map((name) => (
              <button key={name} type="button" className="food-preset" onClick={() => void addPreset(name)}>
                + {name}
              </button>
            ))}
          </div>
        ) : null}

        {foods.length ? (
          <>
            <div className="divider" />
            <div className="input-row">
              <Btn
                variant="ghost"
                onClick={() => {
                  const food = pickFood(foods);
                  setPick(food ? food.name : '');
                }}
              >
                Что съесть?
              </Btn>
              <div className="food-pick">
                {pick ? pick : `в списке: ${foods.length}`}
              </div>
            </div>
          </>
        ) : null}
      </Card>

      <p className="hint" style={{ marginTop: 16, marginBottom: 16 }}>
        Три силовых дня, один лёгкий и два кардио. Подтягивания «по чуть-чуть» — в дни без тяги.
      </p>

      {ORDER.map((day) => {
        const plan = WEEK[day];
        const isOpen = open === day;
        return (
          <Card
            key={day}
            className={`daycard card-tap ${day === today ? 'daycard-today' : ''}`}
            onClick={() => setOpen(isOpen ? null : day)}
          >
            <div className="day-head">
              <span className="day-name">{NAMES[day]}</span>
              {day === today ? <span className="label" style={{ color: 'var(--accent)' }}>сегодня</span> : null}
            </div>
            <div className="day-focus">
              {plan.title}
              {plan.minutes ? ` · ${plan.minutes} мин` : ''}
            </div>

            {isOpen ? (
              <>
                <p className="small muted" style={{ margin: '10px 0 0' }}>
                  {plan.why}
                </p>
                <div className="divider" />
                {plan.exercises.map((exercise) => (
                  <div className="row" key={exercise.name}>
                    <div className="row-main">
                      <div className="row-title">{exercise.name}</div>
                      <div className="row-sub">{exercise.cue}</div>
                    </div>
                    <div className="row-right">
                      {exercise.sets}×{exercise.reps}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="day-ex">
                {plan.exercises.slice(0, 4).map((e) => (
                  <span key={e.name} className="tag">
                    {e.name}
                  </span>
                ))}
                {plan.exercises.length > 4 ? (
                  <span className="tag">+{plan.exercises.length - 4}</span>
                ) : null}
              </div>
            )}
          </Card>
        );
      })}

      <Card>
        <Label>Правило</Label>
        <p className="small" style={{ margin: '8px 0 0', lineHeight: 1.55 }}>
          Каждую неделю добавляй один повтор или один подход. До отказа не работаем — только тест раз в две
          недели.
        </p>
      </Card>

      {undo ? (
        <Toast
          message={`Убрано: ${undo.name}`}
          actionLabel="Вернуть"
          onAction={() => void restore()}
          onClose={() => setUndo(null)}
        />
      ) : null}
    </div>
  );
}
