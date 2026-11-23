# Sprint 14 — Consolidação, Projects e integração do Workspace

## B. Arquitetura reconciliada

- Branch: `main`; HEAD: `0f898b8c76363f153ad9bb660c1bde28975790f4` (`Layout ReBranding - V0.4 - RR`).
- No commit, `apps/api/prisma/schema.prisma`, `PrismaService`, `@prisma/client`, dependência `prisma` e scripts Prisma estavam versionados.
- No checkout de trabalho, esses arquivos foram removidos localmente e substituídos por Supabase Auth/PostgREST. A API usa `@supabase/supabase-js`, um adaptador local de consultas semelhante à API Prisma, sem ORM Prisma instalado. O frontend usa Next.js 15 / React 18 / TypeScript; a API usa NestJS 10 / TypeScript.
- O diretório de migrations Supabase tem baseline, grants e migrations runtime/produto adicionais. `npm run setup` fez somente GETs e confirmou conectividade, mas informou que `/projects`, `/project_tasks`, `/meetings`, `/notifications`, `/permission_grants` e `record_time_entry` ainda não existem no schema do Supabase configurado.
- Evidência aponta para mudanças locais (não para outro checkout/branch) que substituíram o Prisma do commit pela arquitetura Supabase. O motivo de produto dessa substituição não está comprovado além do README local, que declara Supabase como runtime pretendido. Os dois relatórios históricos Prisma descrevem o commit-base; o relatório Sprint 13 descreve o estado local não commitado.
- O endpoint configurado é remoto, não `localhost`; não há Docker daemon nem Supabase local nas portas 54321/54322. Como o ambiente remoto não foi comprovado como desenvolvimento, nenhuma migration foi aplicada. Além disso, o runtime reportou ausente a migration prerequisite para as tabelas base de Projects.

## C. Correções

- Corrigi o teste de login para capturar e validar ambos os cookies (`rary_session` e `rary_refresh`), seus atributos HttpOnly/Secure/SameSite/path e a ausência de tokens no corpo.
- Corrigi o teste de reuniões para fornecer reuniões reais à fixture e validar que reuniões de equipe, privadas convidadas e privadas organizadas pelo usuário aparecem, enquanto privadas alheias não aparecem.
- Projects recebeu validação server-side para título, status, prioridade, prazos e etiquetas; endpoint de exclusão de tarefa; ciclos de dependência continuam rejeitados.

## D–G. Funcionalidades implementadas

### Projects 3.0

- Drag and drop nativo entre colunas com persistência via `PATCH`; alteração acessível por seletor continua disponível. Mudanças otimistas atualizam o quadro e recarregam o estado do servidor em caso de erro.
- Filtros por texto, status e prioridade; etiquetas visíveis nos cards; prioridade, prazo, responsável e progresso de subtarefas em cards compactos.
- Drawer permite editar título, descrição, status, prioridade, prazo e etiquetas; cria/conclui/reabre/exclui subtarefas; lista, adiciona e remove dependências; identifica tarefa bloqueadora; comentários têm criar/editar/excluir na interface, com edição restrita ao autor e exclusão autorizada pelo servidor.
- Busca global agora navega a projeto/tarefa e o Projects seleciona o recurso solicitado pela URL.
- Timeline permanece cronológica por prazo, sem barras Gantt ou marcos.

### Workspace e persistência

- Preferências de layout têm endpoints pessoais (`GET/PATCH /workspace/preferences`) e sincronizam a ordem/visibilidade em `workspace_preferences`; há fallback local para configuração antes da migration.
- Widget “Minha semana” agrega tarefas com prazo, reuniões autorizadas e eventos internos da semana atual.
- Focus Mode persiste sessões em `focus_sessions`, suporta iniciar, pausar, retomar e finalizar, mostra histórico e exclui pausas da duração. A associação de tarefa é validada contra empresa. Não modifica a jornada oficial.

### Calendário

