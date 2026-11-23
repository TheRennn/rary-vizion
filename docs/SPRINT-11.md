# Sprint 11 — PostgreSQL activation, data integrity and runtime validation

## Status and environment

Implementation and local PostgreSQL validation are complete. An isolated, unprivileged PostgreSQL 17.12 runtime was provisioned from EDB Windows binaries under the current user's LocalAppData and bound only to `127.0.0.1:55432`; no Windows service or Docker daemon was installed. Database `rary_vizion_test` was migrated and loaded. Production was not accessed; the original SQLite source and `.env` files were not changed.

Environment checks:

- Windows PowerShell host; Node.js and Python are available.
- Docker CLI shim is present, but Compose is unavailable: `docker compose ...` returned `unknown shorthand flag: 'f' in -f`. `docker info` also failed because `//./pipe/docker_engine` does not exist. No daemon was available to start either container.
- PostgreSQL binaries were downloaded from EDB Windows binary archive (SHA-256: `520C8C6F19ABB3B31FA83EC5E486E2F769EEDD7593D94E60A7CDA8A5BFB4DF91`) and extracted in current user LocalAppData. Cluster `%LOCALAPPDATA%\RARY\rary-vizion\postgres17-data` listens only on loopback port 55432. No privileged Windows service was created; port 5432 remains unused.
- WSL is available but has no registered distributions.
- Winget EDB installer requested elevation and was cancelled. The user then explicitly authorized the best local database provisioning, so the portable binaries were used without elevation.
- Redis is unavailable locally; Compose and its daemon remain unavailable, so Redis integration could not be run.

The repository now has [docker-compose.dev.yml](../docker-compose.dev.yml), configured for PostgreSQL 17 and authenticated Redis 7.2 on loopback ports only, a persistent named PostgreSQL volume, and health checks. Compose uses published official image tags. Dev credentials are intentionally fixed non-production examples; change them through shell environment variables if needed. Compose was not started because its daemon is missing. The portable PostgreSQL cluster is a separate local test runtime.

## SQLite snapshot and backup

Before any database operation, a fresh read-only inventory was compared to the verified SQLite backup created just before this Sprint. Counts and row values matched. The source remains unchanged.

| Table | Rows |
|---|---:|
| Company | 1 |
| Department | 2 |
| User | 8 |
| Session | 0 (not present in the legacy SQLite schema) |
| PermissionGrant | 0 (not present in the legacy SQLite schema) |
| TimeEntry | 2 |
| AuditLog | 2 |
| Conversation | 1 |
| ConversationParticipant | 2 |
| ChatMessage | 1 |
| Project / ProjectTask | 0 / 0 |
| Meeting / MeetingParticipant | 0 / 0 |
| Notification | 0 |
| **Total** | **19** |

Verified backup: `C:\Users\Renan R\Documents\Features Code\RARY\migration-backups\rary-vizion\sqlite-20261120-pre-postgres.db` with sidecar manifest. Size: 196,608 bytes. SHA-256: `43a9199b54d3606638b3ce68dc19782fc70bc404afef174e800e7c9c60592fad`. `PRAGMA integrity_check` is `ok`; foreign-key and cross-company source checks pass. The source file's logical rows match the backup. Take a new verified backup after any source write and before a later import.

## Runtime changes prepared

- API rate limiting now supports authenticated native `redis://`/`rediss://` via node-redis as well as the existing HTTPS Redis REST service. Startup fails if a configured Redis cannot connect; request-time failures return 503, with no silent in-memory fallback. Production still requires Redis TLS.
- Redis's Lua counter preserves atomic increment and fixed-window expiry. An integration smoke test uses two independent Redis clients to verify sharing, TTL, and expiry.
- PostgreSQL smoke test exercises Prisma migration history, CRUD across all 15 models, unique/FK constraints, and Session persistence after reconnect. It permits only loopback databases with `_test` or `_dev` suffixes and cleans up test companies.
- API runtime smoke test launches the built Nest process with temporary process environment (no `.env` mutation), verifies health, login/register, cookies, refresh/revocation, persistence across API restart, and user/project tenant isolation. Cleanup removes only the uniquely created test companies.

Commands for a Docker based development setup (Compose was unavailable on this host):

