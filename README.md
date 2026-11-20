# RARY Vizion — Workspace para equipes de tecnologia

Plataforma empresarial em monorepo para gestão de colaboradores, jornada, comunicação e operações. O objetivo é reunir esses fluxos em um workspace multiempresa com controle de acesso por função e trilha de auditoria.

## Visão geral

| Módulo | Estado auditado | Capacidades disponíveis / pendências principais |
|---|---|---|
| Dashboard | Parcial, funcional | Resumo real de colaboradores, jornada, departamentos e auditoria; filtros por período e departamento com agregações de pessoas/jornada, atualização periódica. Atividade recente continua no escopo da empresa. Projetos, tarefas, reuniões e IA indisponíveis. |
| Workforce | Parcial, funcional | Cadastro, edição e arquivamento/reativação com auditoria; pesquisa e filtros por nome/e-mail/cargo, departamento, status e papel; tabela e cards. Filtros atuais são locais; hierarquia e histórico profissional ainda não existem. |
| Time | Parcial, funcional | Registro de ponto, hoje, histórico e visão de equipe com regras de cálculo. Faltam justificativas, aprovações e relatórios completos. |
| Chat | Parcial, funcional | Conversas diretas e grupos nomeados persistidos, com membros ativos da mesma empresa, paginação, leitura, polling e busca limitada às conversas do usuário. Canais, threads, anexos, reações e tempo real via socket ainda pendentes. |
| Voice | Não implementado | Item apenas informativo na navegação; sem backend ou interface funcional. |
| Meetings | Não implementado | Sem agenda, salas ou integração de áudio/vídeo. |
| Monitor | Não implementado | Sem monitoramento operacional. Definir limites de privacidade e permissões antes da implementação. |
| Projects | Não implementado | Sem projetos ou tarefas persistidos. |
| Intelligence | Não implementado | Sem integração de IA ou contexto empresarial autorizado. |
| Auditoria | Parcial, funcional | Consulta de eventos com acesso administrativo; ampliar filtros/exportação e validar retenção. |

## Sprint 06 — Implementação funcional parcial

- **Projetos:** novas rotas REST `GET/POST/PATCH /api/projects`, CRUD operacional de projetos e tarefas, Kanban e visualização em lista em `/projects`. Dados persistidos no Prisma/SQLite com isolamento por empresa.
- **Reuniões:** novas rotas REST `GET/POST /api/meetings` e `POST /api/meetings/join`; criação com código único, participantes persistidos e convites de notificação. `/meetings` oferece criação, agenda e validação por código. A mídia ao vivo continua bloqueada até LiveKit ser configurado.
- **Inbox:** `/inbox` consume notificações persistidas por usuário, permite leitura individual e leitura global.
- **Reports:** `/reports` mostra os registros reais de jornada e exporta CSV.
- **Shell:** o botão de notificações navega para a Inbox; projetos, reuniões e relatórios deixam de ser estados fictícios na navegação.
- **Integrações externas pendentes:** Voice e LiveKit não são simulados; Documents depende de armazenamento privado; Intelligence depende de provedor e credenciais; PDF não é emitido sem uma biblioteca de relatório instalada.

O visual global usa tokens centralizados em `apps/web/src/app/globals.css` e Tailwind em `apps/web/tailwind.config.ts`. A navegação fica em `apps/web/src/components/sidebar.tsx`. As páginas “soon” não simulam dados ou ações inexistentes.

## Arquitetura

- **Frontend:** Next.js 15 App Router, React, TypeScript e Tailwind em `apps/web`.
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

- Há testes unitários para regras de jornada, métricas do dashboard, autenticação demo/local, validação de ambiente e envelope HTTP de erro. Na validação do Sprint 04, `typecheck` e build de produção do frontend passaram; os 19 testes e o build da API também passaram em uma cópia temporária isolada, usada porque a instalação workspace no caminho sincronizado por OneDrive não conseguiu criar links locais.
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
- **Pendente:** paginação server-side de Workforce, histórico profissional, solicitações de ajuste/aprovação de jornada, canais, projetos, documentos, notificações e demais módulos.
- **Banco/API:** sem mudança de schema; incluídos `PATCH /users/:id` e `departmentId` opcional em `/dashboard/overview`. Filtros de Workforce continuam no cliente; o dashboard filtra dados de presença/jornada no servidor.
- **Validação:** `git diff --check` deve passar; build e testes dependem da instalação das dependências. Não declarar validação de runtime até executar `npm ci`, build e suíte de testes.
- **Próxima etapa:** Sprint 12 — completar Workforce e Time com operações persistidas, histórico auditável e fluxos de aprovação.

Os próximos cinco sprints detalhados (12–16), incluindo escopo de backend, páginas, interface, dependências e critérios de validação, estão em [docs/ROADMAP.md](docs/ROADMAP.md).

### Próximo passo recomendado

**Sprint 12 — Workforce e Time**, condicionado ao fechamento das pendências de segurança/persistência do Sprint 02: concluir operações de colaboradores, solicitações de jornada e aprovações auditáveis.

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
- **Backend/integrações:** schema Prisma para solicitações, eventos e snapshots; transições autorizadas por hierarquia; transação de auditoria; sem integração externa obrigatória.
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
