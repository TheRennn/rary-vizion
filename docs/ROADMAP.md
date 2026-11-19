# Roadmap técnico — RARY Vizion

Este roadmap parte da auditoria do repositório em 19/11/2026. “Pendente” significa que o trabalho ainda não está implementado nem validado. Cada sprint deve atualizar seu estado e registrar decisões no PR ou histórico de entrega. Não marcar como concluído com telas apenas visuais.

## Sprint 02 — Backend e Arquitetura

- **Objetivo:** estabilizar contratos, persistência e limites de segurança antes da expansão funcional.
- **Escopo:** API NestJS, Prisma/SQLite, configuração Supabase, autenticação, serviços comuns.
- **Páginas:** login/registro, todas as páginas autenticadas (impacto indireto).
- **Funcionalidades:** persistência previsível entre ambientes; mensagens de erro consistentes; validação de entrada; autorização e isolamento por tenant.
- **Tarefas técnicas:**
  - [ ] Documentar modo de persistência suportado por ambiente e alinhar migrações com Prisma.
  - [ ] Revisar guards, identidade autenticada, papéis e cobertura de cada controller.
  - [ ] Auditar toda query de negócio para escopo `companyId` e testar tentativas cross-tenant.
  - [x] Definir envelope de erro consistente e logging com request ID; validar política global de DTO.
  - [x] Recusar tokens/contas demo em produção e revalidar status ativo no fluxo local.
  - [ ] Planejar migração segura de token em `localStorage` para cookie httpOnly e proteção CSRF.
  - [ ] Documentar variáveis de ambiente e remover divergências entre setup e runtime.
- **Dependências:** nenhuma; precede os módulos que precisam de novos contratos.
- **Critérios de conclusão:** [ ] arquitetura e fluxos documentados; [ ] autorização/tenant verificados; [ ] migração/persistência reproduzível; [x] falhas retornam envelope estável e ID correlacionável; [ ] fluxos de login e sessão validados.
- **Prioridade:** Crítica. **Status:** Parcial (envelope de erros/IDs de requisição, status 401/403, login/cadastro local com senha bcrypt e token local revalidado, validação de ambiente reforçada; persistência Supabase/Prisma, revisão completa de tenants e sessão httpOnly seguem pendentes).

## Sprint 03 — Workforce e Time

- **Objetivo:** completar o ciclo de gestão de pessoas e jornada com regras verificáveis.
- **Escopo:** API e páginas `workforce`, `time`, perfis e departamentos.
- **Funcionalidades:** cadastro/edição, departamentos e cargos, status, filtros, visão tabela/cards, jornada, justificativas, aprovações e relatórios.
- **Tarefas técnicas:**
  - [ ] Mapear operações existentes e completar CRUD com autorização por papel.
  - [ ] Implementar busca, filtro por departamento/status e paginação no servidor quando necessário.
  - [ ] Definir fluxo auditável de correção/justificativa de ponto sem alterar registros imutáveis.
  - [ ] Criar aprovação gerencial com estados e histórico de decisão.
  - [ ] Consolidar cálculo de horas, intervalos e horas extras em regras de domínio documentadas.
  - [ ] Adicionar estados de carregamento, vazio, erro e confirmação nas ações.
- **Dependências:** Sprint 02 (contratos, segurança e persistência).
- **Critérios de conclusão:** [ ] operações persistem; [ ] isolamento por tenant e permissões aprovados; [ ] cálculos cobertos por testes; [ ] filtros e paginação coerentes; [ ] desktop e mobile revisados.
- **Prioridade:** Alta. **Status:** Parcial (fundação existente; itens listados pendentes).

## Sprint 04 — Chat e Comunicação

- **Diagnóstico atualizado:** busca textual de mensagens já está disponível e limitada a conversas com participação; canais/grupos, threads e anexos continuam ausentes.
- **Objetivo:** evoluir chat direto para comunicação interna confiável.
- **Escopo:** `/chat`, módulos API `chat`, notificações.
- **Funcionalidades:** grupos/canais, anexos, busca, respostas, reações, fixação, leitura e presença.
- **Tarefas técnicas:**
  - [ ] Decidir e implementar transporte em tempo real com fallback/reconexão.
  - [ ] Criar modelo e permissões para canais e grupos; validar adesão e remoção de participantes.
  - [ ] Persistir anexos em storage autorizado, com limites e validação de tipo/tamanho.
  - [x] Implementar busca de mensagens respeitando participação e tenant (30 resultados máximos; cursor ainda pendente).
  - [ ] Completar recibos de leitura, notificações e estados de conexão.
  - [ ] Tratar envio duplicado, falha de rede e carregamento incremental na interface.
