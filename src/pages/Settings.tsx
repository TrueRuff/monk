import { useEffect, useState } from 'react';
import { db, exportAll, getSetting, setSetting } from '../shared/db';
import { clearAll, isNative, scheduleAll } from '../shared/notifications';
import { applyTheme, isTheme, THEMES, type Theme } from '../shared/theme';
import { VERSION } from '../shared/version';
import { Btn, Card, Label } from '../shared/ui';

export default function Settings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [note, setNote] = useState('');
  const [theme, setTheme] = useState<Theme>('gold');

  useEffect(() => {
    getSetting<boolean>('notifications', false).then(setEnabled);
    const current = document.documentElement.dataset.theme;
    if (isTheme(current)) {
      setTheme(current);
      return;
    }
    getSetting<string>('theme', 'gold').then((value) => {
      if (isTheme(value)) setTheme(value);
    });
  }, []);

  async function pickTheme(next: Theme) {
    setTheme(next);
    applyTheme(next);
    await setSetting('theme', next);
  }

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    await setSetting('notifications', next);
    if (!isNative()) {
      setNote('В браузере напоминания не работают — только в APK.');
      return;
    }
    if (next) {
      await scheduleAll();
      setNote('Поставил на 3 недели вперёд.');
    } else {
      await clearAll();
      setNote('Напоминания выключены.');
    }
  }

  async function download() {
    const data = await exportAll();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'monk-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function reset() {
    if (!window.confirm('Удалить все данные? Это необратимо.')) return;
    await db.delete();
    localStorage.removeItem('monk.onboarded');
    window.location.reload();
  }

  return (
    <div className="screen">
      <div className="top">
        <div>
          <div className="top-date">Настройки</div>
          <h1 className="h1">Я</h1>
        </div>
      </div>

      <Card>
        <Label>Тема</Label>
        <div className="themes" style={{ marginTop: 10 }}>
          {THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`theme-btn ${theme === item.id ? 'active' : ''}`}
              onClick={() => pickTheme(item.id)}
            >
              <span className="theme-swatch" style={{ background: item.swatch }} />
              {item.label}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="row" style={{ paddingTop: 0 }}>
          <div className="row-main">
            <div className="row-title">Напоминания</div>
            <div className="row-sub">
              07:30 утро · 17:00 вт · 18:20 ср · 16:30 пт · 21:00 страховка · 20:00 вс итоги
            </div>
          </div>
          <button
            type="button"
            className={`switch ${enabled ? 'switch-on' : ''}`}
            onClick={toggle}
            aria-label="Напоминания"
          >
            <span className="switch-knob" />
          </button>
        </div>
        {note ? (
          <div className="small" style={{ color: 'var(--accent)', marginTop: 10 }}>
            {note}
          </div>
        ) : null}
      </Card>

      <Card>
        <Label>Данные</Label>
        <div className="input-row" style={{ marginTop: 12 }}>
          <Btn variant="secondary" onClick={download}>
            Экспорт JSON
          </Btn>
          <Btn variant="ghost" onClick={reset}>
            Сбросить
          </Btn>
        </div>
      </Card>

      <Card>
        <Label>О приложении</Label>
        <p className="small" style={{ margin: '8px 0 12px', lineHeight: 1.55 }}>
          «Монах» {VERSION}. Всё хранится на телефоне: без аккаунта, без сервера. На Xiaomi, Huawei и
          OPPO отключи оптимизацию батареи, иначе система убивает напоминания.
        </p>
        <div className="input-row">
          <Btn
            variant="secondary"
            onClick={async () => {
              const registrations = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
              await Promise.all(registrations.map((registration) => registration.unregister()));
              const keys = await caches.keys();
              await Promise.all(keys.map((key) => caches.delete(key)));
              window.location.reload();
            }}
          >
            Обновить приложение
          </Btn>
          <Btn
            variant="ghost"
            onClick={async () => {
              await setSetting('onboarded', false);
              localStorage.removeItem('monk.onboarded');
              window.location.reload();
            }}
          >
            Знакомство
          </Btn>
        </div>
      </Card>
    </div>
  );
}
