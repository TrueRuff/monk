import { useState } from 'react';
import { applyTheme, THEMES, type Theme } from '../shared/theme';
import { Btn } from '../shared/ui';

const STEPS: { title: string; text: string }[] = [
  {
    title: 'Монах',
    text: 'План на 6 месяцев: 13 подтягиваний, 100 м и 3 км. Здесь видно, что делать сегодня, и ничего не надо помнить.',
  },
  {
    title: 'Минимум',
    text: 'День закрыт, если сделал три минуты: одно подтягивание, десять отжиманий, вакуум. Стрик не рвётся, даже когда нет сил.',
  },
  {
    title: 'Стиль',
    text: 'Выбери цвет. Поменять можно в разделе «Я» в любой момент.',
  },
];

export default function Onboarding({
  onDone,
  initialTheme,
}: {
  onDone: (theme: Theme) => void;
  initialTheme: Theme;
}) {
  const [step, setStep] = useState(0);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const last = step === STEPS.length - 1;

  function pick(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div className="onb">
      <button type="button" className="onb-skip" onClick={() => onDone(theme)}>
        Пропустить
      </button>

      <div className="onb-body">
        <div className="onb-step">
          Шаг {step + 1} из {STEPS.length}
        </div>
        <h1 className="onb-title">{STEPS[step].title}</h1>
        <p className="onb-text">{STEPS[step].text}</p>

        {last ? (
          <div className="themes onb-themes">
            {THEMES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`theme-btn ${theme === item.id ? 'active' : ''}`}
                onClick={() => pick(item.id)}
              >
                <span className="theme-swatch" style={{ background: item.swatch }} />
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="onb-footer">
        <div className="onb-dots">
          {STEPS.map((item, index) => (
            <span key={item.title} className={`onb-dot ${index === step ? 'onb-dot-active' : ''}`} />
          ))}
        </div>
        <Btn wide size="lg" onClick={() => (last ? onDone(theme) : setStep(step + 1))}>
          {last ? 'Начать' : 'Дальше'}
        </Btn>
      </div>
    </div>
  );
}
