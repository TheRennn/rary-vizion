# Sprint 10 — Database migration and persistence consolidation

## Status

PostgreSQL is now the configured Prisma provider and official operational database for new deployments. The Prisma schema contains 15 models. The current workspace SQLite file remains preserved and is still the source of its existing data; no migration, baseline, write, or production cutover was run. A PostgreSQL server/client is not available in this environment, so target migration deployment and data comparison remain operational acceptance steps.

## Persistence inventory

All API persistence goes through the single `PrismaService` / Prisma Client. No service opens SQLite directly or writes through Supabase. The data inventory is:

| Model/table | Keys and relations | Notable constraints/indexes and values |
|---|---|---|
| Company | UUID string primary key | Unique slug; creation timestamp |
| Department | Company FK, cascade delete | Unique `(companyId, name)` |
| User | Company FK cascade; optional Department FK set null | Unique email; active boolean; password hash |
| Session | User FK cascade | Unique token hash; expiry/revocation timestamps; indexes by user/expiry |
| PermissionGrant | Company FK cascade | Unique company/role/module/action; enabled boolean |
| TimeEntry | Company and User FKs, cascade | Recorded timestamp; indexes by user/time and company/time |
| AuditLog | Optional Company FK cascade; actor ID is historical scalar | Optional metadata stored as text; company/time index |
| Conversation | Company FK cascade | Type/name; creation/update timestamps; company/update index |
| ConversationParticipant | Composite PK conversation/user; both FKs cascade | Joined/last-read timestamps; user index |
| ChatMessage | Conversation and sender User FKs, cascade | Body text; conversation/time and sender/time indexes |
| Project | Company FK cascade | Optional owner ID is scalar; status; optional due timestamp; company/update index |
| ProjectTask | Project FK cascade | Optional assignee ID is scalar; status/priority; project/status and assignee indexes |
| Meeting | Company FK cascade | Unique code; start/update timestamps; access mode; company/start index |
| MeetingParticipant | Composite PK meeting/user; Meeting FK cascade | User ID currently has no Prisma FK; user index |
| Notification | Company FK cascade | User ID currently has no Prisma FK; read/creation timestamps; company/user/time index |

There are no Prisma JSON, enum, decimal, or binary business fields today. `AuditLog.metadata` is JSON-shaped text in application code, not a database JSON column. Prisma's live SQLite `DateTime` values are stored as epoch milliseconds, and booleans as integers; the import maps dates to UTC `TIMESTAMP(3)` and booleans to `BOOLEAN`. IDs are strings and must be retained. Cross-company integrity for project owners/assignees, meeting participants, notification recipients, and audit actors is currently enforced in application services where implemented; these are not all composite database constraints. Cascades present in the Prisma schema are unchanged; no new cascades were introduced in this sprint.

Read-only inventory of the existing workspace SQLite file found the following snapshot (2026-11-20); `PRAGMA integrity_check = ok`, `PRAGMA foreign_key_check` returned 0 violations, and `_prisma_migrations` is absent. The file was not modified.

| Table | Rows |
|---|---:|
| AuditLog | 2 |
| ChatMessage | 1 |
| Company | 1 |
| Conversation | 1 |
| ConversationParticipant | 2 |
| Department | 2 |
| Meeting | 0 |
| MeetingParticipant | 0 |
| Notification | 0 |
| Project | 0 |
| ProjectTask | 0 |
| TimeEntry | 2 |
| User | 8 |
| Session | 0 (table not yet present in SQLite snapshot) |
| PermissionGrant | 0 (table not yet present in SQLite snapshot) |
| **Total** | **19** |

The backup process records a fresh count and hash at migration time; those migration-time values must be used for acceptance, since workspace data may change after this read-only inventory.

## PostgreSQL configuration

- `DATABASE_URL`: application connection URL. Use a PostgreSQL pooler in production when appropriate and provide Prisma pool options (`connection_limit`, `pool_timeout`, `connect_timeout`) in its URL.
- `DIRECT_URL`: direct PostgreSQL connection for migrations/admin tasks. In development, the two may point to the same local database. In production both must be PostgreSQL URLs with `sslmode=require`, `verify-ca`, or `verify-full`.
- Prisma schema: `apps/api/prisma/schema.prisma`. Prisma Client is the only API persistence layer. Health endpoint runs `SELECT 1` and returns service unavailable when the database cannot be reached.
- No real credentials belong in `.env.example` or docs. `scripts/setup.mjs` only copies examples when local env files do not exist; it never edits an existing `.env` or `.env.local`.

Example local setup: create a PostgreSQL database named `rary_vizion`, configure both URLs in `apps/api/.env`, run `npm run db:generate`, then `npm run db:deploy`. `npm run db:migrate` is for local development schema changes. Production uses `npm run db:deploy`; do not use `prisma db push` as a deployment mechanism.

## Versioned migrations and history

Prisma 5.22 is pinned by the workspace lockfile. `apps/api/prisma/migrations` now has PostgreSQL provider history and a generated initial migration describing all current models and indexes. The two original SQLite migrations and their `provider = "sqlite"` lock file were moved intact to `apps/api/prisma/migrations-sqlite-legacy`; Prisma ignores that archive. This preserves the SQLite history without asking Prisma Migrate to mix providers in one migration directory. SQLite databases must not be baselined against the PostgreSQL history.

Commands:

```powershell
npm run db:generate
npm run db:status
npm run db:deploy
npm run db:migrate
```

