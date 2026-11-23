import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, startOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import { db, getSetting, setSetting } from '../shared/db';
import { isDeload, phaseFor, weekNumber } from '../shared/program';
import { activeDates, computeStreak, dateKey, lastNDays } from '../shared/streak';
import { Btn, Card, Label } from '../shared/ui';
import { Toast } from '../shared/Toast';

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export default function Review({ onExit }: { onExit: () => void }) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekKey = dateKey(weekStart);
  const days = lastNDays(7, now);

  const [note, setNote] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const checks = useLiveQuery(() => db.checks.toArray(), []);
  const sets = useLiveQuery(() => db.sets.where('date').anyOf(days).count(), [days.join(',')]);
  const metrics = useLiveQuery(() => db.metrics.orderBy('date').toArray(), []);
  const startRow = useLiveQuery(() => db.settings.get('startDate'), []);

  useEffect(() => {
    void (async () => {
      const saved = await getSetting<{ note: string } | null>(`review:${weekKey}`, null);
      if (saved?.note) setNote(saved.note);
    })();
  }, [weekKey]);

  const checksByDate = new Map((checks ?? []).map((item) => [item.date, item]));
  const active = activeDates(checks ?? []);
  const streak = computeStreak(active);

  const closed = days.filter((day) => active.has(day)).length;
  const totalSets = sets ?? 0;

  const weekWeights = (metrics ?? [])
    .filter((metric) => metric.kind === 'weight' && days.includes(metric.date))
    .map((metric) => metric.value);
  const weightDelta =
    weekWeights.length >= 2
      ? (weekWeights[weekWeights.length - 1] - weekWeights[0]).toFixed(1)
      : null;

  const startDate = typeof startRow?.value === 'string' ? startRow.value : null;
  const week = startDate ? weekNumber(startDate, now) : null;
  const phase = week ? phaseFor(week) : null;
  const nextWeek = week ? week + 1 : null;
  const nextPhase = nextWeek ? phaseFor(nextWeek) : null;

  async function save() {
    await setSetting(`review:${weekKey}`, { note, createdAt: new Date().toISOString() });
    setToast('Сохранено');
  }

  return (
    <div className="screen">
      <div className="top">
        <div>
          <div className="top-date">
            {format(weekStart, 'd MMMM', { locale: ru })} — {format(now, 'd MMMM', { locale: ru })}
          </div>
          <h1 className="h1">Итоги недели</h1>
        </div>
        <button type="button" className="link" onClick={onExit}>
          Закрыть
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat">
          <div className="stat-label">Закрыто</div>
          <div className="stat-value">
            {closed}
            <span className="stat-unit">из 7</span>
          </div>
          <div className="stat-hint">стрик {streak}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Подходов</div>
          <div className="stat-value">{totalSets}</div>
          <div className="stat-hint">за неделю</div>
        </div>
      </div>

      <Card>
        <Label>Вес за неделю</Label>
        <p className="small" style={{ margin: '6px 0 0' }}>
          {weightDelta === null
            ? 'Нужно минимум два взвешивания за неделю.'
            : `${weightDelta} кг. Норма — около 0,3–0,7 кг вниз за неделю.`}
        </p>
      </Card>

      <h2 className="h2">Дни</h2>
      <Card>
        {days.map((day) => {
          const item = checksByDate.get(day);
          const isActive = active.has(day);
          const frozen = Boolean(item?.frozen);
          const label = frozen ? 'заморожен' : isActive ? 'закрыт' : 'пропуск';
          const date = new Date(`${day}T12:00:00`);
          return (
            <div className="row" key={day}>
              <div className="row-main">
                <div className="row-title">
                  {WEEKDAYS[date.getDay()]}, {format(date, 'd MMM', { locale: ru })}
                </div>
              </div>
              <div className={`row-right ${isActive ? 'ok' : 'muted'}`}>{label}</div>
            </div>
          );
        })}
      </Card>

      {week && phase ? (
        <Card>
          <Label>Следующая неделя</Label>
          <p className="small" style={{ margin: '6px 0 0' }}>
            Неделя {nextWeek} · {nextPhase?.name ?? 'Цикл завершён'}
            {nextWeek && isDeload(nextWeek) ? ' · разгрузочная' : ''}
            {nextPhase ? `. ${nextPhase.goal}` : ''}
          </p>
        </Card>
      ) : null}

      <Card>
        <Label>Заметка</Label>
        <textarea
          className="input textarea"
          rows={4}
          placeholder="Что получилось, что мешало, что меняем"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <div style={{ marginTop: 12 }}>
          <Btn wide onClick={save}>
            Сохранить заметку
          </Btn>
        </div>
      </Card>

      {toast ? <Toast message={toast} onAction={undefined} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
