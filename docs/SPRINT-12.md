# Sprint 12 — Production foundation and workspace evolution

## Scope and safety

This Sprint builds on Sprint 11's verified PostgreSQL migration, local SQLite import, session authentication, RBAC, and tenant-isolation checks. Production Redis remains a deployment prerequisite: the host has no Docker daemon/Compose plugin, so Redis-backed integration and production deployment are not claimed. No production cutover, existing `.env` modification, or production data operation was performed.

The existing UI already had a compact sidebar, command search, keyboard shortcut, favorites, and several operational modules. This Sprint extends that implementation instead of introducing an alternate frontend architecture.

## Implemented

- Dashboard now reads persisted projects/tasks, upcoming meetings, and the signed-in user's unread notification count alongside the existing attendance/activity metrics. It shows active projects, pending/late tasks, project status, task status/priority, and meeting agenda without fabricated values. Dashboard access remains role/permission gated.
- `/workspace` is a working personal overview built from the existing Time, Projects, Meetings, Inbox, and Chat APIs. It shows the current user's time, assigned work, owned/participating projects, upcoming meetings, unread notifications, and recent conversations. Empty and partial API failure states are explicit. Each signed-in user can reorder/hide widgets; preferences are stored in that browser only. Existing favorites remain available from the shell.
- App navigation shows a user's unread notification badge and refreshes it every minute. The active badge is filtered through inbox permission.
- Added a production Docker build target for API, a standalone Next.js frontend image, health checks, non-root runtime users, and a production Compose file that expects external TLS PostgreSQL and Redis. Migrations have a separate opt-in Compose profile and do not run on normal application startup.
- Added a pull-request/push CI workflow for Prisma validation/generation/deployment, API and web typechecks, unit/integration/migration tests, and production builds. The workflow does not publish or deploy.
- API readiness now checks PostgreSQL and configured Redis; an unconfigured Redis remains valid for local development only. Structured HTTP completion logs contain request ID, method, path, status, and duration, excluding query strings and request contents.
- Added custom-format PostgreSQL backup with checksum/archive validation/retention and a restore procedure that accepts only a fresh loopback database ending in `_restore_test`.
- Added compact KPI sizing and layout rules for phone, tablet, and wide desktop breakpoints. The palette remains the established charcoal/violet palette.

## Deployment usage

Set deployment secrets in the deployment platform. `DATABASE_URL` and `DIRECT_URL` must use TLS; `RATE_LIMIT_REDIS_URL` must use `rediss://` or HTTPS REST with a token; `CORS_ORIGIN` must be the HTTPS frontend origin; `NEXT_PUBLIC_API_URL` must be reachable by users' browsers. The API image exposes an optional `migrate` target. Review and run migrations explicitly before starting new application containers:

```sh
docker compose -f docker-compose.production.yml --profile migrate run --rm migrate
docker compose -f docker-compose.production.yml up --build -d api web
```

The production Compose file intentionally contains only the application services and connects to managed/external PostgreSQL and Redis. Put a TLS reverse proxy/load balancer in front of the private containers; configure its trusted proxy hop count and TLS certificates there.

Back up using `DIRECT_URL` and review retention/storage location for the operator's environment:

```sh
DIRECT_URL='postgresql://…?sslmode=verify-full' BACKUP_DIR=/secure/backups BACKUP_RETENTION_DAYS=14 bash scripts/backup-postgres.sh
RESTORE_DATABASE_URL='postgresql://…/rary_restore_test?sslmode=verify-full' bash scripts/restore-postgres-test.sh /secure/backups/rary-vizion-YYYYMMDDTHHMMSSZ.dump
```

Store backups off-host with encryption and access controls. The repository procedure validates the dump archive and restores only to an isolated loopback test DB; operators must validate restored rows/app behavior and define off-site retention/alerting for the chosen provider. This Sprint does not claim point-in-time recovery or automated backup scheduling.

## Visual/functional evidence

- Before: compact navigation and managerial dashboard existed; `/workspace` fell through to a planned-module placeholder; dashboard reported project/task/meeting metrics unavailable despite persisted modules.
- After: workspace is a data-backed page with personal operational widgets; managerial dashboard includes real project/task/meeting/inbox metrics and breakdowns; shell notification badges reflect unread notifications.
- No browser screenshot tool was available during implementation. Validation is through build/typecheck and API-backed rendering paths; breakpoints were reviewed in CSS but not browser-tested at each specified viewport width.

## Validation

- `npm run db:validate`: **PASS**.
- `npm run typecheck -w apps/api` and `npm run typecheck -w apps/web`: **PASS**.
- `npm test -w apps/api`: **PASS**, 40 tests.
- `npm run test:db-migration -w apps/api`: **PASS**, 8 tests.
- `npm run test:postgres-integration -w apps/api`: **PASS**, including the new real-data dashboard metrics checks.
- `npm run test:api-postgres-runtime -w apps/api`: **PASS** against local PostgreSQL (health, auth/session persistence after API restart, tenant isolation). Redis was unconfigured in this local run.
- `npm run build -w apps/api` and `npm run build -w apps/web -- --no-lint`: **PASS**. The Next standalone output included `/workspace`.
- `git diff --check`, Bash syntax checks for the backup scripts, and YAML parsing for CI/Compose: **PASS**.
- Backup/restore drill: **PASS**. A custom-format backup of the local test DB was checksummed, restored into a separate loopback `_restore_test` DB (16 tables), and company/user counts matched (1/8); the restore DB was dropped afterward.
- Docker image/Compose execution and the separate native Redis shared-counter test still need a host with Docker Compose/Redis. The checked-in CI workflow can run these integration checks in GitHub Actions; it has not yet run in GitHub. No production deployment was performed.

## Remaining work

- Run the new CI workflow in a GitHub runner; validate Docker builds and Compose config there.
- Browser-review shell, Dashboard, Workspace, and existing module pages at the requested viewport sizes; capture baseline/current screenshots when a browser surface is available.
- Validate Redis native TLS/REST connectivity and alerting against the selected managed Redis service.
- Add external backup storage/scheduling, retention policy approval, and a recurring isolated restore drill before production release.
- Continue visual and interaction review on Workforce, Time, Projects, Chat, Meetings, Inbox. Existing flows remain present; this Sprint's deep functional additions center on Dashboard, Workspace, shell badges, and deployment readiness.

## Next Sprint

**Sprint 13 — Vizion Time 2.0**: strengthen the personal and manager time views with weekly/monthly summaries, correction requests, approvals, and audit history after defining the jurisdiction-specific requirements.
# Registro histórico — a configuração PostgreSQL/Prisma foi supersedida em 21/11/2026. O runtime atual usa Supabase Auth/PostgREST; consulte o README.

