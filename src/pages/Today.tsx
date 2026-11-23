import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { db, ensureCheck, exportAll, setSetting } from '../shared/db';
import { FREEZE_LIMIT, applyFreeze, monthKey, undoFreeze } from '../shared/freeze';
import { MINIMUM, WEEK } from '../shared/plan';
import { isDeload, phaseFor, weekNumber } from '../shared/program';
import { activeDates, computeStreak, dateKey, yesterdayKey } from '../shared/streak';
import { Toast } from '../shared/Toast';
import { Btn, Card, Label, Ring } from '../shared/ui';

const DAY = 24 * 60 * 60 * 1000;

export default function Today({
  openWorkout,
  openMonk,
  openReview,
}: {
  openWorkout: () => void;
  openMonk: () => void;
  openReview: () => void;
}) {
  const now = new Date();
  const key = dateKey(now);
  const plan = WEEK[now.getDay()];
  const [toast, setToast] = useState<{ text: string; undo?: () => Promise<void> } | null>(null);

  const check = useLiveQuery(() => db.checks.get(key), [key]);
  const all = useLiveQuery(() => db.checks.toArray(), []);
  const todaySets = useLiveQuery(() => db.sets.where('date').equals(key).count(), [key]);
  const startRow = useLiveQuery(() => db.settings.get('startDate'), []);
  const freezeRow = useLiveQuery(() => db.settings.get('freezeUsed'), []);
  const backupRow = useLiveQuery(() => db.settings.get('lastBackup'), []);
  const yKey = yesterdayKey(now);
  const yesterday = useLiveQuery(() => db.checks.get(yKey), [yKey]);

  const streak = all ? computeStreak(activeDates(all)) : 0;
  const minimum = Boolean(check?.minimum);
  const full = Boolean(check?.full);

  const totalSets = plan.exercises.reduce((sum, e) => sum + e.sets, 0);
  const doneSets = Math.min(todaySets ?? 0, totalSets);
  const ratio = totalSets ? doneSets / totalSets : minimum ? 1 : 0;

  const startDate = typeof startRow?.value === 'string' ? startRow.value : null;
  const week = startDate ? weekNumber(startDate, now) : null;
  const phase = week ? phaseFor(week) : null;
  const deload = week ? isDeload(week) : false;

  const used = (freezeRow?.value as Record<string, number> | undefined) ?? {};
  const left = Math.max(0, FREEZE_LIMIT - (used[monthKey(now)] ?? 0));
  const hasHistory = (all ?? []).some((item) => item.date < yKey);
  const yesterdayActive = Boolean(yesterday?.minimum || yesterday?.frozen);
  const frozenYesterday = Boolean(yesterday?.frozen);
  const offerFreeze = hasHistory && !yesterdayActive && left > 0;

  const lastBackup = typeof backupRow?.value === 'string' ? backupRow.value : null;
  const daysSinceBackup = lastBackup
    ? Math.floor((now.getTime() - new Date(lastBackup).getTime()) / DAY)
    : null;
  const needBackup = (all ?? []).length >= 7 && (daysSinceBackup === null || daysSinceBackup > 30);

  async function markMinimum() {
    if (minimum) {
      setToast({ text: 'День уже закрыт' });
      return;
    }
    const before = await ensureCheck(key);
    await db.checks.put({ ...before, minimum: true });
    navigator.vibrate?.(12);
    setToast({
      text: 'День закрыт',
      undo: async () => {
        await db.checks.put({ ...before, minimum: false });
      },
    });
  }

  async function addPullup() {
    const before = await ensureCheck(key);
    const wasMinimum = before.minimum;
    const id = await db.sets.add({
      date: key,
      plan: plan.type,
      exercise: 'Подтягивание (GTG)',
      setIndex: 0,
    });
    if (!wasMinimum) {
      await db.checks.put({ ...before, minimum: true });
    }
    navigator.vibrate?.(12);
    setToast({
      text: 'Подтягивание записано',
      undo: async () => {
        await db.sets.delete(id);
        if (!wasMinimum) {
          const current = await ensureCheck(key);
          await db.checks.put({ ...current, minimum: false });
        }
      },
    });
  }

  async function freezeYesterday() {
    const ok = await applyFreeze(yKey);
    if (!ok) {
      setToast({ text: 'Заморозки на этот месяц кончились' });
      return;
    }
    navigator.vibrate?.(12);
    setToast({
      text: 'Вчерашний день заморожен',
      undo: async () => {
        await undoFreeze(yKey);
      },
    });
  }

  async function unfreeze() {
    await undoFreeze(yKey);
    setToast({ text: 'Заморозка отменена' });
  }

  async function downloadBackup() {
    const data = await exportAll();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'monk-backup.json';
    a.click();
    URL.revokeObjectURL(url);
    await setSetting('lastBackup', dateKey());
    setToast({ text: 'Бэкап сохранён' });
  }

  const isSunday = now.getDay() === 0;

  return (
    <div className="screen">
      <div className="top">
        <div>
          <div className="top-date">{format(now, 'EEEE, d MMMM', { locale: ru })}</div>
          <h1 className="h1">{plan.title}</h1>
          {week && phase ? (
            <div className="phase-chip">
              Неделя {Math.min(week, 26)} · {phase.name}
            </div>
          ) : null}
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

      {deload ? (
        <Card className="card-note">
          <Label>Разгрузка</Label>
          <p className="small" style={{ margin: '6px 0 0' }}>
            Пятая неделя цикла: минус 40% объёма. Работаем в удовольствие, без рекордов.
          </p>
        </Card>
      ) : null}

      {offerFreeze ? (
        <Card className="card-note">
          <Label>Вчера пропущено</Label>
          <p className="small" style={{ margin: '6px 0 12px' }}>
            Можно заморозить день, чтобы стрик не сгорел. Осталось {left} из {FREEZE_LIMIT} в этом месяце.
          </p>
          <Btn wide variant="secondary" onClick={freezeYesterday}>
            Заморозить вчера
          </Btn>
        </Card>
      ) : null}

      {frozenYesterday ? (
        <Card className="card-note">
          <Label>Вчера заморожено</Label>
          <p className="small" style={{ margin: '6px 0 12px' }}>
            Стрик сохранён. Если это была ошибка — верни как было.
          </p>
          <Btn wide variant="ghost" onClick={unfreeze}>
            Отменить заморозку
          </Btn>
        </Card>
      ) : null}

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
            <span style={{ fontSize: 15, fontWeight: 700 }}>{Math.round(ratio * 100)}%</span>
          </Ring>
        </div>
      </Card>

      <Btn wide variant={isSunday ? 'primary' : 'secondary'} onClick={openReview}>
        Итоги недели
      </Btn>

      {needBackup ? (
        <Card className="card-note" style={{ marginTop: 12 }}>
          <Label>Бэкап</Label>
          <p className="small" style={{ margin: '6px 0 12px' }}>
            {daysSinceBackup === null
              ? 'Данных уже много, а копии нет.'
              : `Последняя копия ${daysSinceBackup} дней назад.`}{' '}
            Скачай файл — он восстановит всё.
          </p>
          <Btn wide variant="secondary" onClick={downloadBackup}>
            Скачать бэкап
          </Btn>
        </Card>
      ) : null}

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

      {toast ? (
        <Toast message={toast.text} onAction={toast.undo} onClose={() => setToast(null)} />
      ) : null}
    </div>
  );
}
