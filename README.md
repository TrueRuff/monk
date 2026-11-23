# Монах — приложение для плана

Android-приложение (Capacitor + React) для плана на 6 месяцев: подтягивания, нормативы, монашеский блок.

## Что внутри

- **Сегодня** — план дня, стрик, неделя и фаза цикла, минимальный день (3 минуты), быстрые действия.
- **Тренировка** — подходы, техника, таймер отдыха, отмена подхода.
- **Монашеский блок** — таймер по шагам (Бадуаньцзинь, чжань чжуан, мабу, вакуум, вис).
- **План** — вся неделя.
- **Прогресс** — вес, живот, подтягивания, хитмап с заморозками.
- **Итоги недели** — закрытые дни, подходы, вес, заметка на следующую неделю.
- **Заморозка стрика** — 2 пропуска в месяц не рвут серию.
- **Импорт и экспорт** — полный бэкап в JSON, восстановление в режимах «заменить» и «объединить».
- **Напоминания** — локальные, без сервера (работают только в APK).

Все данные лежат на телефоне (IndexedDB), без аккаунта. Экспорт и импорт — в настройках.

## Тесты

```bash
pnpm typecheck     # типы
pnpm test          # юнит-тесты: стрик, фазы, разбор бэкапа
pnpm test:ux       # E2E через CDP: нужен запущенный превью и Edge
```

`test:ux` принимает два аргумента: адрес превью и папку для скриншотов.

```bash
pnpm build
pnpm preview --port 4182
pnpm test:ux http://localhost:4182/ ./screens
```


## Разработка

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # сборка веб-версии в dist/
```

В браузере всё работает, кроме напоминаний: они доступны только в нативной сборке.

## Сборка APK

Локально нужны JDK 21 и Android SDK. Если их нет — собирай в облаке.

### Вариант 1: GitHub Actions (ничего не ставить)

1. Создай на GitHub репозиторий `monk` (`trueruff/monk`).
2. Из папки `app`:

```bash
git remote add origin https://github.com/trueruff/monk.git
git push -u origin main
```

3. Открой вкладку **Actions** → **Build APK** → дождись зелёной галочки.
4. Внизу страницы сборки скачай артефакт `monk-debug-apk` — внутри `app-debug.apk`.
5. Перекинь APK на телефон и установи (разреши установку из неизвестных источников).

Либо через GitHub CLI:

```bash
gh repo create trueruff/monk --private --source=. --push
gh run watch
gh run download -n monk-debug-apk
```

### Вариант 2: локально

```bash
pnpm build
npx cap add android      # один раз
npx cap sync android
cd android
./gradlew assembleDebug
```

APK появится в `android/app/build/outputs/apk/debug/app-debug.apk`.

## После установки

- Открой приложение, зайди в **Я** → включи **Напоминания** и дай разрешение.
- На Xiaomi, Huawei, OPPO, vivo: настройки → приложения → Монах → **снять оптимизацию батареи**. Иначе Android убивает запланированные уведомления.
- Напоминания ставятся на 3 недели вперёд и обновляются при каждом запуске приложения.

## Структура

```
src/
  app/       — роутер, тема
  pages/     — Today, Workout, Monk, Plan, Progress, Settings
  shared/    — db, plan, notifications, streak, ui
```

## Стек

Vite · React 19 · TypeScript · Dexie (IndexedDB) · Capacitor 7 · @capacitor/local-notifications
