# iDev CRM — Features

Feature list at current state. Mirrors the UI and the TITAN test coverage in
`testMe/howTestMe.yaml`.

## Dashboard
- KPI cards: Active clients, pipeline value, total deals.
- Period filter (all time / month / quarter / year).
- Sales funnel stacked chart (recharts).
- Top managers leaderboard.
- Overdue tasks quick-link.

## Clients
- Paginated table with columns: name, industry, status, size, budget,
  assignee, contacts count, **ИНН**, **risk badge**.
- Search by name / industry / tax_id (used by Cmd+K too).
- Filters: `risk_level`, `status`. Ordering on `risk_score`, `created_at`,
  `name`.
- Bulk actions: assign, update status, delete.
- CSV import with dry-run preview + row-level errors.
- Per-client detail: left side panel (inline-edit of name/status/industry/
  country/size/budget/website/tech-stack), header action row with AI
  triggers, tabs: Overview, Contacts, Deals, Tasks, Documents, Notes,
  Rate cards.
- **SyncPanel** on overview: shows EGRUL block (name, director, address,
  OGRN/KPP, OKVED), Dadata finance (employees, revenue), HH.ru matches,
  AI-enriched website profile. Manual "Синк" button polls status every 2s.
- **Risk** badge + factor breakdown: each contributing rule shows weight +
  human-readable rationale. Override with notes, clear to revert.
- **ИНН validation**: debounced `check-tax-id` call surfaces "✓ valid",
  "⚠ duplicate", or "✗ invalid" inline; list of existing matches shown on
  duplicate.

## Lead enrichment (AI profile)
- Wide modal (`max-w-[min(1200px,95vw)]`) with two entry points:
  1. **HH.ru autocomplete** — debounced (400 ms) search over the public
     HH suggest API, picker auto-fills the domain.
  2. **Raw domain input** — direct "Найти" call.
- Backend fetches up to 5 candidate pages (`/`, `/contact`, `/about`,
  `/team`, `/careers`), strips `svg/script/style`, regex-scrapes emails,
  phones, LinkedIn, social, then runs LLM extraction.
- Result: company profile (name, industry, size, countries, tech stack,
  outstaff fit) + contact list with ЛПР flag + raw signals.
- "Создать клиента + N контактов" — one-click create of a Client and up
  to 10 Contact rows, best-effort.

## Deals
- Kanban (Lead → Qualified → Proposal → Negotiation → Won → Lost). Drag
  between columns via dnd-kit, PATCH on drop.
- Deal detail: timeline, notes, tasks, AI actions (Summary, Next best
  action, Draft email, Candidate match).
- "Продления" view — filters Active/Signed deals closing within 60 days.
- Renewal reminder surfaces in the dashboard overdue strip.

## Tasks
- Standalone task list with status chips, due-date filter, assignee filter.
- Status circle cycles todo → in_progress → done with optimistic UI.
- Attach to Deal or Client; overdue tasks bubble up to dashboard.

## Calendar
- Week grid 08:00–21:00, `HOUR_HEIGHT = 64px` per hour.
- Events with drag (body) and resize (bottom 8px strip).
- Now-line red indicator on today's column when within working hours.
- Auto-scroll on mount to the current hour.
- All-day stack collapses long lists to "+N ещё".
- Double-click empty slot → new-event modal.

## Chat
- Channels: DM, group, public. Sidebar shows unread counts.
- Composer: rich text, emoji picker, paperclip attachment (image/file),
  reply threading.
- Attachments delivered as multipart POST; WebSocket broadcasts the
  serialized message to the channel group.
- @mentions with autocomplete (resolves by email local-part or first name)
  — generates a `ChatMention` row per mention, drives "Mentions" tray.

## Reports
- Recharts bar chart of deals-per-stage + conversion.
- Stage labels: New Lead, Discovery, Proposal, Negotiation, Won, Lost.

## Backlog
- Internal idea voting. Click 👍 to upvote; server stores one vote per
  user. Vote counts drive ordering.

## Bench
- Outstaff roster: available people, skills, target rate, next-off-date.
- AI "Bench summary" explains who's the most marketable right now.
- Resource-match on a deal proposes bench people ranked by fit.

## Settings
- Team + roles, webhook endpoints, integration keys (stored in `.env`).
- Webhook endpoint form: name, URL, comma-separated events, HMAC secret,
  active toggle. Delivery log shown below with retries.

## Global search
- **Cmd+K** (fallback Control+K) — quick palette across clients, deals,
  tasks, notes, contacts.
- **/search** — extended page with typed blocks (Клиент / Сделки /
  Задачи / Ставки / База знаний).

## AI layer summary

| Feature | Where | Endpoint |
|---------|-------|----------|
| Deal summary | Deal detail | `POST /api/ai/deal-summary/` |
| Draft email  | Deal detail | `POST /api/ai/draft-email/` |
| Next best action | Deal detail | `POST /api/ai/next-best-action/` |
| Lead enrichment | Clients top-bar | `POST /api/ai/lead-enrich/` |
| Candidate match | Client detail | `POST /api/ai/candidate-match/` |
| Resource match | Deal detail | `POST /api/ai/resource-match/` |
| Transcript processing | Client / deal notes | `POST /api/ai/transcript-process/` |
| Chat sentiment | Chat message detail | `POST /api/ai/chat-sentiment/` |
| Bench roster | Bench page | `POST /api/ai/bench-roster/` |
| HH.ru autocomplete | LeadEnrich modal | `GET /api/ai/hh-search/` |
| EGRUL / Dadata | SyncPanel + `lead-enrich` | `GET /api/ai/ru-company/` |

## i18n
- RU and EN via `react-i18next`. Toggle in header persists to
  `localStorage.idev_crm_lang`.
- Plural forms: `count_one/few/many/other`.
- Known gaps (next sweep): `TasksPage`, `DealsPage`, `BacklogPage`,
  `CalendarPage`, `ReportsPage`, `KPIPage`, `LoginPage`.

## Accessibility, mobile, theme
- Mobile drawer triggered by `aria-label="Toggle menu"`.
- Light / dark / auto theme toggle; preference persisted.
- Keyboard shortcuts: `Cmd+K` (quick search), `Esc` (close modals),
  arrow keys on the calendar week.

## Testing
- 50 test cases in `testMe/howTestMe.yaml` (UI 42 + API 5 + VAL 3).
- Automation: `testMe/ui_test_scenarios.py` with `IdevCrmScenarios` class.
- Run via TITAN: `python -m cli test --system config/systems/idev-crm.yaml
  --scenario idev-crm`.