- Novo `/calendar` oferece dia, semana, mês e agenda; combina reuniões visíveis, tarefas com prazo e eventos/compromissos persistidos, sem duplicar registros de origem.
- Backend oferece `GET/POST /calendar`, `PATCH/DELETE /calendar/:id`; intervalos limitados a 93 dias e eventos a sete dias. Datas são convertidas para ISO no backend e exibidas no timezone local do navegador. Eventos privados só aparecem ao autor; editar/excluir exige autoria ou papel administrativo/gerencial.
- Interface permite filtrar fontes, criar, editar e excluir eventos, abrir o recurso associado e sinalizar sobreposição entre reuniões/eventos.

### Busca global

- Endpoint `GET /search?q=...` consulta Projects, tarefas, pessoas, reuniões, mensagens de conversas do usuário e eventos. Permissões de módulo são consultadas no backend, resultados têm limite total de 32 e o Command Menu usa debounce, navegação de teclado e estado de carregamento.
- Conversas são filtradas por associação do usuário e empresa; reuniões privadas e eventos privados alheios são excluídos.

## H. Visual e acessibilidade

- Kanban mantém cards compactos, ganhou drag nativo e alternativa por teclado via seletor. Drawer existente usa `role=dialog`, `aria-modal` e botão com label; calendário tem grid semanal/mensal com rolagem horizontal em telas estreitas.
- Preservados tokens dark/violeta. Não houve captura/revisão visual automatizada nas larguras 360–1920px; essa validação segue pendente.

## I. Testes e builds

- Typecheck API/Web: passou.
- Suíte API: 42/42 aprovados.
- Build API e Web (`--no-lint`): passaram; `/calendar`, `/projects` e `/workspace` aparecem no build.
- `npm run setup`: GET de verificação passou, mas relatou migrations runtime base ausentes.
- Não foi possível validar SQL, CRUD ou persistência em banco real de desenvolvimento: não existe Supabase local, Docker daemon indisponível e o URL configurado é remoto sem classificação confiável. Migrations `20261122000100_projects_3.sql` e `20261122000200_workspace_focus_calendar.sql` estão pendentes e dependem da migration `20261121000100_supabase_runtime_modules.sql`.

## J. Limitações e riscos abertos

- Sem validação de migration/integration em banco; APIs novas retornam erro até aplicar as migrations na ordem documentada em um Supabase de desenvolvimento isolado.
- Drag and drop usa HTML nativo; não há biblioteca com animação/reordenação dentro da mesma coluna. A timeline não representa duração nem desenha dependências.
- Busca é limitada a 500 projetos/associações e 32 resultados; não inclui anexos/documentos. Links de pessoa/reunião/conversa abrem os módulos, mas detalhes podem não selecionar o registro em todas as telas.
- Calendário não tem participantes convidados para eventos privados; sobreposição considera somente reunião/evento de horário marcado, não prazos de tarefas. Dia/mês são grids compactos.
- Activity Center, eventos de auditoria de tarefa, notificações de comentário, marcos, workforce avançado e tempo real seguem pendentes.
- O checkout já tinha 98 caminhos modificados/não rastreados no início; essas alterações de outros escopos foram preservadas.

## K. Próximos passos

1. Criar/conectar um Supabase de desenvolvimento isolado, confirmar projeto e backup quando aplicável.
2. Aplicar as três migrations na ordem e executar CRUD real para projeto, comentário, subtarefa, dependência, preferências, sessão de foco e evento.
3. Completar suíte e builds, revisar teclado/mobile em 360/390/768/1024/1440/1920px.
4. Adicionar testes E2E com Supabase e verificação cross-tenant contra registros reais.

## L. Próximo Sprint recomendado

**Sprint 15 — Workforce 2.0 e auditoria operacional:** consolidar equipes/departamentos com relações de hierarquia reais, Activity Center filtrado por autorização, histórico de tarefa e revisões visuais responsivas; iniciar somente após a persistência Supabase estar validada em ambiente de desenvolvimento.
