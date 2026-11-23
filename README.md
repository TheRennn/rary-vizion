# RARY Vizion — Workspace para equipes de tecnologia

Plataforma empresarial em monorepo para gestão de colaboradores, jornada, comunicação e operações. O objetivo é reunir esses fluxos em um workspace multiempresa com controle de acesso por função e trilha de auditoria.

## Visão geral

| Módulo | Estado auditado | Capacidades disponíveis / pendências principais |
|---|---|---|
| Dashboard | Parcial, funcional | Dados persistidos de colaboradores, jornada, departamentos, projetos ativos, tarefas abertas/atrasadas, próximas reuniões, notificações pessoais e auditoria; filtros por período e departamento em workforce/jornada e atualização periódica. IA não implementada. |
| Meu espaço | Parcial, funcional | Resumo de jornada, tarefas, projetos, reuniões, semana integrada, inbox, chat e sessões de foco; ordem/visibilidade com persistência por usuário após migration. |
| Workforce | Parcial, funcional | Cadastro, edição e arquivamento/reativação com auditoria; pesquisa e filtros por nome/e-mail/cargo, departamento, status e papel; tabela e cards. Filtros atuais são locais; hierarquia e histórico profissional ainda não existem. |
| Time | Parcial, funcional | Registro de ponto, hoje, histórico e visão de equipe com regras de cálculo. Faltam justificativas, aprovações e relatórios completos. |
| Chat | Parcial, funcional | Conversas diretas e grupos nomeados persistidos, com membros ativos da mesma empresa, paginação, leitura, polling e busca limitada às conversas do usuário. Canais, threads, anexos, reações e tempo real via socket ainda pendentes. |
| Voice | Não implementado | Item apenas informativo na navegação; sem backend ou interface funcional. |
| Meetings | Parcial, funcional | Agenda persistida, convites, participantes e entrada registrada. Sem áudio/vídeo ou LiveKit; a tela informa esse limite. |
| Monitor | Não implementado | Sem monitoramento operacional. Definir limites de privacidade e permissões antes da implementação. |
| Projects | Parcial, funcional | Projetos e tarefas, Kanban com drag and drop persistido e alternativa por seletor, lista/timeline, filtros e busca, edição de tarefa, etiquetas, comentários com CRUD, subtarefas e dependências com proteção contra ciclos. |
| Calendário | Parcial, funcional | Dia/semana/mês/agenda com reuniões autorizadas, prazos de tarefas e eventos/compromissos internos CRUD; depende das migrations adicionais pendentes. |
| Busca global | Parcial, funcional | Ctrl/Cmd+K busca projetos, tarefas, pessoas, reuniões, mensagens de conversas participantes e eventos; resultado limitado por permissão/empresa e até 32 itens. |
| Inbox | Funcional | Notificações persistidas por usuário, filtros, leitura individual/global e indicador de não lidas no shell. |
| Intelligence | Não implementado | Sem integração de IA ou contexto empresarial autorizado. |
| Auditoria | Parcial, funcional | Consulta de eventos com acesso administrativo; ampliar filtros/exportação e validar retenção. |

## Sprint 06 — Implementação funcional parcial

- **Projetos:** rotas REST `GET/POST/PATCH /api/projects`, CRUD de projetos e tarefas, Kanban e lista em `/projects`. O schema Supabase adicional está versionado em `supabase/migrations`.
- **Reuniões:** novas rotas REST `GET/POST /api/meetings` e `POST /api/meetings/join`; criação com código único, participantes persistidos e convites de notificação. `/meetings` oferece criação, agenda e validação por código. A mídia ao vivo continua bloqueada até LiveKit ser configurado.
- **Inbox:** `/inbox` consume notificações persistidas por usuário, permite leitura individual e leitura global.
- **Reports:** `/reports` mostra os registros reais de jornada e exporta CSV.
- **Shell:** o botão de notificações navega para a Inbox; projetos, reuniões e relatórios deixam de ser estados fictícios na navegação.
- **Integrações externas pendentes:** Voice e LiveKit não são simulados; Documents depende de armazenamento privado; Intelligence depende de provedor e credenciais; PDF não é emitido sem uma biblioteca de relatório instalada.

