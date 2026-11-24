const CACHE = 'monk-v2';
const SCHEDULE_CACHE = 'monk-sched';
const SCHEDULE_URL = '/__monk_schedule.json';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE && key !== SCHEDULE_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  const isDocument = request.mode === 'navigate';

  if (isDocument) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('./'))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        }),
    ),
  );
});

// ------------------------------------------------------- напоминания из фона

async function readSchedule() {
  try {
    const cache = await caches.open(SCHEDULE_CACHE);
    const hit = await cache.match(SCHEDULE_URL);
    return hit ? await hit.json() : null;
  } catch {
    return null;
  }
}

async function writeSchedule(value) {
  try {
    const cache = await caches.open(SCHEDULE_CACHE);
    await cache.put(
      SCHEDULE_URL,
      new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } }),
    );
  } catch {
    /* не смогли сохранить — переживём */
  }
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'monk-schedule' || !Array.isArray(data.reminders)) return;
  event.waitUntil(writeSchedule({ reminders: data.reminders, fired: data.fired || {} }));
});

// Периодический фон: браузер сам решает, когда дать поработать (Android, установленное PWA).
self.addEventListener('periodicsync', (event) => {
  if (event.tag !== 'monk-reminders') return;
  event.waitUntil(runPeriodicCheck());
});

async function runPeriodicCheck() {
  const stored = await readSchedule();
  if (!stored || !Array.isArray(stored.reminders)) return;

  const now = new Date();
  const fired = stored.fired && typeof stored.fired === 'object' ? stored.fired : {};
  const due = [];

  for (const reminder of stored.reminders) {
    if (!reminder || typeof reminder.hour !== 'number' || typeof reminder.minute !== 'number') continue;
    if (reminder.weekday !== null && now.getDay() !== reminder.weekday) continue;
    const at = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      reminder.hour,
      reminder.minute,
      0,
      0,
    ).getTime();
    const late = now.getTime() - at;
    // слишком рано или безнадёжно опоздали — не показываем
    if (late < 0 || late > 90 * 60 * 1000) continue;
    const key = reminder.id + ':' + at;
    if (fired[key]) continue;
    due.push({ key, reminder });
  }

  if (!due.length) return;

  for (const item of due) {
    fired[item.key] = Date.now();
    await self.registration.showNotification(item.reminder.title || 'Монах', {
      body: item.reminder.body || '',
      tag: 'monk-' + item.reminder.id,
      icon: './icon.svg',
      badge: './icon.svg',
    });
  }

  await writeSchedule({ reminders: stored.reminders, fired });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.notification.tag === 'monk-test') return;
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(self.registration.scope);
      }),
  );
});
