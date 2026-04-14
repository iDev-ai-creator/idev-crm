# Release 14.04 — Phase 1 Foundation

## Task 4: Docker Compose, Dockerfile, Initial Fixtures

**Date:** 2026-04-14

### Changes

- **`backend/Dockerfile`** — Python 3.12-slim image with libpq-dev/gcc, pip installs requirements, gunicorn entrypoint on port 8000
- **`docker-compose.yml`** — Three services:
  - `db`: postgres:16-alpine with healthcheck, volume persistence, port 5433 (5432 in container)
  - `redis`: redis:7-alpine on port 6379
  - `backend`: built from ./backend, auto-runs migrate + loaddata + gunicorn on start
- **`backend/fixtures/initial_data.json`** — 4 initial roles with fixed PKs:
  - Admin (pk=1) — full permissions
  - Sales Manager (pk=2) — deals + clients + reports
  - Recruiter (pk=3) — clients only
  - Viewer (pk=4) — no permissions
- **`.env`** — Local Docker dev credentials (force-committed for worktree; gitignored in production)
- **Admin superuser** — `admin@idev.team` / `admin123` created with Admin role

### Verification

- 19/19 tests pass
- All Django migrations applied cleanly against Docker postgres
- Fixtures loaded: 4 role objects installed
- Superuser created successfully

### Notes

- Port 5433 used on host (5432 occupied by cosplay-postgres container)
- `version: '3.9'` attribute is obsolete in newer Docker Compose but harmless
- `loaddata` runs on every container start — idempotent due to fixed PKs, intentional for dev