- **Dependências:** Sprint 02; Sprint 03 para diretório de colaboradores consolidado.
- **Critérios de conclusão:** [ ] mensagens sincronizam entre sessões; [ ] acesso indevido negado; [ ] anexos e busca persistem; [ ] falhas/reconexões comunicadas; [ ] UX responsiva revisada.
- **Prioridade:** Alta. **Status:** Parcial (conversa direta, histórico paginado e polling existentes).

## Sprint 05 — Voice e Meetings

- **Objetivo:** oferecer salas de voz e reuniões com estado de conexão confiável.
- **Escopo:** novas páginas `/voice` e `/meetings`, signaling e integração de mídia.
- **Funcionalidades:** salas, agenda, participantes, convites, áudio/vídeo, compartilhamento de tela, controles e histórico.
- **Tarefas técnicas:**
  - [ ] Escolher infraestrutura de mídia/signaling, requisitos de rede e limites de escala.
  - [ ] Implementar autorização de sala e convite, entrada/saída e reconexão.
  - [ ] Criar controles de microfone, câmera, saída e compartilhamento com estados acessíveis.
  - [ ] Adicionar agendamento, timezone, cancelamento e notificações de reunião.
  - [ ] Definir retenção e política de gravação; não gravar sem consentimento explícito.
- **Dependências:** Sprint 02 e Sprint 04 (presença/notificações); decisão de infraestrutura.
- **Critérios de conclusão:** [ ] chamadas testadas em navegadores/dispositivos suportados; [ ] permissões de mídia explicadas; [ ] estados de falha e reconexão; [ ] agendamento persistido; [ ] privacidade revisada.
- **Prioridade:** Média. **Status:** Não iniciado.

## Sprint 06 — Monitor e Produtividade

- **Objetivo:** entregar visibilidade operacional agregada, transparente e autorizada.
- **Escopo:** nova página `/monitor`, dashboards gerenciais e trilha de consulta.
- **Funcionalidades:** disponibilidade derivada de atividade explícita, indicadores, relatórios e histórico.
- **Tarefas técnicas:**
  - [ ] Definir política de privacidade, finalidade, consentimento/aviso e papéis autorizados.
  - [ ] Restringir métricas a dados de jornada/atividade que o sistema realmente coleta.
  - [ ] Implementar filtros por período, equipe e departamento com agregação no servidor.
  - [ ] Auditar consultas/exportações e aplicar retenção mínima necessária.
  - [ ] Apresentar definição e origem de cada métrica; evitar inferências de produtividade individual sem base.
- **Dependências:** Sprint 02 e Sprint 03; aprovação da política de privacidade.
- **Critérios de conclusão:** [ ] permissões testadas; [ ] métricas rastreáveis à fonte; [ ] consultas auditadas; [ ] política apresentada aos usuários; [ ] responsividade verificada.
- **Prioridade:** Alta para governança, condicionada à política. **Status:** Não iniciado.

## Sprint 07 — Projects

- **Objetivo:** criar gestão de projetos e tarefas colaborativa, persistida e multiempresa.
- **Escopo:** nova página `/projects`, módulos de projetos/tarefas, comentários e notificações.
- **Funcionalidades:** quadro Kanban, lista, calendário, subtarefas, responsáveis, prioridade, dependências, progresso e histórico.
- **Tarefas técnicas:**
  - [ ] Definir entidades, estados permitidos, regras de transição e permissões.
  - [ ] Implementar CRUD e filtros no servidor, mantendo tenant e auditoria.
  - [ ] Implementar Kanban acessível com atualização persistente e tratamento de concorrência.
  - [ ] Adicionar comentários, atividade, subtarefas e dependências com prevenção de ciclos.
  - [ ] Conectar dashboard somente a métricas derivadas de dados persistidos.
