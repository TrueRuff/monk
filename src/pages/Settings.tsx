import { useEffect, useState } from 'react';
import { db, exportAll, getSetting, setSetting } from '../shared/db';
import { clearAll, isNative, scheduleAll } from '../shared/notifications';
import { Btn, Card, Label } from '../shared/ui';

export default function Settings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    getSetting<boolean>('notifications', false).then(setEnabled);
  }, []);

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
        <p className="small" style={{ margin: '8px 0 0', lineHeight: 1.55 }}>
          «Монах» 0.2. Всё хранится на телефоне: без аккаунта, без сервера. На Xiaomi, Huawei и OPPO
          отключи оптимизацию батареи, иначе система убивает напоминания.
        </p>
      </Card>
    </div>
  );
}