O visual global usa tokens centralizados em `apps/web/src/app/globals.css` e Tailwind em `apps/web/tailwind.config.ts`. A navegação fica em `apps/web/src/components/app-shell.tsx`. As páginas “soon” não simulam dados ou ações inexistentes.

## Arquitetura

- **Frontend:** Next.js 15 App Router, React, TypeScript e Tailwind em `apps/web`.
- **Backend:** NestJS, TypeScript e API REST em `apps/api`; prefixo `/api`, porta padrão 3333.
- **Persistência:** Supabase é a única fonte remota de dados. A API usa Supabase Auth e PostgREST com a chave secreta somente no backend; não requer `DATABASE_URL`, `DIRECT_URL`, PostgreSQL local ou Prisma.
- **Autenticação:** cadastro, login, validação e renovação de tokens usam Supabase Auth. Access e refresh tokens ficam em cookies HttpOnly; o browser não recebe tokens em JavaScript.
- **Domínio e módulos API:** Auth, usuários, departamentos, ponto, chat, dashboard, auditoria, projetos, reuniões, notificações e health. Voice, monitor e IA não estão implementados.
- **Tempo real:** polling periódico no Dashboard e Chat; Supabase Realtime ainda não está conectado às telas.
- **Multiempresa:** escopo vem do usuário e da sessão carregados pelo servidor. Serviços de negócio limitam consultas à empresa ou à associação do usuário. RBAC mantém `@MinRole` legado e adiciona `@RequirePermission(module, action)` com overrides persistidos por empresa.

## Rodar localmente

Requisitos: Node.js 20+ e um projeto Supabase de desenvolvimento. No Windows, este fluxo usa um projeto Supabase hospedado; a stack local CLI depende de runtime de containers.

```bash
npm install
npm run supabase:dev:configure -- --project-ref=<project-ref-dev>
# Adicione SUPABASE_ACCESS_TOKEN e SUPABASE_DB_PASSWORD a apps/api/.env.dev.local
npm run supabase:dev -- projects
npm run supabase:dev -- migrations
npm run supabase:dev -- dry-run
npm run supabase:dev -- push --confirm-dev-write
npm run dev:api:project
npm run dev:web
npm run test:supabase-integration -w apps/api
```

`supabase:dev:configure` verifica que o ref solicitado coincide com `apps/api/.env` e copia apenas URL/chaves para `apps/api/.env.dev.local`; não altera o `.env` operacional. Esse arquivo é ignorado pelo Git. A CLI remota recebe somente o ref configurado e requer access token e senha do banco desse projeto. `db push` exige ainda `--confirm-dev-write`.

O projeto ref informado foi confirmado pelo usuário como desenvolvimento isolado e autorizado para migrations/testes. Aplique as seis migrations listadas em `supabase/migrations` com o dry-run antes do push. A API fica em `http://localhost:3333/api`; o web em `http://localhost:3000`. `/api/health` verifica conectividade e identifica `target: development` somente quando o host coincide com o ref configurado.

Em desenvolvimento, o app cria ou prepara `owner@demo.com` pelo Supabase Auth: `dev-login` confirma o e-mail, sincroniza a senha `DEV_DEMO_PASSWORD` (padrão local `Demo@12345`) e garante perfil ativo `OWNER`, com permissões padrão para todas as áreas. Isso só funciona com Supabase local ou explicitamente marcado como desenvolvimento; nunca use a conta demo em produção. Somente essa conta é provisionada automaticamente; os outros botões de conta de teste exigem usuários já cadastrados no Supabase. O limite padrão de login é 10 requisições por minuto por IP e rota; após um `429`, aguarde até 60 segundos antes de tentar novamente. Para desativar o login automático, defina `DEV_AUTO_LOGIN="false"` na API e `NEXT_PUBLIC_DEV_AUTO_LOGIN="false"` no web. A API bloqueia auto-login em produção.

## Qualidade e segurança — estado conhecido

Os documentos de Sprints 08–12 registram a arquitetura histórica e foram supersedidos nesta correção: o runtime atual usa Supabase Auth/PostgREST.

Cookies de autenticação são HttpOnly e renovados pelo refresh token do Supabase. Redis é obrigatório em produção; desenvolvimento usa contador em memória. As operações protegidas usam escopo de empresa validado no backend.

