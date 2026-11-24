import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TARGET_URL = process.argv[2] ?? 'http://localhost:4182/';
const OUT_DIR = process.argv[3] ?? '.';
const PORT = 9413;

function dayKey(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const seed = {
  version: 2,
  checks: [
    { date: dayKey(-3), minimum: true, full: true },
    { date: dayKey(-2), minimum: true, full: true },
  ],
  metrics: [],
  sets: [],
  settings: [],
};
const seedPath = resolve(OUT_DIR, 'ux-seed.json');
writeFileSync(seedPath, JSON.stringify(seed, null, 2));

const profile = mkdtempSync(join(tmpdir(), 'monk-ux-'));
const child = spawn(
  EDGE,
  [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    `--user-data-dir=${profile}`,
    '--window-size=390,844',
    TARGET_URL,
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return res.json();
}

let target = null;
for (let i = 0; i < 80; i += 1) {
  try {
    const list = await getJson('/json/list');
    target = list.find((t) => t.type === 'page');
    if (target) break;
  } catch {
    /* devtools ещё не поднялся */
  }
  await sleep(250);
}
if (!target) {
  child.kill();
  throw new Error('DevTools target not found');
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let msgId = 0;
const pending = new Map();
const consoleErrors = [];

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
    return;
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const details = msg.params.exceptionDetails;
    consoleErrors.push(details?.exception?.description ?? details?.text ?? 'exception');
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
  }
};

function send(method, params = {}) {
  const id = (msgId += 1);
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => pending.set(id, resolve));
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (res.result?.exceptionDetails) {
    throw new Error(res.result.exceptionDetails.text ?? 'evaluate failed');
  }
  return res.result?.result?.value;
}

async function waitFor(expression, timeout = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return true;
    await sleep(120);
  }
  return false;
}

