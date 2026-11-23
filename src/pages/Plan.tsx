import { useState } from 'react';
import { WEEK } from '../shared/plan';
import { Card, Label } from '../shared/ui';

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

export default function Plan() {
  const today = new Date().getDay();
  const [open, setOpen] = useState<number | null>(today);

  return (
    <div className="screen">
      <div className="top">
        <div>
          <div className="top-date">Программа</div>
          <h1 className="h1">Неделя</h1>
        </div>
      </div>

      <p className="hint" style={{ marginTop: 0, marginBottom: 16 }}>
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
    </div>
  );
}
