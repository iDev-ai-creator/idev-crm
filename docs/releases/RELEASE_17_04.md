# Release 17.04.2026

## Backlog — колонки растянуты на всю ширину

### Проблема
Канбан-колонки на странице `/backlog` были фиксированной ширины `w-60` (240px) и лежали внутри `overflow-x-auto` контейнера. На широких экранах справа оставалось много пустого места, длинные заголовки идей обрезались внутри узкой карточки.

### Фикс (`frontend/src/pages/BacklogPage.tsx`)
- Обёртка: убран `overflow-x-auto` и внутренний `flex gap-4 min-w-max` → заменены на `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`.
- Колонка `BacklogColumn`: `flex-shrink-0 w-60 flex flex-col` → `flex flex-col min-w-0`.
- Результат: 1 колонка на мобилке, 2 на планшете, 4 на десктопе — без горизонтального скролла, колонки равномерно заполняют доступную ширину, заголовки карточек больше не обрезаются.

Drag'n'drop (`dnd-kit`) продолжает работать внутри grid.

Коммит: `c605750`

---

## Calendar — фиксы drag-and-drop + Apple-style drag-to-create

### Баг 1: Событие не перемещается по горизонтали (между днями)
**Причина**: карточка события использовала `translate3d(0, ${dy}px, 0)` — только вертикальное смещение. Когда пользователь тащил карточку в соседний день, визуально она оставалась в исходной колонке. Плюс `document.elementsFromPoint` в момент drop натыкался на саму карточку и `closest('[data-calendar-day]')` возвращал оригинальный день — горизонтальное перемещение не срабатывало вообще.

**Фикс** (`frontend/src/pages/CalendarPage.tsx` → `bindEventPointerDrag`):
- `translate3d(0, ${dy}px, 0)` → `translate3d(${dx}px, ${dy}px, 0)` — карточка теперь визуально следует за курсором по обеим осям.
- После превышения порога сдвига (5px) на карточке включается `pointer-events: none`, чтобы `elementsFromPoint(clientX, clientY)` при drop видел day-column под курсором, а не оригинальную карточку.
- На `mouseup` состояние `pointer-events` сбрасывается.

### Баг 2: `translate3d` без X → элемент не показывает день, куда он уедет
Решено тем же фиксом: теперь визуальный preview карточки привязан к текущей позиции курсора, а итоговая колонка определяется корректно.

### Фича: Apple Calendar-style drag-to-create

Раньше создать событие можно было только:
- двойным кликом по пустому слоту (открывался модал с дефолтным диапазоном +1 час);
- через кнопку «Новое событие» в тулбаре.

Теперь — как в macOS Calendar:
1. Зажимаешь ЛКМ в пустой зоне дня.
2. Тянешь вниз/вверх — появляется ghost-прямоугольник с живой подписью `HH:MM – HH:MM` (акцентный оранжевый цвет, 15-минутная сетка).
3. Отпускаешь — открывается модал создания события с проставленными `start_datetime` и `end_datetime` точно по выделению.

**Реализация**:
- `timeFromRelY(relY: number)` — новая чистая функция преобразования пиксельного offset внутри день-колонки в `HH:MM` с 15-минутным snap'ом (старая `timeFromSlotPointer` теперь обёртка над ней).
- `bindSlotPointerDragCreate(down, ymd)` — обработчик `onMouseDown` на day-column. Игнорирует клики внутри `.event-card` и `.resize-handle`. Добавляет глобальные `mousemove`/`mouseup` listeners, держит React-state `selectionDrag = { ymd, startRelY, currentRelY }`.
- Ghost-div рендерится внутри колонки при `selectionDrag.ymd === ymd` — абсолютно позиционирован, `pointer-events: none`, с live-подписью времени.
- Порог активации — 4px (меньший drag считается обычным кликом и не создаёт событие → не ломает существующий `onDoubleClick`).
- На `mouseup` вызывается `onSlotDoubleClick(ymd, startTime, endTime)` — сигнатура callback'а расширена опциональным третьим параметром.

**Типы / модель**:
- `interface CreateModal` → добавлено поле `endTime?: string`.
- `CreateEventModal` использует `initial.endTime`, если передан, иначе как раньше — `startTime + 1h`.
- `handleSlotDoubleClick` в `CalendarPage` прокидывает `endTime` в `setCreateModal`.

Коммит: `870ebaf`

---

## Git hygiene — `.env` untracked

`.env` уже лежал в `.gitignore`, но был добавлен в индекс до появления правила. Выполнен `git rm --cached .env` — файл удалён из репозитория, но остался локально. Теперь секреты из `.env` не попадают в коммиты и в origin.

Коммит: `870ebaf` (помечен как `D  .env`).

---

## Bulk commit — накопленная работа из прошлых сессий

