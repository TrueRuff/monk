import { useEffect, useMemo, useState } from 'react';
import { db, ensureCheck } from '../shared/db';
import { dateKey } from '../shared/streak';
import { Toast } from '../shared/Toast';
import { Btn, Card, Label, Ring } from '../shared/ui';
import type { DayPlan } from '../shared/types';

const REST_SECONDS = 90;

export default function Workout({ plan, onExit }: { plan: DayPlan; onExit: () => void }) {
  const key = dateKey();
  const [exIndex, setExIndex] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [logs, setLogs] = useState<Record<string, number>>({});
  const [rest, setRest] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const totalSets = plan.exercises.reduce((sum, e) => sum + e.sets, 0);
  const before = useMemo(
    () => plan.exercises.slice(0, exIndex).reduce((sum, e) => sum + e.sets, 0),
    [plan.exercises, exIndex],
  );

  useEffect(() => {
    if (rest === null) return;
    if (rest <= 0) {
      navigator.vibrate?.(250);
      setRest(null);
      return;
    }
    const timer = setTimeout(() => setRest((value) => (value ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
  }, [rest]);

  const exercise = plan.exercises[exIndex];
  const exerciseDone = doneCount >= exercise.sets;
  const lastExercise = exIndex === plan.exercises.length - 1;
  const next = plan.exercises[exIndex + 1];

  async function completeSet() {
    if (!exercise) return;
    const id = await db.sets.add({
      date: key,
      plan: plan.type,
      exercise: exercise.name,
      setIndex: doneCount,
    });
    setLogs((prev) => ({ ...prev, [`${exIndex}-${doneCount}`]: id }));
    setDoneCount((count) => count + 1);
    setRest(REST_SECONDS);
    navigator.vibrate?.(12);
    setToast(`Подход ${doneCount + 1} записан`);
  }

  async function undoLast() {
    if (doneCount === 0) return;
    const setIndex = doneCount - 1;
    const logId = logs[`${exIndex}-${setIndex}`];
    if (logId !== undefined) {
      await db.sets.delete(logId);
      setLogs((prev) => {
        const copy = { ...prev };
        delete copy[`${exIndex}-${setIndex}`];
        return copy;
      });
    }
    setDoneCount((count) => Math.max(0, count - 1));
    setRest(null);
    setToast(null);
    navigator.vibrate?.(12);
  }

  async function advance() {
    if (lastExercise) {
      const current = await ensureCheck(key);
      await db.checks.put({ ...current, minimum: true, full: true });
      setFinished(true);
      return;
    }
    setExIndex((index) => index + 1);
    setDoneCount(0);
    setToast(null);
  }

  if (finished) {
    return (
      <div className="screen">
        <div className="top">
          <div>
            <div className="top-date">Готово</div>
            <h1 className="h1">Тренировка закрыта</h1>
          </div>
        </div>
        <Card>
          <div className="row" style={{ borderBottom: 'none', padding: 0 }}>
            <div className="row-main">
              <div className="row-title">Подходов сделано</div>
              <div className="row-sub">Отдых, еда с белком, сон. Завтра — следующий день.</div>
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, color: 'var(--accent)' }}>{totalSets}</div>
          </div>
        </Card>
        <Btn wide size="lg" onClick={onExit}>
          На сегодня всё
        </Btn>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="top">
        <div>
          <div className="top-date">
            {plan.title} · упражнение {exIndex + 1} из {plan.exercises.length}
          </div>
          <h1 className="h1">Работаем</h1>
        </div>
        <button type="button" className="link" onClick={onExit}>
          Выйти
        </button>
      </div>

      <div className="wprogress">
        <div className="wprogress-fill" style={{ width: `${((before + doneCount) / totalSets) * 100}%` }} />
      </div>
      <div className="small muted" style={{ marginBottom: 14 }}>
        {before + doneCount} из {totalSets} подходов
      </div>

      <Card className="card-hero">
        <Label>{exerciseDone ? 'Упражнение готово' : 'Сейчас'}</Label>
        <div className="wex-title">{exercise.name}</div>
        <div className="wex-meta">
          {exercise.sets} подхода × {exercise.reps}
        </div>
        <div className="wex-cue">{exercise.cue}</div>

        <div className="tech">
          <div className="label">Техника</div>
          <ol className="tech-list">
            {exercise.tech.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        {exercise.mistake ? (
          <div className="wex-note">
            <b>Не так:</b> {exercise.mistake}
          </div>
        ) : null}
        {exercise.easier || exercise.harder ? (
          <div className="wex-note">
            {exercise.easier ? (
              <>
                <b>Легче:</b> {exercise.easier}
              </>
            ) : null}
            {exercise.easier && exercise.harder ? <br /> : null}
            {exercise.harder ? (
              <>
                <b>Сложнее:</b> {exercise.harder}
              </>
            ) : null}
          </div>
        ) : null}

        <div className="sets">
          {Array.from({ length: exercise.sets }, (_, index) => {
            const isDone = index < doneCount;
            const isLast = index === doneCount - 1;
            return (
              <button
                key={index}
                type="button"
                className={`set ${isDone ? 'set-done' : ''} ${index === doneCount ? 'set-current' : ''} ${
                  isLast ? 'set-undoable' : ''
                }`}
                onClick={isLast ? undoLast : undefined}
                disabled={!isLast}
                aria-label={isLast ? 'Отменить последний подход' : undefined}
              >
                {isDone ? '✓' : index + 1}
              </button>
            );
          })}
        </div>
        {doneCount > 0 ? (
          <div className="small muted" style={{ marginTop: -8, marginBottom: 12 }}>
            Нажми на последнюю ✓, чтобы отменить подход.
          </div>
        ) : null}

        <Btn wide size="lg" onClick={exerciseDone ? advance : completeSet}>
          {exerciseDone
            ? lastExercise
              ? 'Завершить тренировку'
              : 'Следующее упражнение'
            : `Подход ${doneCount + 1} из ${exercise.sets} — готово`}
        </Btn>
      </Card>

      {exerciseDone && next ? (
        <Card>
          <Label>Дальше</Label>
          <div className="row" style={{ borderBottom: 'none', paddingTop: 6 }}>
            <div className="row-main">
              <div className="row-title">{next.name}</div>
              <div className="row-sub">
                {next.sets} × {next.reps}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {rest !== null ? (
        <div className="rest-screen" onClick={() => setRest(null)}>
          <Label>Отдых</Label>
          <Ring progress={rest / REST_SECONDS} size={190} stroke={12}>
            <span className="rest-time">
              {Math.floor(rest / 60)}:{String(rest % 60).padStart(2, '0')}
            </span>
          </Ring>
          <div className="rest-next">
            {rest > 30 ? 'Дыши носом, не садись. Пульс должен упасть до ровного.' : 'Ещё немного — и следующий подход.'}
          </div>
          <div className="rest-actions">
            <Btn variant="ghost" onClick={() => setRest(null)}>
              Пропустить отдых
            </Btn>
            <Btn
              variant="secondary"
              onClick={() => {
                setRest(null);
                void undoLast();
              }}
            >
              Отменить подход
            </Btn>
          </div>
        </div>
      ) : null}

      {toast && rest === null ? (
        <Toast message={toast} onAction={undoLast} onClose={() => setToast(null)} />
      ) : null}
    </div>
  );
}
