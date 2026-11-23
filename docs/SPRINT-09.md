# Sprint 09 — Identity, authentication and access control

## Files and implementation

- `apps/api/src/auth/auth.service.ts`, `auth.controller.ts`, `session-cookie.ts`: Prisma is the only identity authority. Login/registration return no token to browser JavaScript; API emits `rary_session` as HttpOnly, SameSite=Lax, Path `/api`, Secure in production. Session tokens contain 256 random bits; only SHA-256 hashes are stored. Session lifetime is 8 hours.
- `apps/api/src/common/guards.ts`: global guard validates cookie hash, expiry, revocation, active user and loads role/company from Prisma each request. Legacy Bearer JWTs are no longer accepted.
- `apps/web/src/lib/api.ts`, `components/auth-provider.tsx`: credentialed fetch, boot restoration through `/auth/me`, logout through backend, refresh every four hours. Browser no longer reads, writes or sends auth tokens. Other UI preferences may still use localStorage.
- `apps/api/prisma/schema.prisma`: added revocable sessions and per-company role grants. Migration `20261120150000_identity_permissions` adds the two tables.
- `apps/api/src/auth/permissions.service.ts`, `permissions.controller.ts`, `common/permissions.ts`: role/module/action matrix, company overrides, server guard/decorator, and audit events. Owner-only UI is at `/settings/permissions`; the Auth Provider loads the effective matrix for navigation and action controls. Workforce can revoke a lower-privilege colleague's sessions; account deactivation revokes all sessions transactionally.
- `apps/api/src/main.ts`: Redis REST atomic increment/expiry for multi-instance rate limiting. In development only, absent Redis uses process-local counters. Production requires Redis TLS credentials and fails closed with 503 if Redis is unavailable. Defaults are configurable with `RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_MEETING_MAX`, `RATE_LIMIT_DEFAULT_MAX`; reverse proxy hop count is `TRUST_PROXY`.
- Removed Supabase Auth runtime module and JWT/Passport strategy dependencies. Existing `SUPABASE_*` values in local env files are ignored; no credentials were read, copied, or changed. Supabase identities and password hashes are not automatically imported. Users held only in Supabase need a planned migration and password reset/invitation flow before switching their account base to Prisma.

## Session lifecycle

Login/register create a Prisma session and set the cookie. `/auth/refresh` rotates the opaque token transactionally: the old hash is revoked before the replacement is inserted, so concurrent reuse of the old token loses. `/auth/logout`, `/auth/logout-all`, and `DELETE /auth/sessions/:id` revoke rows on the server. `GET /auth/sessions` lists active sessions. Expired/revoked sessions return 401. No refresh token is kept in JavaScript or persisted in plain text. Cookie-authenticated unsafe requests with an Origin are checked against `CORS_ORIGIN`; CORS enables credentials only for configured origins.

## RBAC matrix

All roles have per-module defaults for `view`, `create`, `edit`, `delete`, `manage`, `approve`, `export`, and `invite`; company-specific overrides persist in `PermissionGrant`. Modules: Dashboard, Inbox, Workspace, Workforce, Time, Projects, Chat, Voice, Meetings, Monitor, Intelligence, Documents, Reports, Automations, Audit and Settings. The exact defaults are centralized in `common/permissions.ts`. Existing `@MinRole` checks remain as a second requirement; `@RequirePermission(module, action)` is enforced by the global permission guard on dashboard, inbox, workforce, time, projects/tasks, chat, meetings and audit routes. Resource services still enforce tenant/member scope.

Only Owner/Super Admin can edit the matrix, and neither can edit their own or a higher role. An owner cannot grant a permission outside their effective permission set. Overrides are audited. Owner roles are excluded from the editable matrix, so the acting owner remains an active administrator. This iteration does not yet provide per-department or per-resource grant records.

## Migrations and local data

The checked-in `20261120120000_initial` migration is the baseline for the existing SQLite tables before sessions/permission grants. Read-only inspection of `apps/api/prisma/dev.db` found matching tables and columns, no `_prisma_migrations` table, and `PRAGMA integrity_check = ok`; 19 rows across the existing application tables were counted. The additive migration was applied to an isolated copy, where row counts and integrity remained unchanged. The workspace database itself was not modified.

For an existing matching SQLite database: stop API writers, make a verified file backup, compare all baseline columns/foreign keys/indexes against the migration, then run `npm run db:baseline` (marks the initial schema as already present) and `npm run db:deploy`. Verify `npm run db:status`, `PRAGMA integrity_check`, and table counts. To roll back, stop writers and restore the verified file backup. Do not run the baseline command on a fresh or mismatched database. New databases use `npm run db:deploy` directly. A production database was not accessed.

## Security tests and verification

Added service tests for session creation/hash-at-rest, expiry/revocation, rotation/reuse, permission defaults/overrides/role bounds, private meetings, ended meetings, tenant-scoped meeting lists, and cross-company project assignees. Existing tests remain in place. Run `npm test -w apps/api`, `npm run typecheck -w apps/api`, `npm run typecheck -w apps/web`, and `npx prisma validate` from `apps/api`.

Rate limit endpoints include login and registration (10/min default), private meeting join (30/min), and general API paths (300/min). Redis rate keys are shared; with missing Redis in production the API refuses startup, and Redis runtime errors return 503 rather than silently disabling protection.

## Limits and next work

- Identity migration from Supabase is not implemented; automatic migration would require a user inventory, profile mapping, and password reset/identity verification plan.
- PostgreSQL cutover is Sprint 10; this sprint keeps Prisma/SQLite and does not touch the live local database.
- Permissions are company-wide role grants; Documents, Voice, Monitor, Intelligence and Automation have no functional module endpoints yet. Their matrix entries do not create those modules.
- Existing `@MinRole` policies remain on some routes, so a granular grant cannot override a stricter legacy role requirement.
- Browser integration tests and true multi-process Redis integration tests remain pending. Unit tests verify rotation and policy behavior; Redis availability behavior is validated by code path and env validation, not a live Redis instance.
- Run builds serially. `NEXT_DIST_DIR=.next-sprint09` isolates Next output from a running development server.

## Next sprints

1. Sprint 10 — Database Migration & PostgreSQL.
2. Sprint 11 — Vizion Time 2.0.
3. Sprint 12 — Workforce 2.0.
4. Sprint 13 — Projects 2.0.
# Superseded by Sprint 10

The SQLite baseline instructions below are historical only. PostgreSQL is now the configured Prisma provider; the old SQLite migrations are archived under `apps/api/prisma/migrations-sqlite-legacy`. Follow [SPRINT-10.md](SPRINT-10.md) for the PostgreSQL schema, backup, conversion and verification process. Do not run the old SQLite `db:baseline` workflow.

# Registro histórico — a arquitetura Prisma deste sprint foi supersedida em 21/11/2026. O runtime atual usa Supabase Auth/PostgREST; consulte o README.

