import Link from 'next/link';
import { notFound } from 'next/navigation';

const MODULES: Record<string, { title: string; sprint: string; description: string }> = {
  chat: { title: 'Vizion Chat', sprint: 'Sprint 03', description: 'Mensagens individuais, grupos, canais de projeto e arquivos.' },
  voice: { title: 'Vizion Voice', sprint: 'Sprint 04', description: 'Canais de voz permanentes, push-to-talk e salas privadas (LiveKit).' },
  meetings: { title: 'Vizion Meetings', sprint: 'Sprint 05', description: 'Videochamadas, compartilhamento de tela e agendamento.' },
  monitor: { title: 'Vizion Monitor', sprint: 'Sprint 06', description: 'Presença em tempo real e indicadores operacionais.' },
  projects: { title: 'Vizion Projects', sprint: 'Sprint 07', description: 'Projetos, tarefas e integração com GitHub/GitLab.' },
  intelligence: { title: 'Vizion Intelligence', sprint: 'Sprint 08', description: 'Relatórios inteligentes, resumos e análise de gargalos.' },
};

export default function ModulePage({ params }: { params: { module: string } }) {
  const mod = MODULES[params.module];
  if (!mod) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-3 pt-16 text-center">
      <h1 className="text-2xl font-semibold">{mod.title}</h1>
      <p className="text-muted">{mod.description}</p>
      <p className="text-sm text-muted">Planejado para o {mod.sprint}.</p>
      <Link href="/dashboard" className="btn-ghost mt-4">Voltar ao dashboard</Link>
    </div>
  );
}