- Sprint 16 parcial: Supabase CLI 3.2.0 instalada como dependência do projeto; stack local desabilitada neste Windows sem containers. O usuário confirmou e autorizou o ref dev, e `apps/api/.env.dev.local` foi criado sem alterar `.env`. Ainda faltam access token e senha DB locais; migrations e CRUD remoto seguem pendentes. Static migration check, 49/49 testes API, typechecks e build API/Web passaram. Os dez estados do `/demo` passaram por 60 combinações de viewport sem overflow horizontal do documento. Veja [docs/SPRINT-16.md](docs/SPRINT-16.md).
- Sprint 17 parcial: harness de integração ampliado para subtarefas/exclusão, jornada de ponto, login/logout e visibilidade cross-company de evento privado. Nenhuma migration ou operação CRUD remota foi executada nesta etapa: faltam `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` no arquivo dev local. Veja [docs/SPRINT-17.md](docs/SPRINT-17.md).
- Todas as rotas são submetidas a guardas globais; auditar cada endpoint novo para autorização, isolamento por empresa e validação de DTO.
- Erros HTTP da API agora usam envelope comum com `statusCode`, `message`, `requestId`, `path` e `timestamp`; `X-Request-Id` correlaciona a resposta com logs sem registrar query string.
- Falha ou ausência de credenciais retorna 401 para que o cliente limpe sessões expiradas; 403 fica reservado a usuário autenticado sem permissão.
- Login demo e `dev-login` são recusados em `NODE_ENV=production`; sessões de usuários inativos são revogadas ao desativar a conta.
- Login e perfis usam Supabase Auth; dados de negócio usam Supabase PostgREST. Produção exige `CORS_ORIGIN` HTTPS e Redis TLS (`rediss://` ou HTTPS REST com token). Localmente, Redis é opcional.
- Registros de ponto são imutáveis por desenho; correções devem gerar registros/auditoria adequados.
- Pendências: aplicar a migration Supabase adicional, validar CI e imagens Docker em runner Linux, configurar proxy TLS, revisar isolamento cross-tenant e aprovar backups/restauração recorrente.
- Conformidade com Portaria MTP 671/2021 não está coberta; não comercializar como REP-A sem avaliação especializada.

## Roadmap técnico

O plano executável, com objetivos, escopo, páginas, tarefas, dependências, critérios, prioridade e estado de cada sprint está em [docs/ROADMAP.md](docs/ROADMAP.md). O documento descreve os Sprints 02 a 16 e deve ser atualizado ao fechar cada entrega.

### Registro histórico do Sprint 03 — 19/11/2026

- **Concluído nesta etapa:** Workforce recebeu pesquisa/filtros e visualizações tabela/cards; API ganhou edição e arquivamento reativável, com hierarquia de papéis, validação de departamento e auditoria. Login/cadastro local foi ligado a credenciais persistidas. Dashboard ganhou filtro server-side por departamento para colaboradores e métricas de jornada. Chat ganhou busca limitada às conversas participantes. Cadastro Supabase deixou de criar uma segunda empresa além da criada pelo trigger.
- **Parcial:** o Sprint global ainda não implementa Dashboard 2.0, Time 2.0, Chat 2.0 ou novos módulos. O roadmap registra as dependências reais.
- **Pendente:** paginação server-side de Workforce, histórico profissional, solicitações de ajuste/aprovação de jornada, canais, projetos, documentos, notificações e demais módulos.
- **Banco/API:** sem mudança de schema; incluídos `PATCH /users/:id` e `departmentId` opcional em `/dashboard/overview`. Filtros de Workforce continuam no cliente; o dashboard filtra dados de presença/jornada no servidor.
- **Validação:** `git diff --check` deve passar; build e testes dependem da instalação das dependências. Não declarar validação de runtime até executar `npm ci`, build e suíte de testes.
- **Registro histórico:** Sprint 03 — etapa parcial registrada em 19/11/2026. O estado atual dos módulos está resumido na tabela inicial e nos documentos individuais dos Sprints 08–12.


Registros anteriores do Sprint 11/12 descrevem uma arquitetura PostgreSQL/Prisma que foi removida do runtime nesta correção. Eles são histórico, não instruções operacionais atuais.

### Próximos Sprints

