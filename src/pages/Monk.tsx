import { useEffect, useState } from 'react';
import { MONK_STEPS } from '../shared/plan';
import { Btn, Card, Label, Ring } from '../shared/ui';

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function Monk({ onExit }: { onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState(MONK_STEPS[0].seconds);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    if (left <= 0) {
      if (index < MONK_STEPS.length - 1) {
        const next = index + 1;
        setIndex(next);
        setLeft(MONK_STEPS[next].seconds);
      } else {
        setRunning(false);
      }
      return;
    }
    const timer = setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [running, left, index]);

  const step = MONK_STEPS[index];
  const progress = 1 - left / step.seconds;

  function goTo(next: number) {
    setIndex(next);
    setLeft(MONK_STEPS[next].seconds);
    setRunning(false);
  }

  return (
    <div className="screen">
      <div className="top">
        <div>
          <div className="top-date">
            Шаг {index + 1} из {MONK_STEPS.length}
          </div>
          <h1 className="h1">{step.title}</h1>
        </div>
        <button type="button" className="link" onClick={onExit}>
          Выйти
        </button>
      </div>

      <Card className="card-hero">
        <div className="monk-wrap">
          <Ring progress={progress} size={180} stroke={10}>
            <span className="monk-time">{mmss(left)}</span>
            <span className="ring-cap">осталось</span>
          </Ring>
          <div className="monk-note" style={{ marginTop: 14 }}>
            {step.note}
          </div>
        </div>
      </Card>

      <div className="quick">
        <button type="button" className="quick-btn" onClick={() => setRunning((v) => !v)}>
          <span className="quick-dot" />
          {running ? 'Пауза' : 'Старт'}
        </button>
        <button type="button" className="quick-btn" onClick={() => goTo(Math.max(0, index - 1))}>
          <span className="quick-dot" />
          Назад
        </button>
        <button type="button" className="quick-btn" onClick={() => goTo(Math.min(MONK_STEPS.length - 1, index + 1))}>
          <span className="quick-dot" />
          Дальше
        </button>
      </div>

      <Card>
        <Label>Порядок</Label>
        <div style={{ marginTop: 8 }}>
          {MONK_STEPS.map((item, i) => (
            <button
              key={item.title}
              type="button"
              className={`step ${i === index ? 'step-active' : ''}`}
              onClick={() => goTo(i)}
            >
              <span>{item.title}</span>
              <span className="muted">{mmss(item.seconds)}</span>
            </button>
          ))}
        </div>
      </Card>

      <p className="hint">Дыхание в живот, плечи вниз. Если закружилась голова — сядь и сократи время.</p>
    </div>
  );
}