async function click(selector) {
  return evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.click();
    return true;
  })()`);
}

async function clickByText(text) {
  return evaluate(`(() => {
    const el = [...document.querySelectorAll('button')].find((b) => b.innerText.includes(${JSON.stringify(text)}));
    if (!el) return false;
    el.click();
    return true;
  })()`);
}

async function setInputValue(selector, value) {
  return evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
}

async function sendOk(method, params = {}) {
  const res = await send(method, params);
  return !res.error;
}

async function shot(name) {
  const res = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT_DIR, `${name}.png`), Buffer.from(res.result.data, 'base64'));
}

const results = [];
function check(name, ok, details = '') {
  results.push({ name, ok, details });
}

const counterSel = '.row-sub';

await send('Runtime.enable');
await send('Page.enable');
await send('DOM.enable');
const nav = await send('Page.navigate', { url: TARGET_URL });
if (nav.error) console.error('navigate error:', JSON.stringify(nav.error));
// Ждём, пока приложение реально отрисуется: на живом сайте это дольше, чем локально.
await waitFor("document.readyState === 'complete' && !!document.querySelector('.onb, .nav')", 30000);

try {
  check('Онбординг показан при первом запуске', await evaluate("!!document.querySelector('.onb')"));
  await shot('ux-01-onboarding');

  await click('.onb-skip');
  check('Онбординг закрывается кнопкой «Пропустить»', await waitFor("!!document.querySelector('.nav')", 5000));
  check('Видно неделю и фазу плана', await waitFor("!!document.querySelector('.phase-chip')", 5000));
  await shot('ux-02-today');

  const before = await evaluate(`document.querySelector('${counterSel}')?.innerText ?? ''`);
  await click('.quick-btn');
  const incremented = await waitFor(
    `(document.querySelector('${counterSel}')?.innerText ?? '').startsWith('1 из')`,
    4000,
  );
  check('«+1 подтягивание» увеличивает счётчик', incremented, before);

  const toastAppeared = await waitFor("!!document.querySelector('.toast')", 4000);
  check('Плашка с отменой появляется', toastAppeared);
  const toastVisible = await evaluate(`
    (() => {
      const el = document.querySelector('.toast');
      if (!el) return 'none';
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight + 1 && r.width > 0 ? 'visible' : 'offscreen';
    })()
  `);
  check('Плашка реально видна на экране', toastVisible === 'visible', toastVisible);
  await shot('ux-03-toast');

  await click('.toast-action');
  check('Отмена убирает плашку', await waitFor("!document.querySelector('.toast')", 4000));
  const undone = await waitFor(
    `(document.querySelector('${counterSel}')?.innerText ?? '').startsWith('0 из')`,
    5000,
  );
  const after = await evaluate(`document.querySelector('${counterSel}')?.innerText ?? ''`);
  check('Отмена возвращает счётчик', undone, after);

  await click('.card-hero .btn');
  const workout = await waitFor("!!document.querySelector('.wex-title')", 5000);
  check('Тренировка открывается', workout);
  await shot('ux-04-workout');

  if (workout) {
    let rest = false;
    for (let attempt = 0; attempt < 3 && !rest; attempt += 1) {
      await click('.card-hero .btn');
      rest = await waitFor("!!document.querySelector('.rest-screen')", 5000);
      if (!rest) await sleep(700);
    }
    const heroInfo = await evaluate(`
      (() => {
        const card = document.querySelector('.card-hero');
        const btn = card?.querySelector('.btn');
        return card ? 'title=' + (card.innerText.slice(0, 30)) + ' | btn=' + (btn ? btn.innerText.slice(0, 30) + '/' + btn.disabled : 'none') : 'no-card';
      })()
    `);
    check('Экран отдыха появляется после подхода', rest, heroInfo);
    const undoBtn = await evaluate(`
      (() => {
        const rest = document.querySelector('.rest-screen');
        if (!rest) return 'no-rest';
        const btn = [...rest.querySelectorAll('button')].find((b) => b.innerText.includes('Отменить'));
        if (!btn) return 'no-button';
        btn.click();
        return 'clicked';
      })()
    `);
    check('В экране отдыха есть «Отменить подход»', undoBtn === 'clicked', undoBtn);
    await sleep(400);
    check('Отмена в отдыхе закрывает отдых', await evaluate("!document.querySelector('.rest-screen')"));
    await click('.link');
    await waitFor("!!document.querySelector('.nav')", 4000);
  }

  await click('.nav-item:nth-child(4)');
  await waitFor("!!document.querySelector('.themes')", 4000);
  const themeClicked = await evaluate(`
    (() => {
      const buttons = [...document.querySelectorAll('.theme-btn')];
      const blue = buttons.find((b) => b.innerText.includes('Синий'));
      if (!blue) return false;
      blue.click();
      return true;
    })()
  `);
  check('Тема переключается на синюю', themeClicked && (await evaluate("document.documentElement.dataset.theme === 'blue'")));
  await shot('ux-05-settings');

  // --- напоминания: разрешение, время, проверка ---
  const origin = new URL(TARGET_URL).origin;
  const granted =
    (await sendOk('Browser.grantPermissions', { origin, permissions: ['notifications'] })) ||
    (await sendOk('Browser.setPermission', {
      permission: { name: 'notifications' },
      setting: 'granted',
      origin,
    }));
  check('Тест получил разрешение браузера на уведомления', granted);

  check('Переключатель напоминаний срабатывает', await click('.switch'));
  const timeReady = await waitFor("!!document.querySelector('.time-input')", 5000);
  check('Список напоминаний с полями времени виден', timeReady);
  if (timeReady) {
    await setInputValue('.time-input', '05:45');
    await sleep(500);
    const timeSet = await evaluate("document.querySelector('.time-input')?.value ?? ''");
    check('Время напоминания меняется', timeSet === '05:45', timeSet);
  }

  await send('Page.reload');
  await waitFor("document.readyState === 'complete' && !!document.querySelector('.nav, .onb')", 20000);
  await sleep(500);
  check('Тема сохраняется после перезагрузки', await evaluate("document.documentElement.dataset.theme === 'blue'"));

  await click('.nav-item:nth-child(4)');
  const reminderLoaded = await waitFor("!!document.querySelector('.time-input')", 5000);
  const timeAfterReload = await evaluate("document.querySelector('.time-input')?.value ?? ''");
  check('Время напоминания сохраняется после перезагрузки', reminderLoaded && timeAfterReload === '05:45', timeAfterReload);

  if (reminderLoaded) {
    await clickByText('Проверить');
    const notified = await waitFor("(window.__monkNotify?.count ?? 0) >= 1", 6000);
    const stats = await evaluate('JSON.stringify(window.__monkNotify ?? null)');
    check('Проверочное уведомление уходит', notified, stats);
    await shot('ux-10-reminders');

    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    await setInputValue('.time-input', nowTime);
    const scheduled = await waitFor("(window.__monkNotify?.count ?? 0) >= 2", 32000);
    const after = await evaluate('JSON.stringify(window.__monkNotify ?? null)');
    check('Планировщик сам срабатывает в назначенное время', scheduled, `${nowTime} → ${after}`);
  }

  await click('.nav-item:nth-child(4)');
  await waitFor("!!document.querySelector('input[type=file]')", 4000);
  const doc = await send('DOM.getDocument');
  const inputNode = await send('DOM.querySelector', {
    nodeId: doc.result.root.nodeId,
    selector: 'input[type=file]',
  });
  await send('DOM.setFileInputFiles', { nodeId: inputNode.result.nodeId, files: [seedPath] });
  const pending = await waitFor("[...document.querySelectorAll('button')].some((b) => b.innerText.includes('Объединить'))", 5000);
  check('Импорт показывает сводку файла', pending);
  await shot('ux-06-import');

  if (pending) {
    await clickByText('Объединить');
    await sleep(800);
    check('После импорта приложение перезагружается', await waitFor("!!document.querySelector('.nav')", 20000));
  }

  await click('.nav-item:nth-child(1)');
  const freezeCard = await waitFor("!!document.querySelector('.card-note')", 4000);
  check('Появляется карточка заморозки за пропущенный вчера', freezeCard);
  await shot('ux-07-freeze');

  if (freezeCard) {
    await clickByText('Заморозить вчера');
    await sleep(700);
    const streakText = await evaluate("document.querySelector('.streak-num')?.innerText ?? ''");
    check('Заморозка сохраняет стрик', streakText === '3', `стрик: ${streakText}`);
    await clickByText('Отменить заморозку');
    await sleep(700);
    const streakAfter = await evaluate("document.querySelector('.streak-num')?.innerText ?? ''");
    check('Отмена заморозки обнуляет стрик', streakAfter === '0', `стрик: ${streakAfter}`);
  }

  await clickByText('Итоги недели');
  const reviewOpen = await waitFor("!!document.querySelector('.textarea')", 4000);
  check('Итоги недели открываются', reviewOpen);
  await shot('ux-08-review');

  if (reviewOpen) {
    await evaluate(`
      (() => {
        const el = document.querySelector('.textarea');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(el, 'тестовая заметка');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return el.value;
      })()
    `);
    await clickByText('Сохранить заметку');
    await sleep(600);
    await send('Page.reload');
    await waitFor("document.readyState === 'complete' && !!document.querySelector('.nav')", 20000);
    await clickByText('Итоги недели');
    await waitFor("!!document.querySelector('.textarea')", 8000);
    const noteRestored = await waitFor(
      "(document.querySelector('.textarea')?.value ?? '') === 'тестовая заметка'",
      8000,
    );
    const saved = await evaluate("document.querySelector('.textarea')?.value ?? ''");
    check('Заметка обзора сохраняется', noteRestored, saved);
    await shot('ux-09-review-saved');
  }

  // --- еда в плане ---
  await send('Page.reload');
  await waitFor("document.readyState === 'complete' && !!document.querySelector('.nav')", 20000);
  await click('.nav-item:nth-child(2)');
  const planFood = await waitFor("!!document.querySelector('.food-preset')", 10000);
  check('В плане есть блок «Еда без проблем»', planFood);

  if (planFood) {
    const presetAdded = await click('.food-preset');
    const chipAppeared = await waitFor("document.querySelectorAll('.food-chip').length === 1", 6000);
    const chipCount = await evaluate("document.querySelectorAll('.food-chip').length");
    check('Продукт добавляется в список', presetAdded && chipAppeared, `чипов: ${chipCount}`);
    await shot('ux-11-food');

    await send('Page.reload');
    await waitFor("document.readyState === 'complete' && !!document.querySelector('.nav')", 20000);
    await click('.nav-item:nth-child(2)');
    await waitFor("!!document.querySelector('.food-chip')", 10000);
    const chipName = await evaluate(
      "(document.querySelector('.food-chip')?.innerText ?? '').replace('×', '').trim()",
    );
    check('Список еды сохраняется после перезагрузки', chipName.length > 0, chipName);

    await click('.food-chip');
    const chipGone = await waitFor("document.querySelectorAll('.food-chip').length === 0", 5000);
    const afterRemove = await evaluate("document.querySelectorAll('.food-chip').length");
    check('Продукт удаляется нажатием', chipGone, `чипов: ${afterRemove}`);

    const undoAppeared = await waitFor("!!document.querySelector('.toast-action')", 3000);
    if (undoAppeared) {
      await click('.toast-action');
      const restored = await waitFor("document.querySelectorAll('.food-chip').length === 1", 5000);
      check('Удаление продукта можно отменить', restored, '');
    } else {
      check('Удаление продукта можно отменить', false, 'нет плашки с отменой');
    }

    const pickClicked = await clickByText('Что съесть');
    const pickShown = pickClicked
      ? await waitFor(
          "(document.querySelector('.food-pick')?.innerText ?? '').includes('Творог')",
          4000,
        )
      : false;
    const pickText = await evaluate("document.querySelector('.food-pick')?.innerText ?? ''");
    check('«Что съесть?» выбирает продукт из списка', pickShown, pickText);
  }
} catch (error) {
  check('Тест упал', false, String(error));
} finally {
  child.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(
  JSON.stringify({ total: results.length, failed: failed.length, results, consoleErrors }, null, 2),
);
