import { useEffect, useState } from 'react';
import Today from '../pages/Today';
import Plan from '../pages/Plan';
import Progress from '../pages/Progress';
import Settings from '../pages/Settings';
import Workout from '../pages/Workout';
import Monk from '../pages/Monk';
import { WEEK } from '../shared/plan';
import { getSetting } from '../shared/db';
import { isNative, scheduleAll } from '../shared/notifications';
import type { Tab } from '../shared/types';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Сегодня', icon: 'M3 11 12 4l9 7v8a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z' },
  { id: 'plan', label: 'План', icon: 'M4 6h16M4 12h16M4 18h10' },
  { id: 'progress', label: 'Прогресс', icon: 'M4 19V5M4 19h16M8 15l4-5 3 3 4-6' },
  { id: 'settings', label: 'Я', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 21a7 7 0 0 1 14 0' },
];

const VALID_TABS: Tab[] = ['today', 'plan', 'progress', 'settings'];

function initialTab(): Tab {
  const hash = window.location.hash.replace('#', '');
  return VALID_TABS.includes(hash as Tab) ? (hash as Tab) : 'today';
}

export default function App() {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [workout, setWorkout] = useState(false);
  const [monk, setMonk] = useState(false);

  useEffect(() => {
    void (async () => {
      const enabled = await getSetting<boolean>('notifications', false);
      if (enabled && isNative()) {
        try {
          await scheduleAll();
        } catch {
          /* напоминания не критичны для запуска */
        }
      }
    })();
  }, []);

  const plan = WEEK[new Date().getDay()];

  if (workout) {
    return (
      <div className="app">
        <Workout
          plan={plan}
          onExit={() => {
            setWorkout(false);
            setTab('today');
          }}
        />
      </div>
    );
  }

  if (monk) {
    return (
      <div className="app">
        <Monk onExit={() => setMonk(false)} />
      </div>
    );
  }

  return (
    <div className="app">
      {tab === 'today' && (
        <Today openWorkout={() => setWorkout(true)} openMonk={() => setMonk(true)} />
      )}
      {tab === 'plan' && <Plan />}
      {tab === 'progress' && <Progress />}
      {tab === 'settings' && <Settings />}

      <nav className="nav">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item ${tab === item.id ? 'active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            <svg className="nav-svg" viewBox="0 0 24 24" aria-hidden="true">
              <path d={item.icon} />
            </svg>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
