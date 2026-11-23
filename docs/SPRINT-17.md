# Sprint 17 — Database activation and integration

## Execution status

Sprint 17 is **in progress and blocked on local Supabase credentials**. The user authorized use of development project ref `qrfqmebjgovrnqytvshf` for migrations and disposable integration data. The ref matches the host configured in `apps/api/.env.dev.local`. The operational `.env` was not changed, and no remote write has been attempted.

The safe key-name check on `apps/api/.env.dev.local` found the development URL and ref, but no `SUPABASE_ACCESS_TOKEN` or `SUPABASE_DB_PASSWORD`. No credentials were printed. Supabase CLI 3.2.0 is installed as a project dependency. Docker and local container commands are not used.

## Database and migrations

- Migration files in the repository: six, ordered from `20261119000000_initial.sql` through `20261123000100_sprint16_activity_gantt.sql`.
- Migrations applied to the hosted project during this sprint: **zero**.
- Remote migration history, schema, RLS policies, grants, functions, constraints, and indexes: not inspected because CLI authentication is unavailable.
- No baseline or schema assumption was made. The guarded remote script requires the explicit development ref and `--confirm-dev-write` for push.
- Static migration validation is documented in Sprint 16; it is not evidence of remote application.

## Integration harness

`apps/api/scripts/supabase-integration.smoke.mjs` was extended to exercise, once credentials and migrations are ready:

- projects, task create/update/delete with readback, subtasks, comments CRUD, dependencies and circular-dependency rejection;
- workspace preferences and focus start/pause/resume/finish/history;
- calendar create/update/delete, period query, and private-event cross-company visibility;
- Activity Center query and exclusion of comment body text;
- time clock-in/clock-out with today and history readback;
- auth register, login, logout endpoint, and rejection without a session;
- API cross-company project isolation and anonymous access to activity events under RLS.

This harness has **not** run against Supabase in this sprint. Its expanded assertions are source code, not integration evidence. It currently does not prove authenticated Postgres RLS behavior across two companies, Realtime delivery, or the complete Workforce CRUD; those need distinct integration coverage.

## Independent validation and application state

The API and web development servers are running locally. A fresh API health request returned `status: ok`, `target: development`, Supabase `ok`, and Redis `not-configured`; `/demo` returned HTTP 200. This is a connection/health check only and does not prove schema readiness or CRUD persistence. The app's `/demo` remains static fixture content, not an authenticated route.

This turn reran 49/49 API unit tests, API and Web typechecks, the six-file static migration check, JavaScript syntax validation for the integration harness, API/Web production build, and `git diff --check`; all passed. The Web build initially collided with the running Next dev server's `.next/trace`; stopping that server during the build resolved it, and the dev server was restarted. The Sprint 16 record includes 60 viewport checks for ten demo fixtures at widths 360, 390, 768, 1024, 1440, and 1920 px. No authenticated-page visual verification or live CRUD evidence is claimed here.

## Realtime, Activity Center, and Gantt

Realtime remains disabled until project schema, access control, and publication behavior can be verified. The current browser does not receive a Supabase user token for private subscriptions; a service-role subscription from the frontend would violate the intended trust boundary. Activity Center and Gantt code are implemented as recorded in `docs/SPRINT-16.md`, but database persistence and authenticated route behavior are not proven until the hosted integration can run.

## Next actions

1. Add `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` locally to the ignored `apps/api/.env.dev.local` file; do not send either value in chat.
2. Inspect hosted project identity, migration history, schema, grants, and RLS, then run the guarded dry-run and resolve any divergence before applying migrations.
3. Apply the six migrations only to the authorized development ref and confirm remote history/schema afterward.
4. Run the API integration harness, then add/execute isolated authenticated RLS and Workforce coverage, and record cleanup results.
5. Validate authenticated pages in the six requested viewport widths; implement and exercise a secure Realtime path only after authorization checks are in place.

**Sprint 17 is not complete.**