```powershell
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps

$env:DATABASE_URL = 'postgresql://vizion_dev:vizion_dev_only@localhost:5432/rary_vizion_dev?schema=public&connection_limit=10&pool_timeout=20&connect_timeout=10'
$env:DIRECT_URL = 'postgresql://vizion_dev:vizion_dev_only@localhost:5432/rary_vizion_dev?schema=public&connect_timeout=10'
$env:RATE_LIMIT_REDIS_URL = 'redis://:vizion_dev_only@localhost:6379'
npm run db:generate
npm run db:deploy
npm run db:status

$env:ALLOW_SQLITE_MIGRATION = '1'
$env:CONFIRM_POSTGRES_TARGET = 'rary_vizion_dev'
npm run db:migrate:sqlite-to-postgres -- --source 'C:\Users\Renan R\Documents\Features Code\RARY\migration-backups\rary-vizion\sqlite-20261120-pre-postgres.db' --backup-manifest 'C:\Users\Renan R\Documents\Features Code\RARY\migration-backups\rary-vizion\sqlite-20261120-pre-postgres.db.manifest.json'
Remove-Item Env:ALLOW_SQLITE_MIGRATION, Env:CONFIRM_POSTGRES_TARGET

npm run db:verify:sqlite-to-postgres -- --source 'C:\Users\Renan R\Documents\Features Code\RARY\migration-backups\rary-vizion\sqlite-20261120-pre-postgres.db' --backup-manifest 'C:\Users\Renan R\Documents\Features Code\RARY\migration-backups\rary-vizion\sqlite-20261120-pre-postgres.db.manifest.json'
$env:TEST_DATABASE_URL = $env:DIRECT_URL
$env:TEST_REDIS_URL = $env:RATE_LIMIT_REDIS_URL
npm run test:postgres-integration
npm run test:redis-integration
npm run build -w apps/api
npm run test:api-postgres-runtime
```

The import requires a clean PostgreSQL target and writes only to the explicitly named development database. The two opt-in environment variables above are removed immediately afterward. The sample target name ends in `_dev`, satisfying the integration-test safety guard.

## Current verification

- SQLite backup manifest, checksum, integrity, row counts, and source/backup row equality: **PASS**.
- PostgreSQL migration SQL versus current Prisma schema: **PASS** (generated diff matches the checked-in initial migration).
- PostgreSQL 17.12 initial migration deployment and `migrate status`: **PASS** on loopback test database.
- SQLite backup import (19 rows) and table counts: **PASS**; full row comparison: **PASS**, `differences: []`.
- PostgreSQL CRUD smoke across 15 models, unique/FK constraints, Session persistence after reconnect, cleanup: **PASS**.
- Prisma schema validation/client generation: **PASS**.
- API typecheck and unit tests: **PASS** (final suite run in this Sprint).
- Migration utility tests: **PASS** (8 tests).
- Compose YAML/runtime validation: **NOT RUN — Docker Compose plugin is unavailable**.
- PostgreSQL migration deployment, CRUD smoke and migrated-data comparison: **PASS** against isolated local database.
- API HTTP runtime/auth, session persistence across API restart, and company isolation: **PASS** against local PostgreSQL; Redis was not configured.
- Redis shared-counter integration and frontend browser/CORS flows: **NOT RUN** (Redis daemon unavailable; browser flow not exercised).
- No SQLite source data, production database, cutover, or `.env` was changed. The PostgreSQL test database and cluster remain under current user profile.

## Deployment procedure

No production cutover was run. For later production planning: schedule a write freeze, take a fresh external verified backup, apply migrations to the approved PostgreSQL target, import and require a zero-difference report, run API/auth/tenant checks, update deployment secrets through the approved secret manager, start and monitor services, then reopen writes. Preserve SQLite and the verified backup through the rollback window. Post-cutover rollback requires preserving PostgreSQL writes and reconciling or restoring a PostgreSQL backup; switching back to the stale SQLite copy would lose new writes.

## Next Sprints

- **Sprint 12 — Production Deployment Foundation:** deployment config, CI/CD, Redis TLS, health checks, observability, logs, backups and rollout strategy.
- **Sprint 13 — Vizion Time 2.0:** shifts, corrections, approvals and reporting.
- **Sprint 14 — Workforce 2.0:** employees, departments, teams and org chart.
- **Sprint 15 — Projects 2.0:** projects, Kanban, timeline, tasks and dependencies.
# Registro histórico — a validação PostgreSQL/Prisma deste sprint não representa o runtime atual. Desde 21/11/2026 a persistência usa Supabase Auth/PostgREST; consulte o README.