Коммит `870ebaf` заодно зафиксировал 183 файла накопленной несвязанной работы (до текущей сессии): новые backend apps (`ai/`, `calendar/`, `events/`, `favorites/`, `kpi/`, `webhooks/`), новые страницы (`CalendarPage`, `KPIPage`, `BenchPage`, `GlobalSearchPage`), миграции `clients/0002..0008`, `chat/0002..0003`, `deals/0002`, доки (`docs/API.md`, `docs/ARCHITECTURE.md`, `docs/FEATURES.md`), тесты (`testMe/`).

Содержимое этих фичей уже описано в RELEASE_14_04 / 15_04 / 16_04 — текущий коммит только зафиксировал их в git после untracked-состояния.

---

## Round 2 — после code review (Code Reviewer + AI Orchestrator)

Двойной независимый ревью выявил критические баги в первоначальной реализации. Все исправлены в этом же релизе.

### Blocker fixes

**C1 — grab-offset bug («ставлю на 15, прилетает на 20»)**
`dMin` рассчитывался как `round(dy / HOUR_HEIGHT * 4) * 15` — снэпалась *delta* курсора, не *destination*. При захвате события в произвольной точке внутри карточки результат расходился со строкой, куда пользователь тянул.
**Фикс**: на `mousedown` фиксируется `grabOffsetY = down.clientY - cardRect.top`. В `finish`:
```
newTopPx   = me.clientY - colRect.top - grabOffsetY
snappedMin = round(newTopPx / HOUR_HEIGHT * 4) * 15  // destination-snap
newStart   = targetDay 08:00 + snappedMin min
```

**C2 — `ymdUnderPointer` хитил саму dragged карточку**
`document.elementsFromPoint` возвращает элементы независимо от `pointer-events: none`. Dragged card стояла первой в списке → `closest('[data-calendar-day]')` → origin column → горизонтальный drag всегда оставался на исходном дне.
**Фикс**: переписал `ymdUnderPointer` через `document.elementFromPoint` (singular, уважает `pointer-events: none`). Теперь dragged card прозрачна для hit-test, колонка под курсором определяется корректно. Плюс сброс `pointerEvents` отложен ДО после запроса.

**C3 — listener leak на unmount**
Все три handler'а (`bindEventPointerDrag`, `bindEventPointerResize`, `bindSlotPointerDragCreate`) вешали `document.addEventListener` без cleanup. Unmount во время drag → дохлые подписки.
**Фикс**: единый `activeDragCleanupRef = useRef<() => void | null>()` + `useEffect(() => () => cleanup())` на unmount. Каждый handler использует `AbortController` с `{ signal }`, старт нового drag отменяет предыдущий.

**C4 — stale rect в drag-to-create**
`columnEl.getBoundingClientRect()` кэшировался на `mousedown` — скролл/ресайз во время drag ломал координаты.
**Фикс**: rect читается через `relAt(clientY)` на каждом `move` и `finish`, с клэмпом к границам колонки (`0..HOUR_HEIGHT * 14`).

**C7 — scroll-reset на каждом изменении events**
`useEffect(..., [weekDays, events])` после успешного drag дёргал `el.scrollTop` обратно к «сейчас / earliest».
**Фикс**: зависимость только от `weekKey = toYMD(weekDays[0])`, плюс `scrolledForWeekRef` гарантирует один reset на смену недели. Mutations из drag/create/resize больше не прыгают view.

### Follow-up fixes (тоже в этом же релизе)

- **Escape cancels**: отдельный `keydown` listener во всех трёх handler'ах — отменяет текущий drag без commit.
- **`data-testid="selection-ghost"` + `role="presentation"` + `userSelect: none`** — для TITAN и a11y.
- **Backend validator** (`backend/apps/calendar/serializers.py → validate()`): `end_datetime > start_datetime` на create и partial update. Если PATCH трогает только end — сравнивает с существующим start из instance. `null` end (напоминания / busy без конца) разрешён.
- **DragOverlay в backlog**: `w-60` → `w-[min(90vw,18rem)]` — на мобилке не торчит за экран.
- **Cleanup**: удалены `dragRef`, `resizeRef`, `shiftDateByDays`, `dayDiffYmd`, `clampToVisibleGrid`, мёртвая ветка `pointercancel`, `pointerId: 0`.

---

## Timezone round-trip fix

**Симптом**: создаёшь событие 14:00–15:00, после сохранения рендерится как 17:00 (+3ч от Кипра).

**Причина**:
- Django: `TIME_ZONE='UTC'`, `USE_TZ=True`.
- Frontend слал `2026-04-17T14:00:00` (naive, без offset).
- Django интерпретировал как UTC → хранил 14:00 UTC → сериализатор отдавал `2026-04-17T14:00:00Z` → `new Date(...Z)` в JS → в локали Cyprus (+3) показывал 17:00.

