# RARY Vizion — The Workspace for Developers

Monorepo (npm workspaces) com **Sprint 01 (Foundation)** e a base do **Sprint 02 (Vizion Time)**.

```
apps/
  api/   NestJS + Prisma + SQLite (auth JWT, multiempresa, RBAC, auditoria, ponto)
  web/   Next.js 14 (App Router) + Tailwind (login, dashboard, ponto, workforce)
```

## Rodando

Requisitos: Node 20+.

```bash
npm install
npm run setup     # cria .env, cria o banco SQLite e executa o seed
npm run dev       # API :3333 e Web :3000
```

Em desenvolvimento o app entra sozinho como `owner@demo.com` por padrão. Para voltar ao login
normal, defina `DEV_AUTO_LOGIN="false"` na API e `NEXT_PUBLIC_DEV_AUTO_LOGIN="false"` no web.
**Nunca ative em produção** (a API já bloqueia com NODE_ENV=production).

Se aparecer "API indisponível": abra http://localhost:3333/api/health e veja o terminal do `npm run dev`.

Seed: `owner@demo.com`, `manager@demo.com`, `dev@demo.com` — senha `Demo@12345`.

Testes das regras de ponto: `npm test -w apps/api`.

## Endpoints principais (prefixo `/api`)

| Método | Rota | Papel mínimo |
| --- | --- | --- |
| POST | /auth/register, /auth/login | público |
| GET | /auth/me | autenticado |
| GET/POST | /users | listar: qualquer; criar: ADMIN |
| GET/POST | /departments | listar: qualquer; criar: ADMIN |
| POST | /time/clock | autenticado |
| GET | /time/today, /time/history | autenticado |
| GET | /time/team | MANAGER |
| GET | /audit | ADMIN |
| GET | /health | público |

## Convenções

- **Multi-tenancy:** toda tabela de negócio tem `companyId`; toda query de serviço filtra por ele.
- **RBAC:** `@MinRole(Role.X)` por rota; hierarquia em `apps/api/src/common/roles.ts`.
- **Ponto:** máquina de estados em `time/time.rules.ts`; horário sempre do servidor; registros imutáveis.
- **Novo módulo:** crie a pasta em `apps/api/src/<modulo>`, registre no `AppModule`.

## Pendências conhecidas

- Conformidade com a Portaria MTP 671/2021 antes de vender como REP-A (não coberta aqui).
- Token em `localStorage` → migrar para cookie httpOnly em produção.
- Supabase Auth do documento foi substituído por JWT próprio (ver decisões).
