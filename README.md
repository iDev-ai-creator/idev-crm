# iDev CRM

Внутренняя CRM-система для аутстаф-агентства iDev. Один сервис закрывает работу BDM и HR-команды:
клиенты, сделки, задачи, календарь, командный чат, KPI, бэклог идей и AI-ассистент поверх всего
этого.

- Продакшн: `https://crm.idev.team`
- Локально: `http://localhost:3300`
- Основной стек: Django 5 + DRF + Channels (ASGI) / React 18 + Vite + Tailwind / Postgres 16 + Redis 7

---

## Быстрый старт (локально)

Требуется Docker Desktop.

```bash
# 1. клонируй репо
git clone https://github.com/iDev-ai-creator/idev-crm.git
cd idev-crm

# 2. создай .env (в .gitignore, каждый держит свой)
cp .env.example .env   # если примера ещё нет — заведи по ключам из docs/ARCHITECTURE.md
# отредактируй значения: DB_PASSWORD, DJANGO_SECRET_KEY, ANTHROPIC_API_KEY, HH_CLIENT_ID и т.д.

# 3. подними стэк
docker compose up -d --build

# 4. дождись миграций и фикстур
docker compose logs -f backend   # ищи "Listening on TCP address 0.0.0.0:8000"
```

Открой `http://localhost:3300`. Стартовый логин берётся из `fixtures/initial_data.json`
(`admin@idev.team` / см. фикстуру). Либо в dev-режиме можно включить `BYPASS_AUTH=1` в `.env`
и попасть в систему без логина.

---

## Архитектура в одном экране

```
Browser (React SPA, Vite build)
          │
          ▼
┌─────────────────────┐
│ nginx :3300 → :80   │   multi-stage Docker: Vite build → nginx:alpine
│  /            dist/ │
│  /api/* ─┐          │
│  /ws/*  ─┼── backend│
│  /media/*┘          │
└─────────────────────┘
          │
          ▼
┌─────────────────────┐       ┌────────────┐     ┌────────────┐
│ backend :8000       │◄─────►│ Postgres 16│     │  Redis 7    │
│ Django 5 + DRF      │       │  idev_crm  │     │  channels   │
│ Channels (ASGI)     │       └────────────┘     └────────────┘
│ Daphne              │
└─────────────────────┘
          │
          ▼
 async daemons: HH import · EGRUL enrichment · Claude/LLM · website scraping
```

Подробнее: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — таблица сервисов, список Django-apps,
модели данных, WebSocket-каналы, деплой-процесс.

---

## Структура репозитория

```
idev-crm/
├── backend/                 # Django 5 + DRF + Channels
│   ├── apps/
│   │   ├── ai/              # Claude/LLM обёртки, саммари сделок, авто-драфты писем, sentiment
│   │   ├── backlog/         # бэклог идей (kanban)
│   │   ├── calendar/        # события, напоминания, busy-слоты
│   │   ├── chat/            # командный чат (WebSocket), вложения, пины, форварды
│   │   ├── clients/         # Client, Contact, RateCard, ClientNote, async-sync из HH/EGRUL
│   │   ├── deals/           # сделки, этапы, renewals, документы
│   │   ├── dashboard/       # агрегаты, profitability roll-up, глобальный поиск
│   │   ├── events/          # календарные события (интеграция с задачами/сделками)
│   │   ├── favorites/       # избранное для сущностей
│   │   ├── kpi/             # KPI-карточки и цели
│   │   ├── users/           # кастомный User, JWT, команды, роли
│   │   └── webhooks/        # входящие/исходящие вебхуки
│   ├── config/              # settings, urls, asgi, wsgi
│   ├── fixtures/            # seed data
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                # React 18 + Vite + Tailwind + dnd-kit
│   ├── src/
│   │   ├── api/             # axios-клиенты на каждый бэкенд-модуль
│   │   ├── components/      # UI-блоки (layout, chat, deals, clients, ai, search, settings)
│   │   ├── pages/           # Dashboard, Clients, Deals, Tasks, Chat, Calendar, KPI, Backlog, …
│   │   ├── stores/          # zustand (auth, ui, favorites)
│   │   ├── hooks/           # useChatSocket и т.п.
│   │   └── i18n/locales/    # ru.json, en.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── Dockerfile
│
├── idev-ui/                 # внутренний дизайн-система (tokens + компоненты)
├── docs/
│   ├── ARCHITECTURE.md      # топология, модели, потоки данных
│   ├── FEATURES.md          # фичи в текущем состоянии
│   ├── API.md               # REST/WebSocket API
│   └── releases/            # RELEASE_DD_MM.md — список изменений по дням
├── testMe/                  # TITAN E2E/visual-regression сценарии (Playwright + Claude)
├── requirements/            # бриф-документы, промпты, скриншоты ТЗ
├── nginx.conf               # reverse-proxy конфиг (api / ws / media)
└── docker-compose.yml
```