For a new PostgreSQL database, use `db:deploy`. `db:baseline` is only for an already populated PostgreSQL database whose schema has been independently verified against the full initial migration; never use it for the SQLite database.

## Guarded SQLite to PostgreSQL migration

The tool is `apps/api/scripts/sqlite_to_postgres.py`; it uses Python's standard SQLite library and PostgreSQL's `psql` client. It supports all 15 current Prisma tables, maps nullable values, booleans and dates, retains IDs and values, uses FK dependency order, and performs the import in a PostgreSQL transaction. It refuses unmapped SQLite tables, source FK or cross-company relation violations, schema mismatches, unverified backups, or non-empty targets. Import does not delete or modify the SQLite source. Session/permission tables absent from an older SQLite snapshot are imported as empty tables created by Prisma migrations.

1. Schedule a maintenance window and stop every SQLite writer. Preserve the existing application configuration until the new database passes comparison.
2. Create and verify a consistent SQLite backup. The tool uses SQLite's online backup API, runs `PRAGMA integrity_check`, records per-table row counts, file size and SHA-256 in a sidecar manifest:

   ```powershell
   npm run db:backup:sqlite
   ```

3. Provision an empty PostgreSQL target and apply the versioned schema with `npm run db:deploy`. Confirm the direct connection and schema before transfer.
4. Set `DIRECT_URL` to the intended target. Explicitly arm the one-time import only in the maintenance shell, passing the exact backup and sidecar paths printed by step 2:

   ```powershell
   $env:ALLOW_SQLITE_MIGRATION = '1'
   $env:CONFIRM_POSTGRES_TARGET = 'rary_vizion'
   npm run db:migrate:sqlite-to-postgres -- --source 'prisma/backups/sqlite-<timestamp>.db' --backup-manifest 'prisma/backups/sqlite-<timestamp>.db.manifest.json'
   Remove-Item Env:ALLOW_SQLITE_MIGRATION
   Remove-Item Env:CONFIRM_POSTGRES_TARGET
   ```

5. Run the independent read-only comparison against the same immutable backup:

   ```powershell
   npm run db:verify:sqlite-to-postgres -- --source 'prisma/backups/sqlite-<timestamp>.db' --backup-manifest 'prisma/backups/sqlite-<timestamp>.db.manifest.json'
   ```

   The report compares per-table counts, primary-key sets, and every column value. Any unexplained difference is a failed migration; do not cut over. Reports are written under ignored `apps/api/prisma/migration-reports/`.

The tool requires `psql` on PATH and a working PostgreSQL target. Credentials are read from `DIRECT_URL`/`DATABASE_URL` (or the API `.env`) into libpq environment variables; they are not printed. It refuses to overwrite an existing backup or import into non-empty target tables. It does not switch application configuration, start services, seed data, or cut over automatically.

## Backup, recovery, cutover and rollback

- Keep backup DB and manifest together, outside the repository; verify size and SHA-256 after copying. Restore a SQLite backup to a separate file and run `PRAGMA integrity_check` plus count comparison before using it.
- Before cutover, leave SQLite untouched and continue to treat it as the source. Cutover is an operator action: stop all writers, make a final verified backup, repeat import/verification to a clean PostgreSQL target, set PostgreSQL URLs in deployment configuration, deploy migrations, start the API, then validate login/session, Workforce, Projects/Tasks, Chat, Meetings, Time, Notifications and Audit plus `/api/health`.
- Monitor errors and counts before reopening writes. Once PostgreSQL accepts writes, simply switching back to the old SQLite file loses those writes. A post-cutover rollback requires stopping writes, preserving/backing up PostgreSQL, and reconciling changes or restoring a known-good PostgreSQL backup. No reverse-sync tool is provided.
- The existing `.env` is not changed by the setup script. Do not run cutover without explicit operator authorization, a verified final backup, and a completed data-difference report.

## Performance, tests and acceptance limits

The current schema has indexes for common company, owner/participant, status and chronology access paths listed above. No cache was added. Query plans/load were not measurable without PostgreSQL; assess `EXPLAIN (ANALYZE, BUFFERS)` on representative data before adding indexes or claiming scale readiness. Existing list APIs have their own limits/pagination where implemented; this sprint did not broadly refactor service behavior.

`prisma validate`, `prisma generate`, `migrate deploy`, PostgreSQL constraint tests, import, row comparison, application compatibility against PostgreSQL, and builds must pass in an environment with PostgreSQL configured before production acceptance. Current workspace SQLite, `.env` files, and production were not changed. No full migration report exists until import and comparison produce a zero-difference report.

## Next sprints

- **Sprint 11 — PostgreSQL Activation:** Docker/local database availability, data migration and runtime validation (see [SPRINT-11.md](SPRINT-11.md)).
- **Sprint 12 — Production Deployment Foundation:** CI/CD, Redis TLS, health checks, observability, logs and backups.
- **Sprint 13 — Vizion Time 2.0:** shifts, corrections, approvals and reporting.
- **Sprint 14 — Workforce 2.0:** employees, departments, teams and org chart.
- **Sprint 15 — Projects 2.0:** projects, Kanban, timeline, tasks and dependencies.
# Registro histórico — o cutover PostgreSQL/Prisma descrito aqui não é a arquitetura atual. Desde 21/11/2026 o runtime usa Supabase Auth/PostgREST; consulte o README.

