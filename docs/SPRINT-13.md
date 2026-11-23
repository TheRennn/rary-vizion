# Sprint 13 — Projects 3.0 (entrega parcial)

## Estado e segurança de dados

O checkout usa Supabase Auth/PostgREST, não Prisma. O Sprint 12 e o README registram essa arquitetura. Há mudanças locais preexistentes no checkout (inclusive exclusão local do schema Prisma); elas foram preservadas. Nenhuma migration foi aplicada, nenhuma conexão de banco foi aberta e nenhum cutover ou dado real foi alterado. A migration runtime anterior ainda precisa ser aplicada conforme instruções do README antes das tabelas deste Sprint estarem disponíveis.

## Implementado

- Kanban e lista existentes mantidos; nova busca local por título/descrição e contagem filtrada.
- Nova timeline de tarefas ordenada por prazo, com indicador visual de tarefas vencidas/concluídas e acesso ao detalhe.
- Drawer acessível de detalhes da tarefa com lista/criação de subtarefas e leitura/criação de comentários.
- Persistência aditiva de autor e relação pai em tarefas, etiquetas preparadas, comentários e dependências.
- Endpoints de comentários: `GET/POST /projects/:id/tasks/:taskId/comments`, `PATCH/DELETE .../:commentId`.
- Endpoints de dependências: `GET/POST /projects/:id/tasks/:taskId/dependencies` e `DELETE .../:dependsOnTaskId`.
- Todas as operações confirmam a empresa do projeto e a associação da tarefa ao projeto. Comentários só podem ser editados pelo autor; exclusão pelo autor ou OWNER/ADMIN/MANAGER. Dependências e subtarefas ficam limitadas a tarefas do mesmo projeto.
- Migration SQL aditiva em `supabase/migrations/20261122000100_projects_3.sql`, com índices de prazo/pai e RLS habilitado nas tabelas novas; acesso da API usa service role no backend após checagem explícita do escopo.

## Limitações / não implementado

- Esta entrega cobre a prioridade inicial Projects, não o Sprint 13 inteiro.
- O Kanban ainda usa seletor de status para persistir mudanças; drag and drop não foi implementado.
- A timeline é uma lista cronológica por prazo, sem barras de duração, marcos, dependências desenhadas ou edição de datas.
- Dependências persistem, são limitadas ao projeto e rejeitam ciclos (a validação percorre até 500 nós); ainda não aparecem visualmente na tela.
- Não há CRUD de edição/exclusão de comentário no frontend, notificação de participantes, histórico/audit de tarefa ou upload seguro de anexos.
- A busca é local aos projetos/tarefas já carregados, sem paginação server-side.
- Workspace continua usando preferências locais; sessões de foco e semana integrada não foram implementadas.
- Calendário global, Activity Center, busca global, Intelligence operacional, workforce avançado e WebSocket continuam pendentes. O Command Menu Ctrl+K existente navega por rotas e pessoas permitidas, sem busca unificada de todos os recursos.
- Datas continuam armazenadas como timestamptz e exibidas no timezone local do navegador. Filtros por intervalo/timezone no calendário ainda não existem.

## Validação

Resultados nesta entrega: typecheck API/web passou; build API e build Web (`--no-lint`) passaram; os 5 testes focados de Projects passaram. A suíte API completa executou 32 testes e teve 2 falhas em testes que já estavam no checkout antes desta alteração: expectativa antiga do nome do cookie de refresh (`auth.controller.spec.ts`) e fixture de participantes ausente (`meetings.service.spec.ts`); os demais 30 passaram. `git diff --check` passou para arquivos versionados alterados por esta entrega; o checkout também contém uma linha em branco excedente preexistente em `apps/api/src/app.module.ts`. Prisma validate não se aplica: runtime atual não tem schema/dependência Prisma.

Não aplicar migration até validar o destino de desenvolvimento explicitamente. Testes de integração com Supabase e revisão browser/responsiva continuam necessários.
