# RARY Vizion — Workspace para equipes de tecnologia

Plataforma empresarial em monorepo para gestão de colaboradores, jornada, comunicação e operações. O objetivo é reunir esses fluxos em um workspace multiempresa com controle de acesso por função e trilha de auditoria.

## Visão geral

| Módulo | Estado auditado | Capacidades disponíveis / pendências principais |
|---|---|---|
| Dashboard | Parcial, funcional | Resumo real de colaboradores, jornada, departamentos e auditoria; filtros por período e departamento com agregações de pessoas/jornada, atualização periódica. Atividade recente continua no escopo da empresa. Projetos, tarefas, reuniões e IA indisponíveis. |
| Workforce | Parcial, funcional | Cadastro, edição e arquivamento/reativação com auditoria; pesquisa e filtros por nome/e-mail/cargo, departamento, status e papel; tabela e cards. Filtros atuais são locais; hierarquia e histórico profissional ainda não existem. |
| Time | Parcial, funcional | Registro de ponto, hoje, histórico e visão de equipe com regras de cálculo. Faltam justificativas, aprovações e relatórios completos. |
| Chat | Parcial, funcional | Conversas diretas persistidas, paginação, leitura, polling e busca de mensagens apenas nas conversas do usuário. Sem grupos/canais, anexos, reações ou tempo real via socket. |
| Voice | Não implementado | Item apenas informativo na navegação; sem backend ou interface funcional. |
| Meetings | Não implementado | Sem agenda, salas ou integração de áudio/vídeo. |
| Monitor | Não implementado | Sem monitoramento operacional. Definir limites de privacidade e permissões antes da implementação. |
| Projects | Não implementado | Sem projetos ou tarefas persistidos. |
| Intelligence | Não implementado | Sem integração de IA ou contexto empresarial autorizado. |
| Auditoria | Parcial, funcional | Consulta de eventos com acesso administrativo; ampliar filtros/exportação e validar retenção. |

O visual global usa tokens centralizados em `apps/web/src/app/globals.css` e Tailwind em `apps/web/tailwind.config.ts`. A navegação fica em `apps/web/src/components/sidebar.tsx`. As páginas “soon” não simulam dados ou ações inexistentes.

## Arquitetura

- **Frontend:** Next.js 14 App Router, React, TypeScript e Tailwind em `apps/web`.
- **Backend:** NestJS, TypeScript e API REST em `apps/api`; prefixo `/api`, porta padrão 3333.
- **Persistência:** Prisma sobre SQLite no fluxo local; schema em `apps/api/prisma/schema.prisma`. Existem migrações e Auth Supabase opcionais, mas a camada de dados dos módulos continua Prisma/SQLite. A configuração Supabase não migra automaticamente os dados Prisma; alinhar a persistência antes de operar Supabase como fonte empresarial de produção.
- **Autenticação:** se Supabase estiver configurado, contas reais usam Supabase Auth/perfil; sem Supabase, registro e login usam usuários Prisma com senha bcrypt e token local assinado; contas demo mantêm tokens próprios. Guardas revalidam usuário/papel ativo por requisição. O token no cliente usa `localStorage` (migrar para cookie httpOnly antes de produção).
- **Domínio e módulos API:** Auth, usuários, departamentos, ponto, chat, dashboard, auditoria e health. Não há projetos, reuniões, voz, monitor ou IA no `AppModule`/schema auditados.
- **Tempo real:** polling periódico no Dashboard e Chat; não há WebSocket implementado nos módulos auditados.
- **Multiempresa:** entidades de negócio possuem `companyId`; serviços devem limitar consultas ao tenant autenticado. RBAC usa `@MinRole` e guardas comuns.

## Rodar localmente

Requisitos: Node.js 20+.

```bash
npm install
npm run setup
npm run dev
```

O setup prepara `.env`, o banco local e dados demo. A API fica em `http://localhost:3333/api`; o web em `http://localhost:3000`. Consulte `http://localhost:3333/api/health` para verificar a API.

Em desenvolvimento, o app entra por padrão como `owner@demo.com`. Para desativar, defina `DEV_AUTO_LOGIN="false"` na API e `NEXT_PUBLIC_DEV_AUTO_LOGIN="false"` no web. A API bloqueia auto-login em produção. Contas demo usam senha `Demo@12345`: `superadmin@demo.com`, `owner@demo.com`, `admin@demo.com`, `manager@demo.com`, `teamleader@demo.com`, `developer@demo.com`, `dev@demo.com` e `guest@demo.com`.

## Qualidade e segurança — estado conhecido

