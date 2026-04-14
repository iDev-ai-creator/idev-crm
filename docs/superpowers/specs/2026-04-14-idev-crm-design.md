# iDev CRM — Design Spec
**Date:** 2026-04-14  
**Status:** Approved  
**Author:** Evgeny Kuznetsov

---

## 1. Overview

A full-featured B2B CRM for iDev — an outstaffing IT company. Built as an internal tool and sold as a white-label product (one deployment per client). Replaces ad-hoc tools with a unified system for managing client relationships, sales pipelines, internal tasks, team chat, and reporting.

**Languages:** Russian + English (i18next, user-selectable)  
**Deployment:** Per-client Docker Compose instance via GitHub Actions CI/CD  
**Not in scope:** Integration with idev-hr HR system (future milestone)

---

## 2. Architecture

### Approach
Greenfield project. ITQ CRM (`/Users/kuznetsov/Projects/ITQ/crm`) used as pattern reference only — no code forking. idev-ui design system (`/Users/kuznetsov/Projects/iDev/idev-ui`) consumed as npm package `@idev/ui`.

### Project location
`/Users/kuznetsov/Projects/iDev/idev-crm`

### Structure
```
idev-crm/
├── backend/                  # Django 5 + DRF + SimpleJWT
│   ├── apps/
│   │   ├── users/            # Auth, roles, employees
│   │   ├── clients/          # Companies (primary entity)
│   │   ├── contacts/         # People at companies
│   │   ├── deals/            # Sales pipeline (Kanban)
│   │   ├── tasks/            # Task management
│   │   ├── chat/             # WebSocket real-time chat
│   │   ├── email_integration/ # SMTP/IMAP email accounts
│   │   ├── reports/          # Analytics & reports
│   │   ├── dashboard/        # KPI dashboard
│   │   └── backlog/          # Product backlog (ideas)
│   ├── core/                 # Settings, base models, utils
│   └── manage.py
├── frontend/                 # React 19 + Vite + Tailwind CSS
│   ├── src/
│   │   ├── pages/
│   │   ├── components/       # Local components built on idev-ui tokens
│   │   ├── api/              # Axios client with JWT auto-refresh
│   │   └── i18n/             # RU + EN translations
│   └── package.json
├── docker-compose.yml        # postgres + redis + backend + frontend + nginx
└── .github/workflows/        # CI/CD: test → build → deploy via SSH
```

### Infrastructure
- **Database:** PostgreSQL 16
- **Cache / WebSocket broker:** Redis 7
- **File storage:** Django FileField → local volume (MinIO can be added later)
- **Error tracking:** Sentry (both frontend and backend)
- **Email dev:** Mailpit; production: SMTP credentials per deployment

---

## 3. Data Model

### Users & Roles
```
Role: name, permissions (booleans: can_manage_users, can_view_reports, can_manage_deals, ...)
  Presets: Admin / Sales Manager / Recruiter / Viewer

User: email, first_name, last_name, avatar, language (ru|en), role (FK→Role), is_active
Employee: user (1:1), position, department, manager (self-FK→Employee)
SalesPlan: employee (FK), period_start, period_end, target_amount_usd, scope (personal|department|company)
```

### Clients & Contacts (CRM Core)
```
Client:
  name, industry, website, country, company_size (1-10|11-50|51-200|200+)
  status: lead | prospect | active | paused | churned
  tech_stack (ArrayField), budget_range, currency
  assigned_to (FK→User), created_by (FK→User)
  description, created_at, updated_at

Contact:
  first_name, last_name, email, phone, position, linkedin
  client (FK→Client), is_primary
  language_pref (ru|en), notes
```

### Deals (Outstaffing Pipeline)
```
Deal:
  title, client (FK→Client), assigned_to (FK→User), created_by (FK→User)
  status: new_lead | discovery | proposal | negotiation | signed | active | closed | lost
  value_usd, probability (0-100)
  team_size_needed (int), tech_requirements (ArrayField)
  start_date, end_date, expected_close_date
  description, order (int, for Kanban drag-drop)

DealNote:
  deal (FK→Deal), author (FK→User)
  text, created_at, updated_at, is_deleted (soft delete)

DealAttachment:
  deal (FK→Deal), file, uploaded_by (FK→User), created_at
```

### Tasks
```
Task:
  title, description
  assigned_to (FK→User), created_by (FK→User)
  priority: low | medium | high | urgent
  deadline (datetime), status: todo | in_progress | done
  linked_client (FK→Client, nullable)
  linked_deal (FK→Deal, nullable)
  created_at, updated_at
```

### Chat
```
ChatChannel: type (direct|group), name, members (M2M→User), created_at
ChatMessage:
  channel (FK→ChatChannel), author (FK→User)
  text, reply_to (self-FK→ChatMessage, nullable)
  is_edited, created_at, updated_at
ChatAttachment: message (FK→ChatMessage), file, created_at
ChatReaction: message (FK→ChatMessage), user (FK→User), emoji
```

