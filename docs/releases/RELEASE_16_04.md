# Release 16.04.2026

## iDev CRM — Documents Upload Fix + i18n Coverage

### Bug fix: Document upload
- **Problem**: Uploading files to client Documents tab didn't work (FormData request sent with wrong Content-Type).
- **Root cause**: `axios.create({ headers: { 'Content-Type': 'application/json' } })` in `frontend/src/api/client.ts` forced JSON content-type on every request, including `multipart/form-data` uploads — browser couldn't inject the correct boundary.
- **Fix**: Removed the default `Content-Type` header. Axios 1.x now auto-detects payload type (JSON for POJO, multipart for FormData, urlencoded for URLSearchParams).

### i18n coverage for hardcoded UI strings
Locale files (`ru.json`, `en.json`) extended with missing keys:
- `common`: `saving`, `deleting`, `notAssigned`, `allGood`, `expandMenu`, `collapseMenu`, `collapse`, `lightTheme`, `darkTheme`
- `clientDetail.*`: full block for breadcrumb, tabs, LeftPanel fields, edit modal labels, documents tab

Hardcoded Russian strings replaced with `t()` calls:
- `components/layout/Sidebar.tsx` — "Свернуть", "Выйти", tooltips
- `components/layout/Header.tsx` — sidebar toggle tooltip, theme toggle tooltip
- `pages/DashboardPage.tsx` — "Не назначен" (Unassigned), "Всё в порядке" (All good)
- `pages/ClientDetailPage.tsx`:
  - LeftPanel field labels (КОМПАНИЯ, ИНДУСТРИЯ, СТРАНА, БЮДЖЕТ, САЙТ, СТЕК, МЕНЕДЖЕР, СОЗДАН)
  - Tabs (Обзор, Контакты, Сделки, Задачи, Документы)
  - Breadcrumb, "Назад", "Удалить", "Редактировать", "Удаление…"
  - Edit modal: all labels + "Отмена"/"Сохранить"/"Сохраняем…"
  - Documents tab: "N документов" (now uses i18next plural: `count_one/few/many` for RU, `count_one/other` for EN), "Загрузить файл", "Нет документов. Загрузите первый файл.", "Удалить документ?"

### Still hardcoded (not addressed in this release)
- `OverviewTab` inside `ClientDetailPage.tsx` — "ОПИСАНИЕ", "АКТИВНОСТЬ", "Всего сделок", "Открытых сделок", "Задач"
- Other pages still contain hardcoded RU: `TasksPage`, `DealsPage`, `BacklogPage`, `CalendarPage`, `ReportsPage`, `KPIPage`, `LoginPage`, `NotificationBell`, `AppLayout`, deals/Kanban

Follow-up: complete i18n sweep across remaining pages.

---

## Chat attachments + emoji picker (Telegram-like UX)

### Backend
- **Migration** `chat/0002_chatmessage_attachment_*`: added `attachment` (FileField, upload_to `chat/`), `attachment_name`, `attachment_size`, `attachment_mime` to `ChatMessage`. `text` is now `blank=True` (messages can be attachment-only).
- `ChatMessageListView` upgraded from `ListAPIView` → `ListCreateAPIView`. New `POST /api/chat/<channel_id>/messages/` accepts `multipart/form-data` with optional `text`, `attachment`, `reply_to`. After create it broadcasts the serialized message via `channels.layers.get_channel_layer().group_send(chat_<id>, ...)` so connected WebSocket clients receive it in real time.
- `ChatMessageSerializer`: new fields `attachment`, `attachment_url`, `attachment_name`, `attachment_size`, `attachment_mime`. `attachment_url` returns a **relative** path (e.g. `/media/chat/foo.png`) — absolute URIs broke when nginx forwarded `Host` without the external port.
- Same relative-URL fix applied to `ClientDocumentSerializer.get_url`.

### Frontend
- `api/chat.ts` — new `chatApi.messages.sendWithAttachment(channelId, text, file, replyTo?)` that POSTs multipart/form-data.
- `components/chat/EmojiPicker.tsx` (new) — compact inline picker with 4 tabs (Smileys / Gestures / Hearts / Objects). No external deps.
- `pages/ChatPage.tsx`:
  - Attach button (📎 icon) → opens system file picker.
  - Emoji button (smile icon) → toggles `EmojiPicker` that inserts glyphs into the input.
  - Pending-attachment preview bar above the input: thumbnail for images, file-card for others, cancel button.
  - Image attachments render as inline thumbnails (max 260×260) inside the message; clicking opens a full-screen lightbox. Non-image attachments render as a file-card (icon + filename + size) with a download link.
  - Auto-selects the first channel on load so the chat area isn't empty.