- Há testes unitários para regras de jornada, métricas do dashboard, autenticação demo/local, validação de ambiente e envelope HTTP de erro. Nesta execução, o build não encontrou `nest` e a suíte não encontrou `ts-node/register`; a instalação de dependências não terminou.
- Todas as rotas são submetidas a guardas globais; auditar cada endpoint novo para autorização, isolamento por empresa e validação de DTO.
- Erros HTTP da API agora usam envelope comum com `statusCode`, `message`, `requestId`, `path` e `timestamp`; `X-Request-Id` correlaciona a resposta com logs sem registrar query string.
- Falha ou ausência de credenciais retorna 401 para que o cliente limpe sessões expiradas; 403 fica reservado a usuário autenticado sem permissão.
- Contas/tokens demo são recusados em `NODE_ENV=production`; tokens locais também são limitados ao modo sem Supabase e usuários inativos perdem acesso.
- No modo local, cadastro de empresa e login persistem no Prisma/SQLite; novos colaboradores podem autenticar com a senha inicial. O modo Supabase exige alinhar/espelhar dados empresariais antes de habilitar criação de usuários pelos módulos Prisma.
- Registros de ponto são imutáveis por desenho; correções devem gerar registros/auditoria adequados.
- Pendências antes de produção: migrar JWT de `localStorage` para cookie httpOnly, rever configuração de auth/Supabase, validar política de CORS/rate limit e revisão independente de isolamento multi-tenant.
- Conformidade com Portaria MTP 671/2021 não está coberta; não comercializar como REP-A sem avaliação especializada.

## Roadmap técnico

O plano executável, com objetivos, escopo, páginas, tarefas, dependências, critérios, prioridade e estado de cada sprint está em [docs/ROADMAP.md](docs/ROADMAP.md). O documento descreve os Sprints 02 a 16 e deve ser atualizado ao fechar cada entrega.

### Execução do Sprint 03 — 19/11/2026

- **Concluído nesta etapa:** Workforce recebeu pesquisa/filtros e visualizações tabela/cards; API ganhou edição e arquivamento reativável, com hierarquia de papéis, validação de departamento e auditoria. Login/cadastro local foi ligado a credenciais persistidas. Dashboard ganhou filtro server-side por departamento para colaboradores e métricas de jornada. Chat ganhou busca limitada às conversas participantes. Cadastro Supabase deixou de criar uma segunda empresa além da criada pelo trigger.
- **Parcial:** o Sprint global ainda não implementa Dashboard 2.0, Time 2.0, Chat 2.0 ou novos módulos. O roadmap registra as dependências reais.
- **Pendente:** paginação server-side de Workforce, histórico profissional, solicitações de ajuste/aprovação de jornada, grupos/canais, projetos, documentos, notificações e demais módulos.
- **Banco/API:** sem mudança de schema; incluídos `PATCH /users/:id` e `departmentId` opcional em `/dashboard/overview`. Filtros de Workforce continuam no cliente; o dashboard filtra dados de presença/jornada no servidor.
- **Validação:** `git diff --check` deve passar; build e testes dependem da instalação das dependências. Não declarar validação de runtime até executar `npm ci`, build e suíte de testes.
- **Próxima etapa:** Sprint 12 — completar Workforce e Time com operações persistidas, histórico auditável e fluxos de aprovação.

Os próximos cinco sprints detalhados (12–16), incluindo escopo de backend, páginas, interface, dependências e critérios de validação, estão em [docs/ROADMAP.md](docs/ROADMAP.md).

### Próximo passo recomendado

**Sprint 12 — Workforce e Time**, condicionado ao fechamento das pendências de segurança/persistência do Sprint 02: concluir operações de colaboradores, solicitações de jornada e aprovações auditáveis.

## Endpoints principais

| Método | Rota | Acesso |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | Público |
| GET | `/api/auth/me` | Autenticado |
| GET/POST | `/api/users` | Listar autenticado; criar ADMIN+ |
| PATCH | `/api/users/:id` | ADMIN+; papéis iguais ou superiores protegidos |
| GET/POST | `/api/departments` | Listar autenticado; criar ADMIN+ |
| GET | `/api/dashboard/overview?period=30d` | MANAGER+ |
| POST | `/api/time/clock` | Autenticado |
| GET | `/api/time/today`, `/api/time/history` | Autenticado |
| GET | `/api/time/team` | MANAGER+ |
| GET/POST | `/api/chat/conversations` | Participante/autenticado conforme ação |
| GET | `/api/chat/search?q=termo&limit=20` | Autenticado; apenas conversas das quais participa |
| GET/POST | `/api/chat/conversations/:id/messages` | Participante |
| PATCH | `/api/chat/conversations/:id/read` | Participante |
| GET | `/api/audit` | ADMIN+ |
| GET | `/api/health` | Público |

Dashboard aceita `period=7d`, `30d` ou `90d` e filtro opcional `departmentId` (UUID da empresa). Chat aceita `limit` (1–100) e `before` (UUID), retornando itens cronológicos e `hasMore`.
