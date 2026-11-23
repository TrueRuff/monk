import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { db, ensureCheck } from '../shared/db';
import { MINIMUM, WEEK } from '../shared/plan';
import { computeStreak, dateKey } from '../shared/streak';
import { Btn, Card, Label, Ring } from '../shared/ui';

export default function Today({
  openWorkout,
  openMonk,
}: {
  openWorkout: () => void;
  openMonk: () => void;
}) {
  const now = new Date();
  const key = dateKey(now);
  const plan = WEEK[now.getDay()];

  const check = useLiveQuery(() => db.checks.get(key), [key]);
  const all = useLiveQuery(() => db.checks.toArray(), []);
  const todaySets = useLiveQuery(() => db.sets.where('date').equals(key).count(), [key]);

  const streak = all ? computeStreak(new Set(all.filter((c) => c.minimum).map((c) => c.date))) : 0;
  const minimum = Boolean(check?.minimum);
  const full = Boolean(check?.full);

  const totalSets = plan.exercises.reduce((sum, e) => sum + e.sets, 0);
  const doneSets = Math.min(todaySets ?? 0, totalSets);
  const ratio = totalSets ? doneSets / totalSets : minimum ? 1 : 0;

  async function markMinimum() {
    const current = await ensureCheck(key);
    await db.checks.put({ ...current, minimum: true });
  }

  async function addPullup() {
    await db.sets.add({ date: key, plan: plan.type, exercise: 'Подтягивание (GTG)', setIndex: 0 });
    await markMinimum();
  }

  return (
    <div className="screen">
      <div className="top">
        <div>
          <div className="top-date">{format(now, 'EEEE, d MMMM', { locale: ru })}</div>
          <h1 className="h1">{plan.title}</h1>
        </div>
        <div className="streak-badge">
          <span className="streak-flame" />
          <span className="streak-num">{streak}</span>
          <span className="streak-cap">дней</span>
        </div>
      </div>

      <Card className="card-hero">
        <Label>Сегодня</Label>
        <div className="hero-title">{plan.focus}</div>
        <div className="hero-meta">{plan.minutes ? `${plan.minutes} минут` : 'без тренировки'}</div>
        <p className="hero-why">{plan.why}</p>
        <Btn wide size="lg" onClick={openWorkout}>
          {full ? 'Открыть тренировку' : 'Начать'}
        </Btn>
      </Card>

      <div className="quick">
        <button type="button" className="quick-btn" onClick={addPullup}>
          <span className="quick-dot" />
          +1 подтягивание
        </button>
        <button
          type="button"
          className={`quick-btn ${minimum ? 'done' : ''}`}
          onClick={markMinimum}
        >
          <span className="quick-dot" />
          {minimum ? 'Минимум закрыт' : 'Минимум'}
        </button>
        <button type="button" className="quick-btn" onClick={openMonk}>
          <span className="quick-dot" />
          Монах
        </button>
      </div>

      <Card>
        <div className="row" style={{ borderBottom: 'none', padding: 0 }}>
          <div className="row-main">
            <div className="row-title">Прогресс дня</div>
            <div className="row-sub">
              {doneSets} из {totalSets} подходов
              {full ? ' · тренировка закрыта' : ''}
            </div>
          </div>
          <Ring progress={ratio} size={64} stroke={7}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>
              {Math.round(ratio * 100)}%
            </span>
          </Ring>
        </div>
      </Card>

      <h2 className="h2">Если нет сил</h2>
      <Card>
        {MINIMUM.map((item) => (
          <div className="row" key={item.title}>
            <div className="row-main">
              <div className="row-title">{item.title}</div>
              <div className="row-sub">{item.note}</div>
            </div>
          </div>
        ))}
        <div className="divider" />
        <Btn wide variant="secondary" onClick={markMinimum}>
          {minimum ? 'Закрыто на сегодня' : 'Сделал, закрыть день'}
        </Btn>
      </Card>

      <p className="hint">Правило простое: день закрыт, если сделал минимум. Не ноль — уже победа.</p>
    </div>
  );
}