### Image previews
- Client Documents tab (`ClientDetailPage.tsx → DocumentsTab`): detects images by filename extension (`png/jpe?g/gif/webp/bmp/svg/heic/avif`) and renders a 48×48 thumbnail instead of the generic file icon. Clicking the thumbnail opens the image in a new tab.
- Chat messages: image attachments appear as inline previews with a lightbox viewer on click.

---

## Feature batch — AI layer, iDev-specific ops, quick wins

### Quick wins
- **Cmd+K / Ctrl+K global search** (`components/search/GlobalSearch.tsx`): modal with debounced parallel queries against `/api/clients/?search=`, `/api/deals/?search=`, `/api/tasks/?search=`. Grouped results with keyboard navigation (↑↓ + Enter).
- **Favourites / starred** (`apps/favorites` Django app, `stores/favoritesStore.ts`): generic per-user entity favourites for clients / deals / tasks. `POST /api/favorites/toggle/` adds or removes. `<StarButton>` component shown on list rows and detail breadcrumbs, with optimistic toggle.
- **Dark mode auto** (`stores/uiStore.ts`): 3-state toggle — `light → dark → auto`. Auto follows `prefers-color-scheme` and reacts live when the OS flips it. Theme icon in header changes (sun/moon/half-circle auto).

### iDev-specific
- **Renewal pipeline** (`DealsPage.tsx → renewals view`): new tab next to Board/List. Shows active + signed deals whose `end_date` is within the next 60 days, colored red (≤14d), orange (≤30d), normal otherwise. Client-side filter over existing deals API, no migration needed.
- **Client knowledge base** (`apps/clients.ClientNote` model, migration `0004`): new `/clients/<id>/notes/` endpoints + "Knowledge base" tab on client detail. Supports kinds: note, meeting, call, transcript, decision. Pinning, author attribution, delete. Designed to hold Fireflies transcripts / decision logs so new BDMs can ramp up on a client without hunting across docs.
- **Rate cards per client** (`apps/clients.RateCard` model, migration `0005`): tab "Ставки" on client detail. Per-role (`BA/SA/Dev Junior/Middle/Senior/Lead/QA/DevOps/PM/Other`), unit (`monthly/hourly`), `bill_rate_usd`, `cost_rate_usd`, derived `margin_usd`/`margin_pct`. Blended summary cards at top (avg bill, avg cost, blended margin %). Color-coded margin: green ≥30%, orange ≥15%, red below.
- **Profitability roll-up** (`apps/dashboard/profitability.py`, `/api/dashboard/profitability/`): per-client estimate using `won_usd × blended_margin_pct`. Returns pipeline/won/lost totals, rate-card-derived blended rates, and estimated profit.

### AI layer (`apps/ai` Django app)
- **Claude wrapper** (`apps/ai/client.py`): `call_claude(system, user, model='claude-sonnet-4-6')`. Uses `anthropic` SDK when `ANTHROPIC_API_KEY` is set in backend `.env`; otherwise returns a deterministic stub so the UI is still clickable locally.
- **Deal summary** (`POST /api/ai/deals/<id>/summary/`): packs deal + client + notes + linked tasks into a context string, asks Claude for 3-section status (where we are / next best action / risks).
- **Auto-draft emails** (`POST /api/ai/deals/<id>/draft-email/` with `preset`): 4 presets — `follow_up`, `reminder`, `proposal_intro`, `meeting_request`. Output includes subject line + body, auto-matching deal language (RU/EN).
- **Chat sentiment** (`POST /api/ai/chat/<channel_id>/sentiment/`): analyzes last 50 messages, returns `{sentiment, score, reason, signals[], recommended_action}`. Button in chat header; result shown as a colored banner (green/orange/red) above the message list with emoji tag and cited phrases.
- **Lead enrichment** (`POST /api/ai/lead-enrich/` with `{domain}`): backend fetches the homepage (`requests` library) in the Docker container, strips tags, sends to Claude. Returns `{name, industry, description, company_size_estimate, countries, tech_stack, products, potential_outstaff_fit}`. UI: "★ AI lookup" button on `/clients` opens a modal — enter domain, get profile, one-click "Создать клиента" creates a Client record pre-filled with enriched data.
- **Next best action** (`POST /api/ai/next-best-action/`): pulls current user's open deals and tasks, asks Claude for up to 5 ranked actions with impact level (high/medium/low). Rendered as a widget at the bottom of the Dashboard with color-coded cards.

