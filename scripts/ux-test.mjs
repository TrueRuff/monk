import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TARGET_URL = process.argv[2] ?? 'http://localhost:4179/';
const OUT_DIR = process.argv[3] ?? '.';
const PORT = 9412;

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
    consoleErrors.push(msg.params.exceptionDetails?.text ?? 'exception');
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

async function shot(name) {
  const res = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT_DIR, `${name}.png`), Buffer.from(res.result.data, 'base64'));
}

const results = [];
function check(name, ok, details = '') {
  results.push({ name, ok, details });
}

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: TARGET_URL });
await sleep(1200);

try {
  check('Онбординг показан при первом запуске', await evaluate("!!document.querySelector('.onb')"));
  await shot('ux-01-onboarding');

  await click('.onb-skip');
  check('Онбординг закрывается кнопкой «Пропустить»', await waitFor("!!document.querySelector('.nav')", 5000));
  await shot('ux-02-today');

  const counterSel = ".row-sub";
  const before = await evaluate(`document.querySelector('${counterSel}')?.innerText ?? ''`);
  await click('.quick-btn');
  const incremented = await waitFor(
    `(document.querySelector('${counterSel}')?.innerText ?? '').startsWith('1 из')`,
    4000,
  );
  check('«+1 подтягивание» увеличивает счётчик', incremented, before);

  const toastAppeared = await waitFor("!!document.querySelector('.toast')", 4000);
  check('Плашка с отменой появляется', toastAppeared, toastAppeared ? '' : 'toast не найден');
  await shot('ux-03-toast');

  const toastText = await evaluate("document.querySelector('.toast')?.innerText ?? ''");
  check('В плашке есть «Отменить»', toastText.includes('Отменить'), toastText.replace(/\n/g, ' | '));

  const toastVisible = await evaluate(`
    (() => {
      const el = document.querySelector('.toast');
      if (!el) return 'none';
      const r = el.getBoundingClientRect();
      const inside = r.top >= 0 && r.bottom <= window.innerHeight + 1 && r.width > 0 && r.height > 0;
      return inside ? 'visible' : 'offscreen top=' + Math.round(r.top) + ' bottom=' + Math.round(r.bottom) + ' vh=' + window.innerHeight;
    })()
  `);
  check('Плашка реально видна на экране', toastVisible === 'visible', toastVisible);

  await click('.toast-action');
  await sleep(400);
  check('Отмена убирает плашку', await evaluate("!document.querySelector('.toast')"));
  const after = await evaluate(`document.querySelector('${counterSel}')?.innerText ?? ''`);
  check('Отмена возвращает счётчик', after.startsWith('0 из'), after);

  await click('.card-hero .btn');
  const workout = await waitFor("!!document.querySelector('.wex-title')", 5000);
  check('Тренировка открывается', workout);
  await shot('ux-04-workout');

  if (workout) {
    await click('.card-hero .btn');
    const rest = await waitFor("!!document.querySelector('.rest-screen')", 4000);
    check('Экран отдыха появляется после подхода', rest);
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
    await shot('ux-05-after-undo');

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
  await shot('ux-06-settings');

  await send('Page.reload');
  await sleep(1800);
  check('Тема сохраняется после перезагрузки', await evaluate("document.documentElement.dataset.theme === 'blue'"));

  await click('.nav-item:nth-child(4)');
  await waitFor("!!document.querySelector('.themes')", 4000);
  const replay = await evaluate(`
    (() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('Знакомство'));
      if (!btn) return false;
      btn.click();
      return true;
    })()
  `);
  await sleep(1800);
  check('Знакомство запускается заново', replay && (await evaluate("!!document.querySelector('.onb')")));
} catch (error) {
  check('Тест упал', false, String(error));
} finally {
  child.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify({ results, consoleErrors, failed: failed.length }, null, 2));