- **Dependências:** Sprint 02; Sprint 04 para notificações e colaboração.
- **Critérios de conclusão:** [ ] mudanças persistem; [ ] transições inválidas são recusadas; [ ] três visualizações coerentes; [ ] histórico auditável; [ ] estados vazios/erro/móvel tratados.
- **Prioridade:** Média-alta. **Status:** Não iniciado.

## Sprint 08 — Intelligence e IA

- **Objetivo:** responder perguntas e produzir insights fundamentados em dados empresariais permitidos.
- **Escopo:** nova página `/intelligence`, camada de recuperação/contexto e controles de acesso.
- **Funcionalidades:** histórico, resumos, análises, recomendações e referências às fontes internas.
- **Tarefas técnicas:**
  - [ ] Selecionar provedor/modelo e documentar retenção, custo, região e uso de dados.
  - [ ] Criar camada de consulta que aplique tenant e autorização antes da recuperação de contexto.
  - [ ] Exigir fontes/período para respostas numéricas; responder “dados insuficientes” sem evidência.
  - [ ] Tratar prompt injection, segredos, dados pessoais e logs de prompts/respostas.
  - [ ] Criar avaliação de qualidade e casos de recusa; permitir apagar histórico conforme política.
- **Dependências:** Sprint 02, Sprint 03 e módulos de dados que alimentarão os insights.
- **Critérios de conclusão:** [ ] respostas rastreáveis; [ ] sem acesso cross-tenant; [ ] comportamento de insuficiência validado; [ ] privacidade e custos documentados; [ ] controles e retenção implementados.
- **Prioridade:** Média. **Status:** Não iniciado.

## Sprint 09 — Dashboard e Analytics

- **Objetivo:** consolidar indicadores reais dos módulos entregues com definições consistentes.
- **Escopo:** `/dashboard`, serviços de agregação e relatórios.
- **Funcionalidades:** métricas, tendências, filtros, comparação entre períodos, exportação gerencial.
- **Tarefas técnicas:**
  - [ ] Definir catálogo de métricas com fórmula, fonte, fuso horário e papel permitido.
  - [ ] Integrar dados de projetos/reuniões somente após os módulos e dados estarem ativos.
  - [ ] Otimizar consultas e evitar polling desnecessário; medir comportamento sob carga.
  - [ ] Implementar filtros combinados e exportação com limites de acesso.
  - [ ] Explicitar dados defasados, vazios e indisponíveis sem estimativas fictícias.
- **Dependências:** Sprints 03, 05, 06, 07; Sprint 08 se houver insights.
- **Critérios de conclusão:** [ ] cálculos conciliados com fontes; [ ] filtros persistem na URL quando aplicável; [ ] exportações autorizadas; [ ] performance medida; [ ] acessibilidade/responsividade verificada.
- **Prioridade:** Média-alta. **Status:** Parcial (overview real de força de trabalho e jornada já existe).

## Sprint 10 — Segurança e Infraestrutura

- **Objetivo:** preparar operação segura, observável e escalável.
- **Escopo:** API, banco, frontend, deploy, segredos, logs e monitoramento técnico.
- **Funcionalidades:** auditoria, alertas operacionais, políticas de retenção, controles de acesso.
- **Tarefas técnicas:**
  - [ ] Fechar migração para sessão segura, proteção CSRF, expiração e revogação.
  - [ ] Rever rate limiting, CORS, headers, validação, uploads e gestão de segredos.
  - [ ] Executar auditoria independente de RBAC, tenant isolation e exposição de dados.
  - [ ] Definir backups, restauração, migrações reversíveis e plano de incidente.
  - [ ] Adicionar métricas técnicas, logs sem dados sensíveis e alertas de disponibilidade.
  - [ ] Medir consultas lentas, uso de recursos e estratégia de escalabilidade.
- **Dependências:** Sprint 02 e todos os módulos que serão lançados.
- **Critérios de conclusão:** [ ] revisão de ameaça registrada; [ ] recuperação de backup demonstrada; [ ] segredos protegidos; [ ] alertas testados; [ ] achados críticos resolvidos ou aceitos formalmente.
- **Prioridade:** Crítica antes da produção. **Status:** Pendente.

## Sprint 11 — QA e Lançamento