### Frontend wiring
- `components/ai/AiAssistantPanel.tsx` — unified modal on Deal detail exposing summary + 4 email presets with copy-to-clipboard and regenerate.
- `components/ai/NextBestActionWidget.tsx` — dashboard panel.
- `components/ai/LeadEnrichModal.tsx` — lookup on `/clients`.
- Chat sentiment rendered inline in `ChatPage.tsx`.

### Still TODO (from the original 21-feature list)
Not addressed in this batch — parked for follow-up sessions:
- `@mentions` in chat (needs ChatMention model + WS notification + autocomplete UI)
- Inline-edit on client/deal fields
- Bulk actions in list views (checkbox selection + bulk API)
- CSV import for clients/contacts
- Webhooks (outbound events for n8n/Zapier)
- Bench / utilization dashboard (needs HR-system integration or at least a stub)
- Resource matching on deals (depends on bench)
- Meeting transcription pipeline (Fireflies → Client KB)
- AI candidate matching (mirror idev-hr roadmap)

### Notes for deployment
- To enable real AI responses, set `ANTHROPIC_API_KEY=<key>` in `backend/.env` and restart the `backend` container. Without it, all AI endpoints return a placeholder stub.
- `anthropic==0.40.0` and `requests==2.32.3` added to `backend/requirements.txt`.

---

## Multi-provider AI, Extended Global Search, Bulk/CSV/Webhooks

### Multi-provider AI (`apps/ai/client.py`)
The Claude-only wrapper was replaced with a provider-agnostic dispatcher. The first configured provider (via env vars) is used automatically; optionally force one with `AI_PROVIDER=<name>` and override default model with `AI_MODEL=<id>`.

