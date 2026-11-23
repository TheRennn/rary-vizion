# RARY Vizion — Sprint 16

## Estado

**Parcial.** Foi criado o fluxo Windows para Supabase hospedado de desenvolvimento, proteção por project ref, validador de migrations, harness de integração, preview visual, Activity Center inicial e cronograma Gantt com datas persistidas. A CLI está instalada. O usuário confirmou que o ref existente em `.env` é projeto de desenvolvimento isolado e autorizou migrations e CRUD de teste. Ainda faltam acesso CLI e senha DB em arquivo local; nenhuma migration foi aplicada até este momento.

## Ambiente de desenvolvimento

`supabase/config.toml` preserva a configuração de projeto local para outros runtimes. Neste Windows, a stack local não é usada: o CLI atual exige runtime de containers e os comandos locais foram bloqueados por este fluxo.

Comandos adicionados:

```powershell
npm run supabase:check
npm run supabase:dev:configure -- --project-ref=<project-ref-dev>
# Adicione SUPABASE_ACCESS_TOKEN e SUPABASE_DB_PASSWORD em apps/api/.env.dev.local
npm run supabase:dev -- projects
npm run supabase:dev -- migrations
npm run supabase:dev -- dry-run
npm run supabase:dev -- push --confirm-dev-write
npm run dev:api:project
npm run dev:web
npm run test:supabase-integration -w apps/api
```

`supabase:dev:configure` confere que o ref digitado coincide com o URL já configurado em `apps/api/.env` e cria `.env.dev.local` com as chaves necessárias, sem imprimir nem sobrescrever as credenciais operacionais. Esse arquivo é ignorado pelo Git. Acrescente nele `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` do projeto dev; não use credenciais em argumentos de linha de comando. `dev:api:project` lê só esse arquivo e remove as credenciais da CLI do ambiente da API.

