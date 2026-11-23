# Sprint 08 — Production foundation (implemented scope)

> Atualização: o Sprint 09 consolidou autenticação própria Prisma, sessões HttpOnly, RBAC granular e rate limiting com Redis em produção. As pendências históricas abaixo descrevem o estado ao fim do Sprint 08; o estado atual está em [SPRINT-09.md](SPRINT-09.md).

## Persistence decision

The existing operational schema and services use Prisma with SQLite. This remains the single supported source for the implemented modules; no PostgreSQL or Supabase data migration was run. Supabase Auth remains an optional legacy authentication integration and is not a second Prisma write store. Do not enable it for production until identity, profile synchronization, and session ownership are consolidated.

The initial Prisma migration is versioned at `apps/api/prisma/migrations/20261120120000_initial`. New databases are created with `npm run db:deploy`; check state with `npm run db:status`. Development schema changes use `npm run db:migrate`. Production uses `npm run db:deploy`; `db push` is no longer the setup or production flow.

### Existing SQLite database adoption / rollback

`npm run setup` detects `apps/api/prisma/dev.db` and leaves it untouched. Before adopting migrations for an existing database, stop writers and make a verified copy of the SQLite file, then validate the copy with `PRAGMA integrity_check` and compare table counts. The initial migration describes the current schema and must be baselined on a matching existing database with Prisma's migration resolve procedure; do not deploy it directly onto populated tables. Restore the verified copy to roll back. No automatic migration, production database access, or destructive data operation was performed by this sprint.

## Security changes

- Helmet, strict configured CORS, request IDs, global DTO validation, and a common error envelope were already present and remain enabled.
- Added in-process per-IP request limits: 10/minute for login/register, 30/minute for meeting join, and 300/minute for other API paths. This is suitable for one API process only; production replicas need a shared limiter store.
- Meeting inputs now use class-validator DTOs. Private meetings are visible only to their organizer/invitees, meeting lookup enforces the same policy, and expired meetings cannot be joined.
- Project/chat and the existing business services scope queries to the authenticated company or membership. A full cross-tenant integration suite remains outstanding.

## Outstanding P0 items

- Browser authentication still uses bearer tokens in `localStorage`; HttpOnly cookie sessions, refresh/rotation, CSRF, and server-side revocation are not implemented.
- The operational database remains SQLite. PostgreSQL migration needs a target, verified backup, data inventory, dry run, and explicit cutover plan.
- Supabase Auth and local Prisma Auth remain selectable; consolidate them before production use.
- RBAC still uses the existing role hierarchy; module/action policies and document isolation tests need real document endpoints.
- Rate limits are process-local and do not protect a horizontally scaled deployment.
- Meeting and tenancy test coverage, browser auth tests, and the full Sprint 08 acceptance suite remain incomplete.

## Next sprint recommendation

Resolve the remaining Sprint 08 authentication and database decisions before expanding modules. Once session ownership and PostgreSQL cutover are tested, proceed with **Sprint 09 — Vizion Time: Jornada, Ajustes e Aprovações**, which extends an existing persisted workflow and depends on auditability and tenant-safe authorization.
# Superseded database guidance

The SQLite operational database notes below describe the state at Sprint 08. Sprint 10 makes PostgreSQL the official database and preserves SQLite as the source for an explicit, verified migration. See [SPRINT-10.md](SPRINT-10.md).

# Registro histórico — a arquitetura de persistência deste sprint foi supersedida em 21/11/2026. O runtime atual usa Supabase Auth/PostgREST; consulte o README.

