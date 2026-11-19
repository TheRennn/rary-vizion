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
JWT expira em 8 horas por padrão; personalize com `JWT_EXPIRES_IN` (ex.: `15m`, `8h`, `7d`). Sessões expiradas são invalidadas no cliente quando a API responde `401`.

## Endpoints principais (prefixo `/api`)

| Método | Rota | Papel mínimo |
| --- | --- | --- |
| POST | /auth/register, /auth/login | público |
| GET | /auth/me | autenticado |
| GET/POST | /users | listar: qualquer; criar: ADMIN |
| GET/POST | /departments | listar: qualquer; criar: ADMIN |
| GET | /dashboard/overview?period=30d | MANAGER |
| POST | /time/clock | autenticado |
| GET | /time/today, /time/history | autenticado |
| GET | /time/team | MANAGER |
| GET/POST | /chat/conversations | participante / autenticado |
| GET | /chat/conversations/:id/messages | participante |
| POST | /chat/conversations/:id/messages | participante |
| PATCH | /chat/conversations/:id/read | participante |
| GET | /audit | ADMIN |
| GET | /health | público |

O histórico do chat aceita `limit` (1–100, padrão 50) e `before` (UUID da mensagem mais antiga já carregada). A resposta inclui `items` em ordem cronológica e `hasMore`.
O overview aceita `period=7d`, `30d` ou `90d`; agrega equipe, departamentos, jornada e auditoria sob o tenant do usuário. Projetos, tarefas, reuniões e insights de IA permanecem indisponíveis até existirem módulos e dados reais para alimentá-los.

## Convenções

- **Multi-tenancy:** toda tabela de negócio tem `companyId`; toda query de serviço filtra por ele.
- **RBAC:** `@MinRole(Role.X)` por rota; hierarquia em `apps/api/src/common/roles.ts`.
- **Ponto:** máquina de estados em `time/time.rules.ts`; horário sempre do servidor; registros imutáveis.
- **Novo módulo:** crie a pasta em `apps/api/src/<modulo>`, registre no `AppModule`.

## Pendências conhecidas

- Conformidade com a Portaria MTP 671/2021 antes de vender como REP-A (não coberta aqui).
- Token em `localStorage` → migrar para cookie httpOnly em produção.
- Supabase Auth do documento foi substituído por JWT próprio (ver decisões).