**Фикс** (`CalendarPage.tsx`):
- Новая `localOffsetSuffix(d)` → возвращает `+03:00` для Кипра.
- `formatLocalDatetime(d)` → `YYYY-MM-DDTHH:MM:SS+03:00` (было без offset).
- Новая `buildLocalDatetime(date, time)` → собирает Date в local wall-clock, форматирует с offset.
- `CreateEventModal.handleSubmit` использует `buildLocalDatetime(date, startTime)` / `buildLocalDatetime(date, endTime)` вместо naive interpolation.
- `handleEventMove` уже использует `formatLocalDatetime` — автоматически получает offset.

**Round-trip теперь**:
```
user picks 14:00 → frontend sends ...T14:00:00+03:00
                → Django stores 11:00 UTC
                → API returns ...T11:00:00Z
                → new Date(...Z) → 14:00 in Cyprus local
                → renders 14:00 ✓
```

⚠️ **События, созданные ДО этого фикса**, будут показывать +3 часа от оригинала. Открыть каждое через «Редактировать» и пересохранить — новый save уйдёт уже с offset.

---

## Event edit (клик по событию → изменение времени/описания)

Раньше popup события показывал только кнопку «Удалить» — нельзя было поменять ни время, ни описание, ни название.

**Добавлено**:
- `EventDetailPopup`: кнопка **«Редактировать»** рядом с **«Удалить»**.
- `CreateEventModal` принимает опциональный `editingEvent: CalendarEvent | null`. При передаче — pre-fill всех полей (title / type / date / startTime / endTime / description / color / all_day). Заголовок модалки переключается: «Новое событие» ↔ «Редактировать событие».
- `CalendarPage`:
  - State `editingEvent`.
  - `handleStartEdit(ev)` — закрывает popup, открывает modal в edit-режиме.
  - Единый `handleSave(payload)` — PATCH при `editingEvent`, POST при создании.
  - `onClose` modal сбрасывает и `createModal`, и `editingEvent`.

---

## Тесты (всё в `testMe/`)

### TITAN UI scenarios — `testMe/ui_test_scenarios.py` + `testMe/howTestMe.yaml`

6 новых TC-UI, все ПРОШЛИ локально:

| ID        | Что проверяет                                                                 |
|-----------|-------------------------------------------------------------------------------|
| TC-UI-43  | Backlog columns fill container width via responsive grid (ratio ≥ 70%)        |
| TC-UI-44  | Drag on empty slot → selection-ghost с `HH:MM – HH:MM` → open create modal    |
| TC-UI-45  | Event → Edit button → pre-filled modal (title + 2 time inputs + date input)   |
| TC-UI-46  | Create 14:00–15:00 → card renders '14:00 – 15:00' (no 17:00 drift)            |
| TC-UI-47  | Horizontal drag → card lands in a different `data-calendar-day`               |
| TC-UI-48  | Escape during drag-to-create cancels selection (no ghost, no modal)           |

Результат прогона:
```
TC-UI-43 PASS  cols=4 total=1104px container=1152px ratio=0.96
TC-UI-44 PASS  ghost=True label='19:30 – 21:00' time_inputs=2
TC-UI-45 PASS  title='123' times=2 dates=1
TC-UI-46 PASS  card=True text='TITAN TZ roundtrip14:00 – 15:00'
TC-UI-47 PASS  origin=2026-04-15 new=2026-04-17
TC-UI-48 PASS  ghost_mid=True ghost_after=False modal_times=0
```

### Backend pytest — `backend/apps/calendar/tests/test_calendar.py`

5 новых тестов для сериализатора:
- `test_create_event_with_offset_roundtrip` — fronted offset `+03:00` → backend UTC hour=11
- `test_end_before_start_rejected` — 400 Bad Request, поле `end_datetime`
- `test_end_equal_start_rejected` — 400 на `start == end`
- `test_patch_partial_update_uses_existing_start` — PATCH только `end_datetime` валидирует против instance start
- `test_null_end_accepted` — `end=null` (напоминания) проходит

Полный backend suite: **56 passed** in ~6s.

---

## Проверка / ручной QA

- [x] Backlog: колонки растянуты на всю ширину, отзывчивая сетка 1/2/4.
- [x] Calendar: drag между днями (C2 fixed — `elementFromPoint` singular).
- [x] Calendar: drag вверх уезжает к более раннему времени, не «улетает вниз» (C1 destination-snap).
- [x] Calendar: drag-to-create с ghost + live time label + Escape cancel.
- [x] Calendar: timezone round-trip — 14:00 создаётся и рендерится 14:00.
- [x] Calendar: клик на событие → «Редактировать» → меняй время/описание → «Сохранить» → PATCH.
