# iDev CRM — API reference

Base path: `/api/`. All endpoints are JSON unless noted. Auth: Bearer JWT
(`Authorization: Bearer <access_token>`). In local dev `DJANGO_BYPASS_AUTH=true`
auto-authenticates as admin.

## Auth

| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/api/auth/login/` | `{email, password}` | `{access, refresh, user}` |
| POST | `/api/auth/refresh/` | `{refresh}` | `{access}` |
| GET  | `/api/auth/me/` | — | `{id, email, full_name, role, language, ...}` |
| PATCH | `/api/auth/me/` | `{language?, full_name?, ...}` | updated user |

## Clients

### List / create

- `GET /api/clients/?search=&risk_level=&ordering=&page_size=` — paginated.
  Searches `name`, `industry`, `tax_id`.
- `POST /api/clients/` — create. Minimum payload: `{name: string}`. All other
  fields (`industry`, `website`, `country`, `company_size`, `budget_range`,
  `description`, `tax_id`, `tax_id_country`, `tech_stack[]`) are optional.
  Server runs `apply_risk(...)` synchronously and enqueues `enqueue_sync(id)`
  asynchronously.

### Detail

- `GET /api/clients/<id>/` — full client with `sync_data`, `risk_factors`,
  `contacts[]`.
- `PATCH /api/clients/<id>/`
- `DELETE /api/clients/<id>/`

### Bulk

- `POST /api/clients/bulk/` `{action, ids[], data}` where action is
  `update` (partial), `delete`, `assign`.

### Tax ID check

- `POST /api/clients/check-tax-id/` `{tax_id, country?='RU'}`
  → `{normalized, valid, reason?, duplicates: [{id,name,status,country,industry}]}`

### Risk engine

- `POST /api/clients/<id>/risk/recalc/?force=1` → `{score, level, factors[]}`.
  `force=1` recalculates even if manually overridden.
- `POST /api/clients/<id>/risk/override/` `{level?, score?, notes?, clear?}`
  sets `risk_overridden=true`, stamps user. Pass `{clear: true}` to revert
  to rule-based scoring.

### Async sync

- `POST /api/clients/<id>/sync/` → `{queued: true, client_id}`. Spawns a
  daemon thread to refresh EGRUL, Dadata, HH.ru, website enrichment.
- `GET /api/clients/<id>/` — poll `sync_status` (`pending|in_progress|done|failed`)
  and `sync_data`.

### Contacts

- `GET /api/clients/<id>/contacts/`
- `POST /api/clients/<id>/contacts/` — fields: `first_name, last_name, email,
  phone, position, role (decision_maker|manager|secretary|other),
  is_primary, linkedin, telegram, whatsapp, notes`.
- `PATCH`/`DELETE /api/clients/<id>/contacts/<contact_id>/`

### Documents

- `GET /api/clients/<id>/documents/`
- `POST /api/clients/<id>/documents/` — multipart, field `file`.
- `DELETE /api/clients/<id>/documents/<doc_id>/`

### Notes

- `GET /api/clients/<id>/notes/`
- `POST /api/clients/<id>/notes/` — `{kind, title?, body, pinned?}` where
  kind ∈ `note|meeting|call|transcript|decision`.
- `PATCH`/`DELETE /api/clients/<id>/notes/<note_id>/`

### Rate cards

- `GET /api/clients/<id>/rate-cards/`
- CRUD mirrors notes (list/detail with `PATCH`/`DELETE`).

### CSV import

- `POST /api/clients/import/` — multipart `file=<csv>`, optional `dry_run=1`.
  Returns `{created, errors[], preview[], total_rows, dry_run}`.

## Deals

| Method | Path | Notes |
|--------|------|-------|
| GET    | `/api/deals/` | Filter by `stage`, `client`, `renewals` (active/signed closing ≤60 days). |
| POST   | `/api/deals/` | `{client, title, value, currency, stage, expected_close?, ...}` |
| GET    | `/api/deals/<id>/` |
| PATCH  | `/api/deals/<id>/` |
| DELETE | `/api/deals/<id>/` |
| POST   | `/api/deals/<id>/notes/` | Add a note. |
| GET    | `/api/deals/<id>/timeline/` | Composite of notes + stage transitions. |

## Tasks

| Method | Path | Notes |
|--------|------|-------|
| GET    | `/api/tasks/` | Filters: `status`, `assignee`, `client`, `deal`. |
| POST   | `/api/tasks/` |
| PATCH  | `/api/tasks/<id>/` | Status transitions todo → in_progress → done. |
| DELETE | `/api/tasks/<id>/` |

## Calendar

| Method | Path | Notes |
|--------|------|-------|
| GET    | `/api/calendar/events/?start=&end=` | Range-query events. |
| POST   | `/api/calendar/events/` | `{title, start_datetime, end_datetime, all_day?, location?, description?, attendees[]}` |
| PATCH  | `/api/calendar/events/<id>/` | Drag + resize save here (`start_datetime`, `end_datetime`). |
| DELETE | `/api/calendar/events/<id>/` |

## Chat

| Method | Path | Notes |
|--------|------|-------|
| GET    | `/api/chat/channels/` | List user channels. |
| POST   | `/api/chat/channels/` | Create DM / group / public. |
| GET    | `/api/chat/<channel_id>/messages/?before=&limit=` | Paginate backwards. |
| POST   | `/api/chat/<channel_id>/messages/` | Multipart: `text?`, `attachment?`, `reply_to?`. Broadcasts via Channels `chat_<id>`. |
| GET    | `/api/chat/mentions/` | Unread @mentions for the current user. |
| WS     | `ws://.../ws/chat/<channel_id>/` | Receives `{type:'message', message: {...}}` events. |