- **Objetivo:** validar fluxos ponta a ponta e preparar liberação controlada.
- **Escopo:** todas as rotas e módulos lançados, pipeline, documentação e suporte.
- **Funcionalidades:** suíte de regressão, acessibilidade básica, telemetria e rollback.
- **Tarefas técnicas:**
  - [ ] Criar matriz de fluxos críticos por papel e tenant.
  - [ ] Executar testes unitários, integração, ponta a ponta e responsivos em viewports acordados.
  - [ ] Verificar builds limpos, migrações, erros de console e estados de loading/erro/vazio.
  - [ ] Fazer revisão de acessibilidade e UX com teclado/leitor de tela nos fluxos críticos.
  - [ ] Preparar notas de versão, guia de operação, rollback e checklist de lançamento.
  - [ ] Confirmar pendências legais (incluindo REP-A, se aplicável) com responsáveis qualificados.
- **Dependências:** Sprints 02–10 conforme módulos incluídos no lançamento.
- **Critérios de conclusão:** [ ] fluxos críticos aprovados; [ ] nenhum defeito bloqueador aberto; [ ] regressão documentada; [ ] plano de rollback testado; [ ] documentação e suporte prontos.
- **Prioridade:** Crítica antes da produção. **Status:** Não iniciado.

## Sprint 12 — Workforce e Time: fluxos completos

- **Diagnóstico:** diretório agora permite cadastro, edição, arquivamento/reativação e filtros locais, com trilha de auditoria básica. Ainda não há paginação no servidor, histórico profissional consultável, hierarquia persistida, solicitações nem aprovações de jornada.
- **Objetivo e prioridade:** completar as operações prioritárias de pessoas e jornada com trilha de auditoria. **Prioridade:** Alta.
- **Escopo e dependências:** API, Prisma, páginas `/workforce` e `/time`; depende da conclusão das pendências críticas de segurança do Sprint 02.
- **Backend/banco:** migrar filtros para query paginada por empresa; API de histórico de alterações a partir da auditoria; modelo de solicitação de ajuste/aprovação sem editar registros de ponto existentes; validar índices e compatibilidade SQLite.
- **Frontend:** perfil lateral com atividade auditada, filtros server-side, paginação, estado de arquivado; página/painel de aprovações e histórico com origem, estado e autor da decisão.
- **Integrações:** Workforce com Time por usuário/departamento; resumo de jornada no perfil somente se permitido pelo papel.
- **Validação/risco:** testes de autorização por papel e tenant, transições de aprovação, filtros/paginação e concorrência; risco de regras trabalhistas/configuração por empresa requer decisão de produto e revisão apropriada.
- **Critérios:** [x] API não promove papel acima do permitido; [x] edição/arquivamento auditam mudanças; [ ] ponto original preservado no fluxo de ajustes; [ ] filtros server-side e aprovações persistem e refletem nos dados.
- **Status:** Planejado.

## Sprint 13 — Chat: canais e colaboração

- **Diagnóstico:** conversas diretas persistidas com polling e histórico paginado; inexistem canais, grupos, threads, busca e anexos.
- **Objetivo e prioridade:** habilitar colaboração em canais respeitando associação e escopo de empresa. **Prioridade:** Alta.
- **Escopo e dependências:** API/schema Chat, `/chat`, notificações; depende de infraestrutura de sessão/tenant (Sprint 02) e decisão de storage/tempo real.
- **Backend/banco:** modelo de canais e associação, regras de acesso, busca paginada e endpoint de criação de grupos; idempotência para mensagens; só implementar upload após escolher storage com controles de acesso.
- **Frontend:** navegação por conversas/canais, criação de canal, descrição e membros, busca, thread/resposta, feedback de envio/reconexão e layout mobile.
- **Integrações:** mensagens relacionadas a projetos somente após Sprint 14; notificação vinculada a canal será consolidada no Sprint 15.
- **Validação/risco:** teste de participante/não participante e tenant, mensagens duplicadas, cursor/paginação, falha de rede e acessibilidade por teclado.
- **Critérios:** [ ] canais persistem; [ ] permissões são validadas no servidor; [ ] polling/socket não duplica mensagens; [ ] estados mobile e vazio tratados.
- **Status:** Planejado.

## Sprint 14 — Projects: projetos e tarefas essenciais