Supported providers (selection priority):
1. **Anthropic** (`ANTHROPIC_API_KEY`) — Claude Sonnet 4.6
2. **DeepSeek** (`DEEPSEEK_API_KEY`) — `deepseek-chat`, OpenAI-compatible, ~$0.14/M input tokens (≈10× cheaper than Sonnet), quality close to GPT-4o
3. **OpenAI-compatible** (`OPENAI_API_KEY` + optional `OPENAI_API_BASE`) — works with OpenAI, Groq (https://api.groq.com/openai/v1), Together (https://api.together.xyz/v1), OpenRouter (https://openrouter.ai/api/v1), Moonshot/Kimi (https://api.moonshot.cn/v1)
4. **Google Gemini** (`GEMINI_API_KEY` / `GOOGLE_API_KEY`) — `gemini-2.0-flash`, very cheap plus generous free tier
5. **stub** — placeholder when no key is set

Added `GET /api/ai/provider/` so the UI (or dev) can verify which backend is live.

`openai==1.54.5` and `google-generativeai==0.8.3` added to `backend/requirements.txt`.

Recommended for cost: **DeepSeek** (great quality/price) or **Gemini 2.0 Flash** (free tier + lowest paid pricing).

### Extended Global Search page (mirrors ITQ CRM pattern)
- Added `/search` route with a full-page block-based search: each block (Client / Deals / Tasks / Rate cards / Notes) has an independent toggle and its own filters; a query applies AND across enabled blocks.
- Backend schema endpoint `GET /api/dashboard/search/schema/` returns available blocks and choice enumerations so the UI can render dynamically.
- Execution endpoint `POST /api/dashboard/search/` takes `{blocks, page, page_size}`, returns `{results, count, page, page_size, warnings}` with per-client aggregates: open_deals, won_deals, won_usd, rate_cards_count, avg_bill/avg_cost, notes_count.
- Client block filters: industry / country / company_size / budget_range / status / tech_stack_contains / has_contacts.
- Deals block: status / value_op / assigned_to / expected_close range / `ending_within_days` (renewal hint).
- Tasks block: priority / status / overdue flag.
- Rate cards: role / unit / bill_rate_op.
- Notes: kind / body_contains / date_range / pinned_only.
- Sticky bottom action bar with "Сбросить" / "Искать", server-side pagination with compact Prev/Next buttons.
- Sidebar now has a "Поиск / Search" link between KPI group and Reports.

### Quick wins (batch 2)
- **Bulk actions** on `/clients`: checkbox column + select-all + floating bottom bar with "set status" dropdown, bulk delete, clear selection. Backed by `POST /api/clients/bulk/` with `{action: set_status|set_assigned|delete, ids, data?}`.
- **CSV import** on `/clients`: "CSV" button opens modal. Preview-first flow — parse CSV and validate; then confirm to create. Headers auto-mapped EN+RU (name/company/client_name/название; industry/индустрия/отрасль; country/страна; website/site/сайт; status/stage/статус; company_size/size/размер; budget_range/budget/бюджет; description/notes/описание/заметки). Endpoint: `POST /api/clients/import/` (multipart, `dry_run=1` for preview).
- **Webhooks** (`apps/webhooks`): `WebhookEndpoint` model with `{name, url, events[], secret, active}` + `WebhookDelivery` audit log. Signals on `Deal`/`Client`/`Task` post_save dispatch JSON bodies to every subscribed endpoint with optional HMAC `X-iDev-Signature: sha256=...` header. Events: `deal.created`, `deal.updated`, `deal.won`, `deal.lost`, `client.created`, `task.created`. CRUD endpoints at `/api/webhooks/endpoints/` + delivery log at `/api/webhooks/deliveries/` (backend-only UI TODO — inspect via Django admin for now).

### iDev-specific (batch 2)
- **Bench / utilization** (`apps/ai/bench.py` + `GET /api/ai/bench/`): deterministic stub roster generated from the User table (hash-based pseudo-random util %, role, skills from 10 buckets, rolloff dates). Totals include bench_count and avg_utilization_pct. Plugs into the HR integration seam when real data arrives.
- **Resource matching for deals** (`POST /api/ai/deals/<id>/resource-match/`): LLM picks top-5 consultants from the bench roster against deal tech requirements, ranking by skill overlap × low utilization. Returns `{picks: [{user_id, name, role, match_reason, skill_overlap}]}`.
- **AI candidate matching for clients** (`POST /api/ai/clients/<id>/candidate-match/`): mirrors the idev-hr roadmap — given a client profile, the LLM writes the ideal candidate spec (`role, seniority, required_skills, nice_to_have, culture_fit, sourcing_brief`). Output is a paste-ready recruiter brief for hh.ru / LinkedIn.
- **Meeting transcription** (`POST /api/ai/transcript/`): accepts a raw transcript (from Fireflies, Zoom, Teams, manual paste), returns structured `{summary, decisions, action_items[], open_questions, sentiment}`. If `client_id` is provided, the structured result is auto-saved as a `ClientNote` of kind `transcript` — so the BDM's knowledge base grows without extra clicks.

### Still TODO
- `@mentions` in chat (needs ChatMention model + WS notification + autocomplete UI) — deferred, sizable change.
- Frontend wiring for: webhooks management UI, bench dashboard, resource-match modal, candidate-match panel, transcript upload modal. The backend endpoints are live; the UI hooks would be small follow-up work in their respective pages.

---

## Language enforcement, richer Lead Enrichment, Inline-edit, ИНН + Risk scoring

### AI language enforcement
AI was answering in English even when the user's UI language was Russian. Root cause: system prompts said "match the language of the deal context", which let the model pick English when the client name was Latin. Fixed by appending a **hard directive** based on `request.user.language` (the existing User model field) to every AI system prompt. New helper `apps/ai/views._language_instruction(user)` returns `CRITICAL: Write the entire response in RUSSIAN ...` or the English variant. All endpoints (`deal-summary`, `draft-email`, `chat-sentiment`, `lead-enrich`, `next-best-action`, `resource-match`, `candidate-match`, `transcript`) now honor the user's locale.

### Lead enrichment — multi-page + contact extraction
Previously only the homepage was scraped. Now:
- `_fetch_company_pages(domain)` tries the homepage + common contact paths (`/contact`, `/contacts`, `/about`, `/about-us`, `/team`, `/our-team`, `/company`, `/impressum`, `/imprint`, `ru/contacts`, `en/contact`). Returns up to 5 pages.
- `_extract_contacts(html)` — regex signals from the raw HTML (after stripping `<svg>`/`<script>`/`<style>` blocks to kill false positives from SVG path coordinates): emails (+ `mailto:` anchors), phones (from `tel:` anchors only + `+XX ...` visible-text patterns — much stricter to avoid SVG/hash noise), LinkedIn URLs, other social URLs (FB, IG, X/Twitter, YT, TT, WA, Telegram). Junk email patterns filtered (`@sentry`, `@wix`, `noreply@`, etc.).
- LLM prompt extended: besides company profile, now returns `contacts: [{full_name, position, email, phone, linkedin, is_decision_maker}]` + `primary_email` + `primary_phone`. Regex-found emails/phones/LinkedIns are passed as "already-verified signals" in the user message so the LLM prefers them over guesses. If the LLM fails to populate `contacts`, a fallback is generated from the regex extract.
- `raw_signals` and `scraped_pages` are returned to the UI for transparency.

Frontend (`LeadEnrichModal.tsx`):
- Contacts panel shows each found person with name, position, ЛПР badge, email/phone/LinkedIn links.
- "Создать клиента" button now **also creates Contact records** (best-effort, up to 10) with role=decision_maker for marked entries; the first one is marked primary.
- RU localization: "Название", "Индустрия", "Размер", "Страны", "Стек" etc. Modal heading renamed to "AI профиль клиента".
- Collapsible "Сырые сигналы" block lists emails/phones/social URLs regex-found on the site.
- Tested against stripe.com: 5 pages scraped, `support@stripe.com`, `+1 888 926 2289`, 3 decision-maker contacts (Куртис Мойер — Ведущий менеджер по продукту, Лаура Коллинсон — Директор по финтеху, Сет МакМиллан — Менеджер по разработке).

### Inline-edit (`components/common/InlineEdit.tsx`)
Reusable component that flips between read and edit mode on click. Supports text / textarea / select / number. Commits on blur or Enter; Escape cancels. Applied on `ClientDetailPage` LeftPanel:
- `name` (text)
- `status` (select, wraps the status badge)
- `industry`, `country` (text)
- `company_size`, `budget_range` (select)
- `website` (text)
- `tech_stack` (text, splits on comma to list)

Save path goes through `clientsApi.update(id, patch)` which triggers the backend's risk recomputation (respects manual override).

### ИНН + risk scoring MVP (`apps/clients`)
Migration `0006`:
- `tax_id` (CharField) + `tax_id_country` (CharField, default 'RU').
- Uniqueness: partial unique constraint on `(tax_id_country, tax_id)` when `tax_id != ''`.
- `risk_score` (0–100), `risk_level` (`low`/`medium`/`high`/`critical`), `risk_factors` (JSON explainability), `risk_notes`, `risk_overridden` + `risk_override_by` + `risk_override_at`.

`apps/clients/risk.py`:
- `validate_tax_id(tax_id, country)` — RU: 10 or 12 digits; other countries: 6–20 digits. Returns `(ok, normalized_or_reason)`.
- `compute_risk(client)` — rule-based, explainable. Current rules with weights:
  - `missing_tax_id` (+30) — empty ИНН when status ≠ lead.
  - `duplicate_tax_id` (+40) — another client has the same ИНН in the same country.
  - `no_decision_maker` (+20) — active/signed client without a ЛПР contact.
  - `no_contacts` (+15) — zero contacts at all.
  - `no_website` (+5) — missing site.
  - Thresholds: 0–24 low, 25–49 medium, 50–74 high, 75+ critical.
- `apply_risk(client, force=False)` — persists `risk_score/level/factors`; skips silently when `risk_overridden` is set unless `force=True`.

Serializer:
- Validates `tax_id` on write. Normalizes (digits only). Saves + calls `apply_risk` on create/update.
- `ClientListSerializer` now exposes `tax_id`, `tax_id_country`, `risk_score`, `risk_level` for list view colouring.

Endpoints:
- `POST /api/clients/check-tax-id/` with `{tax_id, country?}` → `{normalized, valid, reason?, duplicates: [{id,name,status,country,industry}]}`. Used for live-hint on create.
- `POST /api/clients/<id>/risk/recalc/?force=1` — rerun rules.
- `POST /api/clients/<id>/risk/override/` with `{level?, score?, notes?}` — manual override (sets `risk_overridden`, stamps user + time). Pass `{clear: true}` to un-override and recalculate from rules.

Search/filter:
- `search_fields` on ClientListView now includes `tax_id` (так Cmd+K и обычный поиск работают по ИНН).
- `filterset_fields` adds `risk_level`.
- `ordering_fields` adds `risk_score`.

Frontend:
- `RiskBadge.tsx` — coloured pill (green/yellow/orange/red) with emoji + score.
- `ClientsPage` list: new columns "РИСК" and "ИНН".
- `ClientDetailPage`:
  - Risk badge next to the status badge in the header block.
  - New "ИНН" section with InlineEdit + metadata (country + ЮЛ/ИП label inferred from digit count).
  - Collapsible "Факторы риска" list showing each rule's weight and explanation — matches the "explainability" requirement.

Seed: bulk-recalculated all 15 existing clients. Distribution produced by the rule engine with no tax_ids set: 3 low, 7 medium, 5 high — makes the colouring visible out of the box.

### Still TODO (explicit backlog)
- `@mentions` в чате (needs ChatMention model + WS notification + autocomplete).
- Dedup / merge flow по ИНН (Phase 2+).
- ClientRiskAudit — full history of score changes (Phase 2+).
- hh.ru / ЕГРЮЛ integration — explicitly NOT in scope until legal clearance.
- UI-кнопки `Resource match` / `Candidate match` / `Transcript upload` / `Bench dashboard` / `Webhooks settings` — endpoints live, UI hook pending.

---

## Evening pass — async sync, RU company lookup, tests relocation

### Async client data sync
- `backend/apps/clients/sync.py` — `enqueue_sync(client_id)` launches `threading.Thread(target=_run_sync, daemon=True)` right after `ClientSerializer.create()`.
- `_perform_sync` stacks website enrichment (`_fetch_company_pages` + `_extract_contacts`), EGRUL lookup by ИНН (`ru_company.fetch_egrul`), HH.ru public suggest, and auto-creates `Contact` rows for the CEO found in EGRUL or emails/phones found on the site.
- Migration `clients/0007_sync_fields` adds `sync_status`, `sync_error`, `last_synced_at`, `sync_data` JSON.
- `POST /api/clients/<id>/sync/` exposes manual re-run. Response `{queued: true, client_id}`.

### RU company data pipeline
- `backend/apps/ai/ru_company.py` — `fetch_egrul(inn)` via free `egrul.itsoft.ru/<inn>.json`, `fetch_dadata_financials(inn)` via Dadata suggest (gated on `DADATA_API_KEY`).
- `_normalize_egrul` walks the XML-as-JSON under `СвЮЛ` / `СвИП` and flattens it into a friendly dict: name_short/full, ogrn/kpp, registration date, director (ФИО + должность), address (stitched from `СвАдрЮЛФИАС`), OKVED main + additional, founders.
- HH.ru autocomplete handler (`apps/ai/hh.py::suggest_employers`) — uses public `/suggests/employers` endpoint (the old `/employers` requires OAuth).

### SyncPanel UI
- `frontend/src/components/clients/SyncPanel.tsx` — renders on ClientDetail overview tab. Button "Синк" polls `/api/clients/<id>/` every 2s up to 20s until `sync_status != in_progress|pending`.
- Displays four blocks: EGRUL (name, CEO, address, OGRN/KPP, OKVED), Finance (employees, revenue via Dadata), HH.ru matches (clickable badges), enriched website profile.

### LeadEnrich modal — widened + i18n
- Width expanded to `max-w-[min(1200px,95vw)]` / `max-h-[92vh]` (previously `max-w-3xl` felt cramped on 1440×900).
- All visible strings now wrap through `react-i18next` (new `leadEnrich.*` block in `ru.json` / `en.json`): title, HH search label/placeholder, "или введите домен напрямую", result labels (Название, Индустрия, Размер, Страны, Стек, Outstaff fit), contacts section, raw signals, "Создать клиента + N контактов".

### SyncPanel — i18n
- New `sync.*` locale block (ru + en): title, subtitle, button, status pills (`statusDone`, `statusInProgress`, `statusFailed`, `statusNever`), block badges (ЕГРЮЛ / Финансы / HH.ru / Сайт), empty-state hint.
- Status badge now renders a translated label rather than the raw `in_progress` token.

### `testMe/` — tests back in the project, not in titan
- Per the titan framework spec (`titan/docs/howTestMe.md`), all scenarios must live in the target repo's `testMe/` folder. Moved all iDev CRM E2E automation there.
- `testMe/howTestMe.yaml` rewritten in English, 50 cases: 42 × UI + 5 × API + 3 × VAL. Covers dashboard, clients (list/detail/sync/modal/ИНН), LeadEnrich width + HH autocomplete + domain enrichment, deals (kanban/detail/renewals/AI), tasks, chat (emoji/attachment), calendar (grid/drag/resize/now-line), reports, backlog, settings/webhooks, language toggle, theme toggle, Cmd+K, /search blocks, sidebar nav, bench, mobile hamburger/drawer/add, tablet layout.
- `testMe/ui_test_scenarios.py` — `IdevCrmScenarios(BaseScenario)` class, `REPORT_URL="/dashboard"`, IDs mirror YAML, `run_all(only, random_n)` dispatch table with 50 bound methods.
- Titan framework doc updated (`titan/docs/howTestMe.md`) with the previously implicit `ui_test_scenarios.py` contract: required attrs (`OUTPUT_SUBDIR`, `REPORT_URL`), `run_all` signature, StepResult import, registration via `external_scenarios:` in system YAML, and explicit "tests don't go in the tool repo" section.
- Titan `scenarios/idev_crm/` reverted to its pre-extension state (8 functional tests). The project's `testMe/ui_test_scenarios.py` is the single source of truth.

### Follow-up
- `scenarios/idev_crm/main.py` (titan copy) can eventually be deleted once CI consumes only the external scenario — currently kept for backward-compat with `run.py`.
- Other pages still carry hardcoded RU; next pass: `TasksPage`, `DealsPage`, `BacklogPage`, `CalendarPage`, `ReportsPage`, `KPIPage`.

---

## HR import (partners + bench)
- New management command `python manage.py import_from_hr` (with `--partners-only` / `--bench-only` / `--dry-run`).
- Reads `persons` and `partners` tables from the idev-hr Postgres (default
  `postgresql://postgres:idev2026@host.docker.internal:5434/idev`, overridable
  via `HR_DB_URL`).
- **Partners → Client:** 66 partner companies imported. INN is taken from
  `partners.inn`, normalized (digit-only, cap at 12 — rejects compound
  values like `"7709874072/7725284024"`). Name collisions resolved
  case-insensitively. Primary `Contact` row created from
  `contact_name` / `email` / `contact_tg`.
- **Bench → BenchPerson (new model):** 63 consultants imported (status=BENCH in
  idev-hr). Fields: external_id (cuid), full name, stream (ANALYST / JAVA / ONE_C),
  grade (JUNIOR / MIDDLE / MIDDLE+ / SENIOR), rate_usd, market_rate_usd, skills[],
  stack[], experience_years, location, resume_url. Migration `clients/0008_benchperson`.
- Re-runs are idempotent — `external_id` / `tax_id` upserts in place, and
  bench people no longer in the HR bench list get `is_available=False`.

## Titan run — headless, 50 cases
- Re-pointed `config/systems/idev-crm.yaml` at `http://localhost:3300` with
  `auth.type: none` (BYPASS_AUTH) and `browser.headless: true`.
- Results: **29 PASS / 1 FAIL / 20 WARN**.
- FAIL: `TC-UI-01` — dashboard KPI card selectors expect English headers
  (`ACTIVE CLIENTS`) but the UI is now RU by default; follow-up = translate
  selector or assert RU equivalents.
- Representative WARNs:
  - `TC-UI-02` — seed companies are now overshadowed by the 66 partners we
    imported; test needs updated expectations.
  - `TC-API-*` / `TC-VAL-*` — all API tests hit 401. BYPASS_AUTH only covers
    UI requests via the auth store; direct `page.request.post` from Playwright
    bypasses the Zustand token injector. Need to either expose a dev-auth
    endpoint or inject the token into request context in `ui_test_scenarios.py`.
  - `TC-UI-09 / 10 / 11 / 12 / 13` — client detail tabs / modal inputs not
    detected with current selectors; follow-up = add `data-testid` hooks.
  - `TC-UI-30` — reports chart bars render (22 rects) but the stage labels
    are translated, breaks the English substring assertion.
  - `TC-UI-34` — no theme toggle button in the header markup.
- Report: `storage_layout/runs/e2e_2026-04-16_23-44-12/report.md`.