## AI

All routes under `/api/ai/`. Require authenticated user. Language of outputs
matches `user.language`.

| Path | Body | Returns |
|------|------|---------|
| `GET /provider-info/` | — | `{provider, model}` |
| `POST /deal-summary/` | `{deal_id}` | `{summary_md}` |
| `POST /draft-email/` | `{deal_id, tone, bullet_points[]}` | `{subject, body}` |
| `POST /chat-sentiment/` | `{text}` | `{label, score, rationale}` |
| `POST /lead-enrich/` | `{domain}` | `{enriched: {name, industry, description, company_size_estimate, countries[], tech_stack[], potential_outstaff_fit, contacts[{full_name, position, email, phone, linkedin, is_decision_maker}], raw_signals: {emails[], phones[], social_urls[]}, scraped_pages[]}}` |
| `POST /next-best-action/` | `{deal_id}` | `{action, reason, due_in_days}` |
| `POST /bench-roster/` | — | `{people[...], summary_md}` |
| `POST /resource-match/` | `{deal_id}` | `{matches: [{person_id, fit, reasoning}]}` |
| `POST /candidate-match/` | `{client_id, requirements?}` | Ranked candidates. |
| `POST /transcript-process/` | `{text, source?}` | `{summary, action_items[], risk_signals[]}` |
| `GET /hh-search/?q=` | — | `{results: [{hh_id, name, domain?, logo?}]}` |
| `GET /ru-company/?inn=` | — | `{egrul, financials?}` |

## Webhooks

| Method | Path | Notes |
|--------|------|-------|
| GET    | `/api/webhooks/endpoints/` | Admin-only. |
| POST   | `/api/webhooks/endpoints/` | `{name, url, events[], secret, active?}` |
| DELETE | `/api/webhooks/endpoints/<id>/` |
| GET    | `/api/webhooks/deliveries/?endpoint=&status=` | Delivery log. |

Events currently fired: `deal.created`, `deal.stage_changed`,
`deal.won`, `deal.lost`, `client.created`, `client.risk_changed`,
`task.overdue`.

Header signature: `X-iDev-Signature: sha256=<hex>` where `hex = HMAC-SHA256(secret, raw_body)`.
