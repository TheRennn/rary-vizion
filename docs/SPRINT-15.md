# RARY Vizion — Sprint 15

## Status

**Parcial e bloqueado para as etapas dependentes de banco.** Nenhuma migration foi aplicada ao Supabase remoto configurado. Este relatório separa validações unitárias/builds de persistência real; mocks não contam como testes de integração.

## Arquitetura auditada

- A API usa Supabase Auth para identidade e PostgREST via `@supabase/supabase-js` para dados.
- `SupabaseDataService` cria um cliente público para Auth e um `adminClient` com chave secreta para operações de dados. A chave secreta permanece na API; ela não é adequada para o navegador.
- Não há Prisma ativo no runtime nem URL PostgreSQL usada pela aplicação.
- O runtime mapeia as tabelas `companies`, `departments`, `users`, `time_entries`, `audit_logs`, `conversations`, `conversation_participants`, `chat_messages`, `projects`, `project_tasks`, `project_task_comments`, `project_task_dependencies`, `meetings`, `meeting_participants`, `notifications`, `permission_grants`, `workspace_preferences`, `focus_sessions` e `calendar_events`.
- A autenticação de novos usuários é sincronizada por trigger em `auth.users`; a função de jornada é `record_time_entry`.
- RLS está habilitada em tabelas de negócio, mas as políticas atuais são limitadas às leituras de empresas e usuários. Como o backend usa a chave service role, RLS não substitui a autorização por rota, empresa e recurso na API. Não foi feita validação de RLS contra banco.

## Migrations e divergências

Ordem encontrada em `supabase/migrations`:

1. `20261119000000_initial.sql` — baseline com empresas, departamentos, usuários, jornada, auditoria e chat.
2. `20261119000100_service_role_grants.sql` — grants; repete grants já presentes na baseline.
3. `20261121000100_supabase_runtime_modules.sql` — projetos, tarefas, reuniões, notificações, permissões, trigger Auth e RPC de jornada.
4. `20261122000100_projects_3.sql` — subtarefas, etiquetas, comentários e dependências.
5. `20261122000200_workspace_focus_calendar.sql` — preferências, foco e eventos do calendário.

A baseline existe; não precisou ser reconstruída. O código de runtime inclui todas as tabelas listadas acima, e os arquivos de migration cobrem esses modelos. Essa comparação de código e SQL é estática; a cadeia ainda não foi reproduzida em um banco vazio.

## Ambiente isolado e persistência

Não há PostgreSQL, `psql`, Supabase CLI ou serviço PostgreSQL instalado/acessível nesta máquina. O comando `docker info` não encontrou um daemon Docker; `docker-compose.dev.yml` define apenas Redis. O Supabase configurado na API é remoto e não foi demonstrado como ambiente de desenvolvimento isolado.

Uma verificação GET-only anterior de `npm run setup` conectou ao projeto configurado e identificou que as rotas PostgREST para tabelas das migrations adicionais ainda não existem. Nenhum dado foi escrito e nenhuma migration foi aplicada. Por isso, operações reais de Projects, Workspace, Calendar, busca ou RLS não podem ser validadas com segurança nesta máquina neste momento.

## Realtime, Activity Center e Timeline

- `@supabase/supabase-js` está disponível, mas não há subscriptions Realtime conectadas no cliente web ou na API.
- O app usa polling no dashboard e chat; isso não equivale a Realtime.
- Existe `audit_logs`, mas ele também registra ações administrativas. Não foi criado um feed de atividade separado nem uma estratégia validada de eventos de domínio. Reutilizar todo o log no feed poderia expor metadados administrativos.
- Projects já oferece um modo Timeline básico. Marcos e campos de início não estão no modelo atual; dependências são persistidas, mas ainda não há Gantt com arestas desenhadas.
- Nenhuma interface nova de Activity Center, Gantt ou Realtime foi anunciada como funcional sem schema e autorização por recurso validados.

## Validação executada

- Suíte API: **42/42 testes unitários/mocks passaram**. Não são testes de persistência real.
- Typecheck API: passou.
- Typecheck Web: passou.
- Build API: passou.
- Build Web: passou na repetição isolada; a primeira tentativa concorrente falhou ao abrir `apps/web/.next/trace` com `EPERM`.
- `git diff --check`: passou; Git emitiu avisos de conversão CRLF.
- Tela de login aberta no navegador local e inspecionada em 360, 390, 768, 1024, 1440 e 1920 px; `documentElement.scrollWidth` e `body.scrollWidth` corresponderam à largura em todos os seis tamanhos. A checagem visual cobre somente login: a API não autenticou o navegador e as páginas internas não puderam ser revisadas.
- Integração com banco, RLS e Realtime: não executadas. Revisão visual de dashboard, Projects, Workspace, Calendar, Activity Center e Command Menu continua pendente.

## Próximos passos necessários

1. Iniciar um Supabase local isolado com Docker disponível, ou receber credenciais de um projeto Supabase de desenvolvimento separado e autorizado.
2. Aplicar as cinco migrations do zero nesse ambiente e verificar tabelas, índices, constraints, grants e políticas.
3. Executar testes de persistência com fixtures descartáveis e cenários cross-tenant/privados.
4. Só então implementar e validar eventos persistidos, Activity Center e Realtime com autorização por recurso.
5. Completar Gantt e a revisão responsiva com navegador real; repetir o build web fora de concorrência.

**Conclusão:** Sprint 15 não está concluído. Persistência real e RLS são bloqueios objetivos para os critérios funcionais centrais; o Supabase remoto permaneceu intacto.