### Email Integration
```
EmailAccount: user (FK→User), email, smtp_host, smtp_port, imap_host, imap_port,
              username, password (encrypted), use_ssl
EmailTemplate: name, subject, body (supports {{client_name}}, {{contact_name}}, {{deal_title}})
EmailMessage: account (FK→EmailAccount), subject, body, to_email,
              linked_client (FK, nullable), linked_deal (FK, nullable),
              sent_at, direction (incoming|outgoing)
```

### Backlog & Notifications
```
BacklogItem:
  title, description, status: idea | in_progress | testing | done
  author (FK→User), votes (int), order (int)
BacklogComment: item (FK→BacklogItem), author (FK→User), text, created_at

Notification:
  user (FK→User), event_type, text, link, read (bool), created_at
  event_types: task_assigned, task_deadline, deal_status_changed,
               new_message, client_updated, deal_note_added
```

---

## 4. Pages & Modules

| Route | Page | Key features |
|---|---|---|
| `/dashboard` | Dashboard | KPI cards (revenue, deals, conversion), sales funnel, top managers, today's tasks |
| `/clients` | Client list | Filterable table, status badges, quick-add |
| `/clients/:id` | Client card | Tabs: Info / Contacts / Deals / Tasks / Notes / History |
| `/deals` | Deal Kanban | 8-column Kanban, drag-drop reorder, filter by manager/tech |
| `/deals/:id` | Deal card | Notes with edit/delete history, attachments, linked tasks |
| `/tasks` | Tasks | List with priority sort, deadline countdown, filter by linked entity |
| `/chat` | Chat | Left sidebar channels, message thread, reply/react, file attach |
| `/reports` | Reports | Revenue by period, funnel conversion, manager activity, overdue tasks |
| `/backlog` | Backlog | 4-column Kanban for ideas, voting, comments |
| `/settings` | Settings | Users & roles, email accounts, sales plans, company info |

---

## 5. API Structure

RESTful Django REST Framework. Auth: `POST /api/token/` → JWT pair, `POST /api/token/refresh/`.

Key endpoint groups:
- `GET|POST /api/clients/` — list/create, filterable
- `GET|PATCH|DELETE /api/clients/:id/` — detail
- `GET|POST /api/deals/` — list/create
- `POST /api/deals/reorder/` — Kanban drag-drop
- `POST /api/deals/:id/notes/` — add note
- `PATCH /api/deals/:id/notes/:nid/` — edit note (with history)
- `GET|POST /api/tasks/` — list/create
- `GET /api/dashboard/stats/` — KPI data
- `GET /api/dashboard/funnel/` — stage conversion rates
- `WS /ws/chat/:channel_id/` — WebSocket chat
- `GET|POST /api/reports/` — report presets + custom

---

## 6. Design System

**Source:** `@idev/ui` npm package from `/Users/kuznetsov/Projects/iDev/idev-ui`  
**Accent:** `#fd7448` (orange)  
**Fonts:** Montserrat (headings/brand), system-ui (body)  
**Theme:** Light + Dark (CSS custom properties, localStorage persist)

Components from idev-ui used directly: Button, Input, Badge, DataTable, StatCard, ThemeToggle.

New components built in `frontend/src/components/` using idev-ui Tailwind preset:
- `KanbanBoard`, `KanbanCard` — drag-drop deals and backlog
- `ChatBubble`, `MessageInput` — chat UI
- `ClientCard`, `DealCard` — detail card layouts
- `KPIChart`, `FunnelChart` — recharts wrappers with idev-ui colors
- `NotificationBell` — badge counter + dropdown

---

## 7. Error Handling & Quality

- **Frontend:** axios interceptor with silent JWT refresh on 401; Sentry for uncaught errors; optimistic Kanban updates with rollback on API error; 404 and 500 error pages
- **Backend:** DRF exception handler returns `{error, detail, code}`; Sentry for server errors; Django signals for audit trail on deal status changes
- **WebSocket:** reconnect with exponential backoff (1s → 2s → 4s → max 30s)

---

## 8. Test Data (Fixtures)

Django fixtures providing realistic seed data:
- 5 clients (different industries: fintech, e-commerce, logistics, healthtech, gaming; mix of statuses)
- 3 employees / sales managers
- 8 deals distributed across all Kanban stages
- 3 contacts per client average
- 15 tasks (mix of priorities, deadlines, linked entities)
- 2 chat channels (1 direct, 1 group) with 30 messages including replies
- 10 backlog ideas in various stages
- Notification history for each user

---

## 9. CI/CD & Deployment

Pattern: same as idev-hr-demo — GitHub Actions on push to `main`:
1. Run Django tests + React build
2. SSH to server
3. `git pull && docker-compose up -d --build`

Environment variables managed via `.env` per deployment (not committed).