---

## Что умеет (кратко)

Полный список — [`docs/FEATURES.md`](docs/FEATURES.md). Крупные блоки:

- **Dashboard** — KPI-карточки, воронка, топ-менеджеры, просроченные задачи, Next Best Action от AI.
- **Clients** — список с ИНН, risk-бейджами, фильтрами, bulk-actions, CSV-импортом, async-enrichment из HH/EGRUL и парсингом сайта клиента.
- **Client detail** — Overview, Contacts, Deals, Tasks, Documents (с превью картинок), Knowledge base (заметки/созвоны/решения), Rate cards (ставки и маржа по ролям).
- **Deals** — Kanban + list + renewals (сделки с `end_date` в ближайшие 60 дней, цветовая индикация).
- **Tasks** — задачи с привязкой к клиенту/сделке, due-дедлайны, overdue-подсветка.
- **Calendar** — недельный/месячный вид, события/напоминания/busy, drag-and-drop между днями и временем, Apple-style drag-to-create (зажать ЛКМ на пустом слоте → тянуть → создать событие на выделенный диапазон), resize события за нижний край.
- **Chat** — командный чат на WebSocket, вложения (multipart), inline-превью картинок с lightbox, emoji-picker, упоминания, форварды, пины.
- **Backlog** — kanban-бэклог идей (Идеи / В работе / Тестирование / Готово), приоритеты, голоса, комментарии, drag-and-drop между колонками, responsive grid layout.
- **KPI** — цели и факт по менеджерам.
- **AI-ассистент** — Claude-powered: сводки по сделкам, авто-драфты писем (4 пресета), анализ тональности чата, обогащение лида по домену, next-best-action на дашборде.
- **Cmd+K / Ctrl+K** — глобальный поиск по клиентам/сделкам/задачам.
- **Избранное** (звёздочка), **i18n** (RU/EN), **темы** (light / dark / auto по OS).

---

## Переменные окружения

`.env` лежит в `.gitignore` и не попадает в репозиторий. Минимальный набор ключей:

```env
# Database
DB_NAME=idev_crm
DB_USER=postgres
DB_PASSWORD=postgres

# Django
DJANGO_SECRET_KEY=change-me
DJANGO_DEBUG=1
ALLOWED_HOSTS=localhost,127.0.0.1,crm.idev.team

# Auth / Dev
BYPASS_AUTH=0            # 1 — логин не требуется (только локально)

# Sentry (опционально)
SENTRY_DSN=

# AI
ANTHROPIC_API_KEY=sk-ant-…
DEEPSEEK_API_KEY=sk-…    # опциональный дешёвый LLM fallback

# Интеграции
HH_CLIENT_ID=
HH_CLIENT_SECRET=
```

Полный список ключей — в `backend/config/settings/base.py` (поиск по `os.environ.get`) и в
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#environment).

---

## Типовые команды

```bash
# Полный rebuild фронтенда (после правок frontend/*)
docker compose up -d --build nginx

# Перезапуск только backend (после правок backend/*, миграций)
docker compose up -d --build backend

# Миграции вручную
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate

# Создать суперюзера
docker compose exec backend python manage.py createsuperuser

# Логи
docker compose logs -f backend
docker compose logs -f nginx

# Перезагрузить фикстуры
docker compose exec backend python manage.py loaddata fixtures/initial_data.json

# Тесты (pytest)
docker compose exec backend pytest

# E2E (TITAN, отдельный репозиторий)
# см. /Users/kuznetsov/Projects/Personal projects/titan
```

---

## Деплой

Деплой — строго через GitHub Actions (никаких ручных `scp` / `rsync`). Workflow живёт в
`.github/workflows/`. Триггер — push в `main`. На сервере:

1. Pull git-репозитория.
2. `docker compose up -d --build`.
3. Миграции выполняются на старте backend-контейнера.

Продакшн-домен: `crm.idev.team` (порт 3300 проксирован внешним Caddy на 80/443).

Release notes на каждое развёртывание лежат в [`docs/releases/RELEASE_DD_MM.md`](docs/releases/).

---

## Полезные ссылки

- **Архитектура в деталях** → [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Фича-лист** → [`docs/FEATURES.md`](docs/FEATURES.md)
- **REST/WebSocket API** → [`docs/API.md`](docs/API.md)
- **Release notes** → [`docs/releases/`](docs/releases/)
- **E2E-сценарии для TITAN** → [`testMe/howTestMe.yaml`](testMe/howTestMe.yaml)
- **Связанные проекты iDev**: `idev-hr` (HR-portal), `idev-hr-bot` / `idev-request-bot` (Telegram),
  `idev-website` (лендинг), `idev-ui` (дизайн-система, используется этим репо как workspace-пакет).
