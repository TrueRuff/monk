import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { db, exportAll, getSetting, importAll, setSetting } from '../shared/db';
import { clearAll, isNative, scheduleAll } from '../shared/notifications';
import { applyTheme, isTheme, THEMES, type Theme } from '../shared/theme';
import { VERSION } from '../shared/version';
import { parseBackup, summarize, type BackupData } from '../shared/backup';
import { dateKey } from '../shared/streak';
import { Btn, Card, Label } from '../shared/ui';

export default function Settings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [note, setNote] = useState('');
  const [theme, setTheme] = useState<Theme>('gold');
  const [start, setStart] = useState('');
  const [pending, setPending] = useState<BackupData | null>(null);
  const [importError, setImportError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSetting<boolean>('notifications', false).then(setEnabled);
    getSetting<string>('startDate', '').then(setStart);
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
    await setSetting('lastBackup', dateKey());
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    const parsed = parseBackup(text);
    if (!parsed.ok) {
      setPending(null);
      setImportError(parsed.error);
      return;
    }
    setImportError('');
    setPending(parsed.data);
  }

  async function applyImport(mode: 'replace' | 'merge') {
    if (!pending) return;
    try {
      await importAll(pending, mode);
      window.location.reload();
    } catch (error) {
      setImportError(`Не удалось записать данные: ${String(error)}`);
    }
  }

  async function reset() {
    if (!window.confirm('Удалить все данные? Это необратимо.')) return;
    await db.delete();
    localStorage.removeItem('monk.onboarded');
    window.location.reload();
  }

  async function restartCycle() {
    if (!window.confirm('Начать 26 недель заново с сегодняшнего дня?')) return;
    await setSetting('startDate', dateKey());
    setStart(dateKey());
    setNote('Цикл перезапущен с сегодня.');
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
        <Label>Цикл плана</Label>
        <p className="small" style={{ margin: '8px 0 12px' }}>
          Старт:{' '}
          {start ? format(parseISO(start), 'd MMMM yyyy', { locale: ru }) : 'ещё не задан'}
        </p>
        <Btn variant="secondary" onClick={restartCycle}>
          Начать 26 недель заново
        </Btn>
      </Card>

      <Card>
        <Label>Данные</Label>
        <div className="input-row" style={{ marginTop: 12 }}>
          <Btn variant="secondary" onClick={download}>
            Экспорт JSON
          </Btn>
          <Btn variant="secondary" onClick={() => fileRef.current?.click()}>
            Импорт
          </Btn>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={onFile}
          style={{ display: 'none' }}
        />

        {importError ? (
          <div className="small" style={{ color: 'var(--danger)', marginTop: 12 }}>
            {importError}
          </div>
        ) : null}

        {pending ? (
          <div style={{ marginTop: 14 }}>
            <div className="label">В файле</div>
            <p className="small" style={{ margin: '6px 0 12px' }}>
              {summarize(pending)}
            </p>
            <div className="input-row">
              <Btn onClick={() => applyImport('merge')}>Объединить</Btn>
              <Btn variant="ghost" onClick={() => applyImport('replace')}>
                Заменить
              </Btn>
            </div>
            <div className="small muted" style={{ marginTop: 8 }}>
              «Объединить» добавит только то, чего нет. «Заменить» сотрёт текущие данные.
            </div>
          </div>
        ) : null}

        <div className="divider" />
        <Btn variant="ghost" onClick={reset}>
          Сбросить всё
        </Btn>
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