- **Diagnóstico:** não há entidades, API ou interface funcional de projetos/tarefas; dashboard mostra indisponibilidade explicitamente.
- **Objetivo e prioridade:** entregar projetos, tarefas e quadro Kanban persistidos, formando a fonte confiável de progresso. **Prioridade:** Alta.
- **Escopo e dependências:** novo módulo NestJS/Prisma, página `/projects`, diretório de usuários; depende de contratos/isolamento do Sprint 02 e Workforce do Sprint 12.
- **Backend/banco:** modelos de projeto/tarefa, estados permitidos, responsável, prazo, prioridade, comentário e eventos de alteração; filtros por empresa e validação de transições.
- **Frontend:** lista e quadro Kanban acessível, criação/edição em painel, filtros, confirmação para ações destrutivas, estados vazios/carregando/erro e layout adaptável; arrastar e soltar só após garantir persistência e reversão em erro.
- **Integrações:** destinatários e notificações serão ligados no Sprint 15; métricas reais alimentam Dashboard/Reports depois do modelo estabilizado.
- **Validação/risco:** isolamento multi-tenant, permissões, transições, tarefas órfãs e concorrência; não inferir produtividade de pessoa a partir de contagem bruta.
- **Critérios:** [ ] CRUD autorizado; [ ] mudanças de status persistem; [ ] quadro e lista refletem mesma fonte; [ ] histórico básico registra alterações.
- **Status:** Planejado.

## Sprint 15 — Busca global e central de notificações

- **Diagnóstico:** não há endpoint de busca global nem modelo de notificação; a navegação não tem command center e os módulos ainda são limitados.
- **Objetivo e prioridade:** localizar rapidamente dados implementados e receber eventos relevantes sem duplicidade. **Prioridade:** Média-alta.
- **Escopo e dependências:** módulos Search/Notifications, header/sidebar, Chat e Projects; depende de entidades de canais e tarefas nos Sprints 13–14.
- **Backend/banco:** modelo de notificação com destinatário, tipo, referência, lida em, deduplicação; serviço de busca autorizada com limite, categorias e escopo por tenant; inicialmente polling, com contrato preparado para realtime.
- **Frontend:** command palette via Ctrl/Cmd+K com navegação por teclado, resultados categorizados só para entidades implementadas; botão/contador de notificações, lista, filtros, marcar lida/todas lidas e deep links válidos.
- **Integrações:** eventos de mensagem/canal e atribuição/prazo de tarefa; eventos falhos registram causa e podem ser reprocessados com idempotência.
- **Validação/risco:** busca sem vazamento cross-tenant, screen reader/teclado, deduplicação, preferências e links para entidades removidas.
- **Critérios:** [ ] resultados obedecem permissões; [ ] notificação não duplica sob retry; [ ] estados lidos persistem; [ ] command center funciona sem mouse.
- **Status:** Planejado.

## Sprint 16 — Documents e Knowledge Base

- **Diagnóstico:** não há armazenamento, metadados, upload ou modelo de documentos; Intelligence não pode consultar documentos ainda.
- **Objetivo e prioridade:** entregar biblioteca de documentos com permissões e pesquisa básica, sem expor arquivos empresariais. **Prioridade:** Média.
- **Escopo e dependências:** novo módulo, storage externo, página `/documents`; depende de decisão e credenciais de storage, segurança do Sprint 10 e entidades de projeto do Sprint 14.
- **Backend/banco:** escolher storage privado, metadados e vínculo de acesso; URLs assinadas de curta duração, limites e validação de tipo/tamanho; trilha de upload/download/exclusão; desenho de versão antes da migração.
- **Frontend:** biblioteca, pastas/categorias, busca, upload com progresso e erro, detalhe/preview apenas de tipos suportados, compartilhamento com permissões e associação a projeto.
- **Integrações:** anexar documento a projeto/tarefa; acesso por Intelligence não faz parte deste sprint e exige autorização por documento e avaliação própria.
- **Validação/risco:** credenciais externas, malware, MIME enganoso, links expirados, acesso cruzado e retenção; sem storage aprovado, manter feature indisponível e documentar dependência.
- **Critérios:** [ ] arquivos privados por padrão; [ ] upload/download autorizados; [ ] limites e erros claros; [ ] auditoria disponível; [ ] excluir/revogar invalida acesso.
- **Status:** Planejado, condicionado à escolha de storage.