`supabase:dev -- migrations` mostra o histórico do ref explícito; `dry-run` apresenta o que seria enviado. `push` requer `--confirm-dev-write` e usa `--remote=<ref>`, sem link implícito. A documentação oficial descreve esses comandos remotos e seus requisitos de autenticação ([CLI e projetos hospedados](https://supabase.com/docs/guides/local-development/cli/getting-started), [push de migrations](https://supabase.com/docs/reference/cli/supabase-db-push)).

## Migrations

`npm run supabase:check` valida nomes e ordem dos seis arquivos, existência e RLS das 20 tabelas, trigger Auth, grant restrito da RPC de jornada, ausência de statements destrutivos e ausência de marcadores `service_role` no código frontend. É uma verificação estática, não prova que o SQL foi aplicado.

A migration `20261123000100_sprint16_activity_gantt.sql` adiciona `activity_events`, índices, policy de leitura por tenant/destinatário e campos de início, conclusão e marco em `project_tasks`. A migration é aditiva; nenhuma tabela ou dado é removido. As seis migrations continuam pendentes de aplicação remota.

## Harness de integração

`apps/api/scripts/supabase-integration.smoke.mjs` exige `apps/api/.env.dev.local` com ambiente development, URL/ref correspondentes, API em loopback e health check confirmando `target: development` antes de qualquer escrita. O script testa projetos, tarefas e status após nova leitura, comentários CRUD, dependências/ciclo, preferências, foco, calendário, Activity Center, isolamento cross-tenant pela API e leitura anônima de atividades sob RLS. Cria contas empresariais de teste com identificadores únicos e tenta remover usuários e empresas no `finally`.

O harness ainda não foi executado: faltam `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` no arquivo local. Depois do dry-run/push remoto, rode a API com `dev:api:project` e execute o harness.

## Proteção da service role

A service role continua somente na API. O scanner estático do Supabase e testes unitários de Activity, Projects, Calendar, Search, Chat e Workspace verificam marcadores de segredo e escopo aplicado nos serviços. O endpoint público de health informa somente `target: local|hosted` para permitir ao harness confirmar que a API não aponta para um projeto hospedado.

Esses testes de contrato não comprovam autorização real em PostgREST, RLS ou recursos privados; isso segue dependente do harness contra o projeto dev autorizado.

## Demo visual isolado

`/demo` apresenta fixtures estáticas para Dashboard, Projects, Workspace, Calendar, Workforce, Time, Chat, Meetings, Inbox e Settings. Cada vista tem rótulo persistente de demonstração e aviso de que não chama API nem grava no banco. O AuthProvider ignora chamadas de sessão nessa rota somente fora de produção; em produção, a rota responde 404. Não é uma sessão demo nem um caminho alternativo de autenticação.

## Activity Center

O endpoint `GET /api/activity` exige a permissão `dashboard:view` e restringe tenant e destinatário (`target_user_id` nulo ou usuário atual). Oferece filtro por módulo, período, projeto e título, cursor de paginação e limites para entrada/período. A tabela guarda resumo fixo, autor e URL de recurso; não armazena corpo de chat/comentário. Eventos iniciais são registrados para projeto criado, tarefa atribuída/concluída, comentário criado, reunião agendada e evento de calendário criado. Reuniões/eventos privados são endereçados a participantes/criador.

Activity events são melhor esforço enquanto a migration estiver pendente: falha ao gravar o feed não reverte a operação primária, e a tela fica sem eventos até o schema existir. Os eventos e políticas ainda não foram testados contra Postgres/Supabase real.

## Gantt e Timeline

Projects agora armazena início, prazo, conclusão automática por status e marcador de marco. O endpoint valida datas e impede início depois do prazo. A tela Projects oferece escala diária, semanal e mensal, navegação de período, destaque do dia atual, filtros por responsável/status/prioridade, estado de atraso, campos de data editáveis via API e arestas derivadas dos registros de dependência do projeto. Tarefas sem datas ficam sem barras; nenhum cronograma estimado é inventado.

## Realtime

Realtime não foi habilitado. A API usa cookie HttpOnly e service role no servidor; o browser não dispõe de token Supabase de usuário para assinar canais privados. Expor um bearer token ou fazer subscription com credencial privilegiada contornaria o modelo atual. A etapa precisa de um desenho de autorização para cada recurso e de teste local de publicação/recebimento antes de ser ligada.

## Validação desta etapa

- Validador de migrations: passou em seis arquivos, 20 tabelas; zero instruções de remoção/exclusão detectadas.
- Suíte API completa: 49/49 passou, incluindo a validação de project ref dev.
- Typecheck API e Web: passaram.
- Build API e Web: passou (`npm run build`).
- API `dev:api:project` e health check remoto somente leitura: passaram; `/api/health` retornou Supabase `ok` e `target: development`.
- Harness de integração: ainda não executado. O preflight do CLI recusou antes de qualquer chamada remota porque faltam `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` em `apps/api/.env.dev.local`. A CLI Supabase 3.2.0 está instalada no projeto.
- Navegador: os dez estados do `/demo` (Dashboard, Projects/Gantt, Workspace, Calendar, Workforce, Time, Chat, Meetings, Inbox e Settings) foram verificados nos viewports 360×800, 390×844, 768×1024, 1024×768, 1440×900 e 1920×1080. Em 60 combinações, o título esperado carregou e `documentElement.scrollWidth` não excedeu `clientWidth`. Nav, grade semanal do calendário e Gantt usam rolagem interna nas larguras móveis; sem overflow horizontal da página. Isso verifica as fixtures visuais do demo, não as rotas autenticadas com API.
- Supabase remoto: o usuário confirmou que o ref fornecido é o projeto dev isolado e autorizou migrations e CRUD temporário. O `.env.dev.local` separado foi criado. Nenhuma migration foi aplicada até o momento; falta adicionar token CLI e senha DB localmente.
- `git diff --check`: passou; o Git apenas emitiu avisos de conversão LF/CRLF já configurada para alguns arquivos.

## Pendências e próximo Sprint

1. Adicionar `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` ao arquivo local `apps/api/.env.dev.local`.
2. Conferir projetos e histórico do ref autorizado, executar dry-run e aplicar as seis migrations.
3. Subir a API com `npm run dev:api:project` e executar CRUD persistido, isolamento multiempresa e RLS pelo harness.
4. Validar as páginas autenticadas nos seis viewports, além do demo estático já revisado.
5. Desenhar e testar canal seguro Supabase Realtime sem expor access/service tokens ao browser.

**Sprint 16 permanece parcial.** O browser demo é evidência visual para os layouts de referência, não confirmação do conteúdo/API das páginas internas autenticadas.