1. **Sprint 16 — concluir consolidação:** habilitar acesso CLI e senha do projeto dev autorizado, aplicar migrations hospedadas e rodar o harness real; validar telas autenticadas e CRUD.
2. **Sprint 17 — confiabilidade em tempo real:** somente após validar permissões e banco isolado, integrar subscriptions Supabase Realtime para recursos autorizados e medir reconexão/duplicidade.

### Briefing Sprint 05 — estado parcial

- **Implementado neste recorte:** criação de grupos nomeados com pelo menos dois outros colaboradores ativos da mesma empresa, validação de associação no servidor, seleção de participantes e abertura do grupo. Conversas diretas mantêm o fluxo existente.
- **Ainda não concluído:** os demais itens do briefing — Chat 2.0 completo, Voice, Meetings, Time, Workforce, Projects, Documents, Reports, Intelligence, Inbox, configurações, auditoria, integrações e microinterações — continuam com os estados descritos na tabela e no roadmap. Não foram criadas integrações simuladas.
- **Validação após este recorte:** typecheck do frontend e da API; 22 testes da API passaram. O build de produção não foi repetido após as mudanças de grupos.

### Execução do Sprint 04 — Complete UI Overhaul

- **Estado:** Parcialmente concluído. A linguagem visual e o shell global foram migrados para uma interface escura compacta, com sidebar, header contextual, favoritos, navegação móvel, Command Menu e drawer contextual reutilizável. As funcionalidades de negócio preexistentes foram preservadas.
- **Design system criado/refatorado:** `AppShell`, `ContextPanel`, `PageHeading`, `EmptyState`, `StatusIndicator`, `PriorityIndicator`, `CompactList`, `ActivityFeed`, `ActivityItem`, `FilterBar`, `DataTable`, `Avatar`, `Skeleton`, `ErrorState` e `ContextMenu`. Tokens globais agora refletem a paleta especificada, com bordas, superfícies e controles mais discretos. O componente de navegação anterior foi removido após sua substituição pelo shell global.
- **Páginas migradas:** Dashboard e feed de atividades; Workforce com tabela/lista e drawer real de perfil; Time com densidade compacta; Chat com painel contextual do participante; Auditoria com tabela reutilizável. Rotas sem backend (Inbox, Workspace, Projects, Voice, Meetings, Monitor, Intelligence, Documents, Reports, Automations e Settings) apresentam estado planejado e dependências sem simular dados ou ações.
- **Interações:** Ctrl/Cmd+K abre busca global navegável por setas/Enter, inclui diretório de colaboradores conforme a pesquisa digitada e oferece atalhos para as áreas operacionais existentes; favoritos ficam salvos no navegador; sidebar recolhe no desktop; navegação móvel ocupa uma gaveta; painéis contextuais fecham por Escape, botão ou clique externo.
- **Validação:** frontend `typecheck` e build de produção passaram após a migração. Cobertura visual exploratória das rotas funcionais permanece pendente; integrações de contexto para Projects/Tasks/Documents aguardam a implementação desses módulos.
- **Pendências:** filtros e ordenação de tabela, paginação, seleção múltipla, widgets configuráveis, suporte a preferências de layout persistidas no servidor, testes automatizados de interação/responsividade, e os módulos ainda sem API/schema.

## Próximos cinco Sprints detalhados

### Sprint 17 — Workforce e Time: aprovações e histórico

- **Objetivo/diagnóstico:** concluir os fluxos de pessoas e jornada; hoje edição e ponto existem, mas faltam histórico profissional, justificativas e aprovação.
- **Funcionalidades:** solicitações de ajuste com motivo, fila de aprovação, decisões e trilha imutável; histórico de cargo/departamento; paginação e filtros no servidor.
- **Backend/integrações:** solicitações, eventos e snapshots com Supabase; transições autorizadas por hierarquia; auditoria persistida no Supabase.
- **Frontend/páginas/componentes:** `/workforce`, `/time`, `/approvals`; DataTable, FilterBar, StatusIndicator, ContextPanel e ActivityFeed.
- **Testes/aceitação:** cálculo de jornada e transições de aprovação cobertos; tenant e hierarquia testados; [ ] pedidos persistem; [ ] decisões auditadas; [ ] tabela responde a filtros/paginação; [ ] desktop/mobile revisados.

### Sprint 18 — Chat: canais e colaboração

