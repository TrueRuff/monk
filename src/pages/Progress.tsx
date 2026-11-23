import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../shared/db';
import { dateKey, lastNDays } from '../shared/streak';
import { Btn, Card, Label } from '../shared/ui';
import type { MetricKind } from '../shared/types';

const KINDS: { kind: MetricKind; label: string; unit: string }[] = [
  { kind: 'weight', label: 'Вес', unit: 'кг' },
  { kind: 'waist', label: 'Живот', unit: 'см' },
  { kind: 'pullups', label: 'Подтягивания', unit: 'раз' },
];

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <div className="muted small">Нужно минимум два измерения, чтобы увидеть линию.</div>;
  }
  const w = 320;
  const h = 96;
  const pad = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const point = (v: number, i: number) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  };
  const line = values.map((v, i) => point(v, i).join(',')).join(' ');
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;

  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="График">
      <polyline points={area} fill="color-mix(in srgb, var(--accent) 12%, transparent)" stroke="none" />
      <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      {values.map((v, i) => {
        const [x, y] = point(v, i);
        return <circle key={i} cx={x} cy={y} r={i === values.length - 1 ? 3.5 : 2} fill="var(--accent)" />;
      })}
    </svg>
  );
}

export default function Progress() {
  const [draft, setDraft] = useState<Record<MetricKind, string>>({
    weight: '',
    waist: '',
    pullups: '',
  });
  const metrics = useLiveQuery(() => db.metrics.orderBy('date').toArray(), []);
  const checks = useLiveQuery(() => db.checks.toArray(), []);

  const doneDates = new Set((checks ?? []).filter((c) => c.minimum).map((c) => c.date));
  const days = lastNDays(70);

  async function add(kind: MetricKind) {
    const raw = draft[kind].replace(',', '.');
    const value = Number(raw);
    if (!raw || Number.isNaN(value)) return;
    await db.metrics.add({ date: dateKey(), kind, value });
    setDraft((prev) => ({ ...prev, [kind]: '' }));
  }

  function series(kind: MetricKind): number[] {
    return (metrics ?? []).filter((m) => m.kind === kind).map((m) => m.value);
  }

  function latest(kind: MetricKind): number | null {
    const values = series(kind);
    return values.length ? values[values.length - 1] : null;
  }

  function delta(kind: MetricKind): string | null {
    const values = series(kind);
    if (values.length < 2) return null;
    const diff = values[values.length - 1] - values[0];
    if (Math.abs(diff) < 0.05) return 'без изменений';
    return `${diff > 0 ? '+' : ''}${diff.toFixed(1)} с начала`;
  }

  const weightSeries = series('weight');

  return (
    <div className="screen">
      <div className="top">
        <div>
          <div className="top-date">Метрики</div>
          <h1 className="h1">Прогресс</h1>
        </div>
      </div>

      <div className="stats-grid">
        {KINDS.map(({ kind, label, unit }) => {
          const value = latest(kind);
          const change = delta(kind);
          return (
            <div className="stat" key={kind}>
              <div className="stat-label">{label}</div>
              <div className="stat-value">
                {value === null ? '—' : value}
                {value !== null ? <span className="stat-unit">{unit}</span> : null}
              </div>
              <div className="stat-hint">{change ?? 'добавь замер'}</div>
            </div>
          );
        })}
      </div>

      <h2 className="h2">Вес</h2>
      <Card>
        <Sparkline values={weightSeries} />
        <div className="small muted">Ориентир — среднее за неделю, а не одна цифра на весах.</div>
      </Card>

      <h2 className="h2">Добавить замер</h2>
      <Card>
        {KINDS.map(({ kind, label, unit }) => (
          <div key={kind} style={{ marginBottom: 14 }}>
            <div className="label" style={{ marginBottom: 6 }}>
              {label}, {unit}
            </div>
            <div className="input-row">
              <input
                className="input"
                inputMode="decimal"
                placeholder="0"
                value={draft[kind]}
                onChange={(e) => setDraft((prev) => ({ ...prev, [kind]: e.target.value }))}
              />
              <Btn onClick={() => add(kind)}>+</Btn>
            </div>
          </div>
        ))}
      </Card>

      <h2 className="h2">Последние 10 недель</h2>
      <Card>
        <div className="heatmap">
          {days.map((day) => (
            <div
              key={day}
              className={`heat ${doneDates.has(day) ? 'heat-on' : ''} ${day === dateKey() ? 'heat-today' : ''}`}
              title={day}
            />
          ))}
        </div>
        <div className="label" style={{ marginTop: 12 }}>
          Закрашено — день закрыт
        </div>
      </Card>

      <Card>
        <Label>Как читать</Label>
        <p className="small" style={{ margin: '8px 0 0', lineHeight: 1.55 }}>
          Вес может стоять две недели — это нормально, особенно с креатином. Смотри на живот и фото раз в
          месяц.
        </p>
      </Card>
    </div>
  );
}
