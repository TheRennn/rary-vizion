import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState, PageHeading, StatusIndicator } from '@/components/design-system';

const MODULES: Record<string, { title: string; category: string; description: string; available: boolean; dependencies: string[] }> = {
  inbox: { title: 'Caixa de entrada', category: 'Espaço de trabalho', description: 'Central de notificações e itens que precisam da sua atenção.', available: false, dependencies: ['Notificações persistentes', 'Preferências de alerta'] },
  projects: { title: 'Projetos', category: 'Organização', description: 'Projetos e tarefas com status, responsáveis e histórico.', available: false, dependencies: ['Modelo persistente de projetos e tarefas', 'Permissões e atividade'] },
  voice: { title: 'Voz', category: 'Comunicação', description: 'Salas de voz organizadas por equipe e departamento.', available: false, dependencies: ['Infraestrutura de mídia', 'Presença e autorização de sala'] },
  meetings: { title: 'Reuniões', category: 'Comunicação', description: 'Agenda de reuniões, participantes e sessões.', available: false, dependencies: ['Calendário e fuso horário', 'Integração de áudio e vídeo'] },
  monitor: { title: 'Monitoramento', category: 'Operações', description: 'Indicadores operacionais com origem e contexto explícitos.', available: false, dependencies: ['Política de privacidade', 'Eventos operacionais autorizados'] },
  intelligence: { title: 'Inteligência', category: 'Operações', description: 'Análises baseadas em dados autorizados do espaço de trabalho.', available: false, dependencies: ['Integração de IA', 'Fontes e retenção auditáveis'] },
  documents: { title: 'Documentos', category: 'Espaço de trabalho', description: 'Documentos e arquivos compartilhados da organização.', available: false, dependencies: ['Armazenamento de arquivos', 'Permissões e metadados'] },
  reports: { title: 'Relatórios', category: 'Operações', description: 'Relatórios operacionais com filtros e exportação.', available: false, dependencies: ['Catálogo de relatórios', 'Exportação e filtros'] },
  automations: { title: 'Automações', category: 'Operações', description: 'Automações e histórico de execução do espaço de trabalho.', available: false, dependencies: ['Motor de execução', 'Registros e gestão de permissões'] },
  settings: { title: 'Configurações', category: 'Espaço de trabalho', description: 'Preferências pessoais, integrações e configurações da organização.', available: false, dependencies: ['Preferências de usuário', 'Administração de integrações'] },
};

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const details = MODULES[module];
  if (!details) notFound();

  return <div className="space-y-4">
    <PageHeading eyebrow={details.category} title={details.title} description={details.description} actions={<StatusIndicator label="Planejado" tone="info" />} />
    <section className="overflow-hidden rounded-lg border border-line/70 bg-surface">
      <div className="flex items-center justify-between gap-4 border-b border-line/60 px-3 py-2.5"><div><p className="text-xs font-medium">Estado do módulo</p><p className="mt-1 text-[10px] text-muted">Esta rota explica o escopo sem simular recursos ou dados inexistentes.</p></div><StatusIndicator label="Ainda não implementado" /></div>
      <EmptyState title={`${details.title} ainda não está disponível`} description="A experiência e os dados deste módulo serão habilitados após sua implementação funcional. As operações disponíveis no produto continuam acessíveis na navegação." />
      <div className="border-t border-line/60 px-3 py-3"><p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted">Dependências identificadas</p><ul className="divide-y divide-line/50">{details.dependencies.map((dependency) => <li key={dependency} className="flex items-center gap-2 py-2 text-[11px] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-muted/60" />{dependency}</li>)}</ul></div>
    </section>
    <section className="rounded-lg border border-line/70 bg-surface px-3 py-3"><p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted">Módulos disponíveis</p><div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px]"><Link className="text-fg hover:text-primary" href="/dashboard">Painel</Link><Link className="text-fg hover:text-primary" href="/workforce">Equipe</Link><Link className="text-fg hover:text-primary" href="/time">Jornada</Link><Link className="text-fg hover:text-primary" href="/chat">Chat</Link><Link className="text-fg hover:text-primary" href="/audit">Auditoria</Link></div></section>
  </div>;
}
