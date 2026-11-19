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
    <div className="mx-auto max-w-2xl">
      <section className="card relative overflow-hidden p-8 text-center sm:p-12">
        <div className="absolute left-1/2 top-0 h-48 w-48 -translate-x-1/2 rounded-full bg-primary/10 blur-[80px]" />
        <div className="relative">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-xl font-semibold text-primary">R</span>
          <p className="eyebrow mt-6">{mod.sprint}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{mod.title}</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted">{mod.description}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/dashboard" className="btn">Ir ao dashboard</Link>
            <Link href="/time" className="btn-ghost">Abrir Vizion Time</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
