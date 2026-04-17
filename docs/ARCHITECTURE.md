# iDev CRM — Architecture

Internal CRM for the iDev outstaff agency. Production domain: `crm.idev.team`.
Local stack: `docker compose up -d` → `http://localhost:3300`.

## High-level topology

```
                          ┌───────────────────────────┐
 Browser (React SPA)────► │ nginx (port 3300 → 80)    │
                          │  /            → dist/     │
                          │  /api/*       → backend   │
                          │  /ws/*        → backend   │
                          │  /media/*     → backend   │
                          └─────────┬─────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  │ backend (Daphne ASGI, :8000)      │
                  │  Django 5 + DRF + Channels         │
                  └─┬──────────┬──────────────┬───────┘
                    │          │              │
                    ▼          ▼              ▼
          ┌──────────────┐ ┌────────┐ ┌──────────────────────┐
          │ Postgres 16  │ │ Redis 7│ │ daemon threads        │
          │ idev_crm     │ │ chans  │ │ _perform_sync(...)    │
          └──────────────┘ └────────┘ │   EGRUL · HH · LLM    │
                                      │   website scraping    │
                                      └──────────────────────┘
```

### Services (docker-compose.yml)

| Service | Image / build | Role |
|---------|---------------|------|
| `db` | `postgres:16-alpine` | Primary datastore. Exposed on `:5433`. |
| `redis` | `redis:7-alpine` | Channels layer + future cache. |
| `backend` | `./backend/Dockerfile` | Django + Daphne ASGI (`config.asgi:application`) on `:8000`. Runs migrations, loads `fixtures/initial_data.json`, then serves. |
| `nginx` | `./frontend/Dockerfile` | Multi-stage: Vite build → static `dist/` served by `nginx:alpine`. Reverse-proxies `/api/`, `/ws/`, `/media/` to `backend`. |

Volumes: `postgres_data` (DB), `media_data` (shared between backend uploads and nginx static serving).

## Backend

Django project lives under `backend/config/`. Apps:

| App | Purpose |
|-----|---------|
| `users` | Custom user model, JWT (SimpleJWT), team, role. |
| `clients` | Client, Contact, ClientDocument, ClientNote, RateCard, webhook + async-sync pipeline. |
| `deals` | Deal, DealNote, DealTask, pipeline stages, renewals filter. |
| `tasks` | Standalone tasks, reminders, due-date filters. |
| `chat` | Channel, ChatMessage (text + attachments), ChatMention — Channels (WebSocket) and REST. |
| `calendar` | CalendarEvent (all-day + time-bound), drag/resize-friendly serializer. |
| `ai` | LLM dispatcher + feature views (deal summary, lead enrich, candidate match, transcript, sentiment). |
| `bench` | Outstaff bench roster, availability flags. |
| `webhooks` | Outbound webhook endpoints, HMAC-signed dispatcher, signals. |

### AI provider abstraction

`apps/ai/client.py` — `call_claude(system, user, model='', max_tokens=1024)` selects
the provider from env at runtime:

| Provider | Trigger env | Model default |
|----------|-------------|---------------|
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` |
| DeepSeek | `DEEPSEEK_API_KEY`, `AI_PROVIDER=deepseek` | `deepseek-chat` |
| OpenAI-compat | `OPENAI_API_KEY` (+ optional `OPENAI_BASE_URL`) | `gpt-4o-mini` |
| Gemini | `GOOGLE_API_KEY` | `gemini-2.0-flash` |
| Stub | nothing configured | returns canned text (dev-only) |

All HTTP calls go through the OpenAI-compatible SDK (`openai==1.58.1`,
`httpx==0.27.2`) except Anthropic which uses the native SDK.

`_language_instruction(user)` reads `request.user.language` and appends
`"CRITICAL: Write in Russian/English only."` to every system prompt so AI
outputs match the UI locale.

### RU company pipeline

`apps/ai/ru_company.py`:

- `fetch_egrul(inn)` → free public endpoint `https://egrul.itsoft.ru/<inn>.json`.
  Response is XML-as-JSON nested under `СвЮЛ` (companies) or `СвИП` (sole
  proprietors). Helpers walk the tree and extract: `name_short`, `name_full`,
  `ogrn`, `kpp`, `registration_date`, `address` (concatenated from
  `СвАдрЮЛФИАС`), `director.{full_name, position}`, `okved_main`/`okved_additional`,
  `founders[]`, `status`.
- `fetch_dadata_financials(inn)` → Dadata Suggestions API. Requires
  `DADATA_API_KEY`. Returns `employees`, `revenue_rub`, `net_profit_rub`,
  `tax_report_year`, `branch_count`, `credit_risk`.

`apps/ai/hh.py::suggest_employers(query, limit=10)` uses the public
`/suggests/employers` endpoint (official OAuth `/employers` search is gated).

### Async client sync

`apps/clients/sync.py::enqueue_sync(client_id)` starts a `daemon=True` thread
running `_perform_sync`. The thread:

1. Writes `sync_status=in_progress`.
2. If `tax_id` is set → call `fetch_egrul`, `fetch_dadata_financials`.
3. If `website` is set → `_fetch_company_pages` (up to 5 candidate paths such
   as `/`, `/contact`, `/about`, `/team`) → LLM-assisted
   `_extract_contacts` (strips `svg/script/style`, regex-scrapes
   `mailto:`, `tel:`, LinkedIn handles, social links).
4. HH.ru `suggest_employers` by company name.
5. Auto-creates `Contact` rows for any CEO found in EGRUL + verified e-mails.
6. Writes `sync_status=done|failed`, `last_synced_at`, `sync_data` JSON.

Why not Celery: the pipeline is short (a few seconds to ~15s worst case), the
app already runs inside Daphne with enough threads, and we avoid a dedicated
broker process for now. Revisit if concurrent syncs exceed 10/min.

### Risk scoring

`apps/clients/risk.py`:

- `validate_tax_id(tax_id, country='RU')` — RU rule: 10 or 12 digits after
  normalization. Extensible per country.
- `compute_risk(client)` — explainable factor list. Starter weights:
  `missing_tax_id +30`, `duplicate_tax_id +40`, `no_decision_maker +20`,
  `no_contacts +15`, `no_website +5`. Level mapping: `<20 low`, `<50 medium`,
  `<80 high`, `else critical`.
- `apply_risk(client, force=False)` persists score/level/factors unless
  `client.risk_overridden` is true (manual override is respected until
  `/risk/override/{clear: true}` or `/risk/recalc/?force=1`).

### Webhooks

`apps/webhooks/` — `WebhookEndpoint(name, url, events[], secret, active)` plus
`WebhookDelivery` log. `dispatcher.dispatch(event, payload)`:

1. Finds active endpoints whose `events` list contains the event.
2. POSTs JSON with header `X-iDev-Signature: sha256=<HMAC(secret, body)>`.
3. Writes the `WebhookDelivery` row (response status, elapsed ms, retries).

Django signals fire on `post_save` of Deal / Client / Task.

## Frontend

- React 19 + Vite 8 + TypeScript 6 + Tailwind 4.
- State: Zustand stores per domain (`useAuthStore`, `useClientsStore`, etc.).
- Routing: `react-router` v7 with lazy-loaded pages and a `RequireAuth` guard
  (toggled off when `VITE_BYPASS_AUTH=true`).
- i18n: `react-i18next` with `ru.json` / `en.json` in
  `frontend/src/i18n/locales/`. `savedLang` read from `localStorage`.
- Drag: `dnd-kit` for Kanban; calendar uses custom pointer-event handlers
  (`bindEventPointerDrag`, `bindEventPointerResize`) tied to `HOUR_HEIGHT = 64`.
- Charts: `recharts`.
- Shared UI atoms: `idev-ui` (local file: dependency).

### Notable components

| Path | Purpose |
|------|---------|
| `components/clients/SyncPanel.tsx` | Client-detail auto-sync card. Polls every 2s until `sync_status` resolves. |
| `components/ai/LeadEnrichModal.tsx` | Wide AI profile modal with HH.ru autocomplete + raw domain fallback. |
| `components/clients/RiskBadge.tsx` | Pill badge with colour per risk level and numeric score. |
| `components/layout/Sidebar.tsx` | Navigation with absolute-positioned active indicator (not border-r). |
| `pages/CalendarPage.tsx` | 08:00–21:00 week grid, `data-testid="event-<id>"`, `resize-<id>`, `now-line`. |

### Auth flows

- Local dev: `DJANGO_BYPASS_AUTH=true` issues an admin JWT on the first call,
  so the SPA is always authenticated. No `/login` round-trip.
- Production: classic SimpleJWT (`/api/auth/login/`, `/api/auth/refresh/`),
  token persisted in `localStorage`.

## Observability and ops

- Release notes live in `docs/releases/RELEASE_DD_MM.md`. Every non-trivial
  change lands one.
- E2E tests live in `testMe/` (see `testMe/howTestMe.yaml`). Run via the
  TITAN framework:
  ```bash
  cd ~/Projects/Personal\ projects/titan
  python -m cli test --system config/systems/idev-crm.yaml --scenario idev-crm
  ```
- Media storage is a Docker named volume (`media_data`) shared between the
  backend and nginx. On disk rotation, mount it to S3-compatible storage.
- LLM cost control: DeepSeek by default (~10× cheaper than Anthropic).
  Switch providers by setting `AI_PROVIDER` + the matching API key; no code
  change required.

## Open questions / planned work

- SPARK / Kontur.Focus integration (gated on a commercial key, hooks already
  stubbed in `ru_company.py`).
- Fully i18n-ed `TasksPage`, `DealsPage`, `BacklogPage`, `CalendarPage`,
  `ReportsPage`, `KPIPage`, `LoginPage` (current pass covered
  `ClientDetailPage`, `Sidebar`, `Header`, `DashboardPage`, `SyncPanel`,
  `LeadEnrichModal`).
- ClientRiskAudit table — history of risk-score mutations, not just current
  state.
- LinkedIn Data API integration (key available, rate limits to be confirmed).