- **Objetivo/diagnóstico:** expandir conversas diretas, atualmente com polling e busca participante-scoped, para canais e trabalho em grupo.
- **Funcionalidades:** canais públicos/privados, membros, respostas, reações, mensagens fixadas, estado de leitura e notificações; anexos só após definir armazenamento e política de retenção.
- **Backend/integrações:** modelos de canal/membro/thread/reação; autorização por associação; escolher WebSocket/SSE e storage seguro após avaliar operação e custo.
- **Frontend/páginas/componentes:** `/chat`; listas compactas, activity feed de mensagens, painéis de canal/participante, menus contextuais e estados offline.
- **Testes/aceitação:** concorrência, reconexão, acesso cruzado e upload verificados; [ ] membros não leem canais sem permissão; [ ] leitura/reação persiste; [ ] falha de rede tem recuperação acessível.

### Sprint 19 — Projects: projetos, tarefas e dependências

- **Objetivo/diagnóstico:** Projects ainda é uma rota explicativa sem entidades persistidas.
- **Funcionalidades:** projetos, issues identificadas, status, prioridade, responsável, datas, comentários, dependências e vistas list/board/timeline.
- **Backend/integrações:** schema multiempresa; CRUD transacional e histórico; integração GitHub/GitLab fica opcional e somente após contratos de OAuth e escopos mínimos.
- **Frontend/páginas/componentes:** `/projects`, `/projects/[id]`, `/issues/[id]`; DataTable, Status/PriorityIndicator, ContextPanel, Command Menu e ActivityFeed.
- **Testes/aceitação:** regras de estado, tenant, hierarquia e dependências testadas; [ ] CRUD persiste; [ ] identificadores são únicos por empresa; [ ] listas e painel mantêm filtros ao navegar.

### Sprint 20 — Documents e Knowledge Base

- **Objetivo/diagnóstico:** Documents não possui API, armazenamento nem preview hoje.
- **Funcionalidades:** pastas, metadados, busca, versões, preview seguro, compartilhamento interno e vínculo com projetos/conversas.
- **Backend/integrações:** selecionar storage compatível com acesso privado, URLs assinadas, antivírus, limites de tipo/tamanho, quotas e retenção; auditar download/compartilhamento.
- **Frontend/páginas/componentes:** `/documents`, `/documents/[id]`; CompactList, DataTable, SearchInput, FilterBar, ContextPanel, Empty/ErrorState.
- **Testes/aceitação:** autorização, MIME, tamanho, URLs expiradas e isolamento cross-tenant testados; [ ] nenhum objeto é público por padrão; [ ] preview/download respeita permissões; [ ] teclado e mobile revisados.

### Sprint 21 — Inbox, Reports e observabilidade de produto

- **Objetivo/diagnóstico:** Inbox/Reports e preferências ainda são estados planejados; Dashboard já agrega workforce e jornada, mas não configura widgets/exportações.
- **Funcionalidades:** notificações persistentes com preferências, relatórios filtráveis/exportáveis, automações com logs somente após escopo, limites e permissões definidos.
- **Backend/integrações:** eventos/outbox, deduplicação, APIs de relatório com agregação e auditoria; exportação assíncrona; escolher canais de notificação com consentimento e opt-out.
- **Frontend/páginas/componentes:** `/inbox`, `/reports`, `/settings`; NotificationPanel, DataTable, FilterBar, Command Menu, ContextPanel e Skeleton.
- **Testes/aceitação:** entrega duplicada, permissões, exportações e filtros testados; [ ] notificações podem ser lidas/descartadas; [ ] relatório reproduz os filtros; [ ] preferências persistem; [ ] desempenho e acessibilidade medidos.

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
| POST | `/api/chat/conversations/groups` | Autenticado; seleciona membros ativos da mesma empresa |
| GET | `/api/chat/search?q=termo&limit=20` | Autenticado; apenas conversas das quais participa |
| GET/POST | `/api/chat/conversations/:id/messages` | Participante |
| PATCH | `/api/chat/conversations/:id/read` | Participante |
| GET | `/api/audit` | ADMIN+ |
| GET | `/api/health` | Público |

Dashboard aceita `period=7d`, `30d` ou `90d` e filtro opcional `departmentId` (UUID da empresa). Chat aceita `limit` (1–100) e `before` (UUID), retornando itens cronológicos e `hasMore`.
