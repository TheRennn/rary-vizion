'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { api } from '@/lib/api';
import { hasMinRole } from '@/lib/roles';
import type { AuthUser, DashboardOverview, DashboardPeriod, Department } from '@/lib/types';
import { ActivityFeed, ActivityItem, EmptyState } from '@/components/design-system';

const REFRESH_MS = 15_000;
const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
};

function formatHours(seconds: number) {
  const hours = seconds / 3600;
  return `${hours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
}

function formatChange(value: number | null) {
  if (value === null) return 'Sem período anterior para comparar';
  const formatted = `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR')}%`;
  return `${formatted} vs. período anterior`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function MetricCard({
  href,
  label,
  value,
  detail,
  title,
  icon,
}: {
  href: string;
  label: string;
  value: string;
  detail: string;
  title: string;
  icon: string;
}) {
  return (
    <a
      href={href}
      title={title}
      className="metric-card group block"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-[10px] border border-white/[0.06] bg-white/[0.035] text-base text-primary transition-all group-hover:border-primary/20 group-hover:bg-primary/10">{icon}</span>
      </div>
      <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="text-xs text-muted">{detail}</p>
    </a>
  );
}

function WorkforceDonut({ overview }: { overview: DashboardOverview }) {
  const { activeEmployees, working, onBreak, offDuty } = overview.workforce;
  const segments = [
    { label: 'Em jornada', value: working, color: '#8b5cf6' },
    { label: 'Em intervalo', value: onBreak, color: '#f9b338' },
    { label: 'Fora da jornada', value: offDuty, color: '#3b82f6' },
  ];
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative h-36 w-36 shrink-0" role="img" aria-label="Distribuição atual da jornada">
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
          <circle cx="21" cy="21" r="15.9" fill="none" stroke="#292929" strokeWidth="5" />
          {segments.map((segment) => {
            const length = activeEmployees > 0 ? (segment.value / activeEmployees) * 100 : 0;
            const currentOffset = offset;
            offset += length;
            return (
              <circle
                key={segment.label}
                cx="21"
                cy="21"
                r="15.9"
                fill="none"
                stroke={segment.color}
                strokeWidth="5"
                strokeDasharray={`${length} ${100 - length}`}
                strokeDashoffset={-currentOffset}
                pathLength="100"
              >
                <title>{`${segment.label}: ${segment.value}`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{activeEmployees}</span>
          <span className="eyebrow !text-[9px]">ativos</span>
        </div>
      </div>
      <ul className="w-full space-y-3">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-muted">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: segment.color }} />
              {segment.label}
            </span>
            <span className="font-medium tabular-nums">{segment.value}</span>
          </li>
        ))}
        <li className="border-t border-line pt-3 text-xs text-muted">
          Presença reflete registros de jornada, não conexão à plataforma.
        </li>
      </ul>
    </div>
  );
}

function AttendanceChart({ overview }: { overview: DashboardOverview }) {
  const points = overview.attendance.trend;
  const maxSeconds = Math.max(...points.map((point) => point.workedSeconds), 1);
  const coordinates = points.map((point, index) => {
    const x = points.length < 2 ? 400 : 24 + (index / (points.length - 1)) * 752;
    const y = 172 - (point.workedSeconds / maxSeconds) * 132;
    return { x, y, point };
  });
  const line = coordinates.map(({ x, y }) => `${x},${y}`).join(' ');
  const area = coordinates.length
    ? `M ${coordinates[0].x},172 L ${coordinates.map(({ x, y }) => `${x},${y}`).join(' L ')} L ${coordinates[coordinates.length - 1].x},172 Z`
    : '';
  const labelStep = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div>
      <div className="overflow-hidden">
        <svg
          viewBox="0 0 800 200"
          preserveAspectRatio="none"
          role="img"
          aria-label="Horas trabalhadas ao longo do período"
          className="h-48 w-full"
        >
          <defs>
            <linearGradient id="attendance-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity=".28" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[40, 84, 128, 172].map((y) => (
            <line key={y} x1="24" x2="776" y1={y} y2={y} stroke="#292929" strokeDasharray="3 5" />
          ))}
          {area && <path d={area} fill="url(#attendance-area)" />}
          <polyline
            points={line}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {coordinates.map(({ x, y, point }) => (
            <circle key={point.from} cx={x} cy={y} r="3.5" fill="#c4b5fd">
              <title>
                {`${new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short' }).format(new Date(point.from))}: ${formatHours(point.workedSeconds)} · ${point.starts} entradas · ${point.ends} saídas`}
              </title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        {points.map((point, index) =>
          index % labelStep === 0 || index === points.length - 1 ? (
            <span key={point.from}>
              {new Intl.DateTimeFormat('pt-BR', {
                timeZone: 'UTC',
                day: '2-digit',
                month: 'short',
              }).format(new Date(point.from))}
            </span>
          ) : null,
        )}
      </div>
      <p className="mt-3 text-xs text-muted">
        Cada ponto inclui registros fechados e jornadas abertas até a última atualização.
      </p>
    </div>
  );
}

function DepartmentOverview({ overview }: { overview: DashboardOverview }) {
  const departments = overview.workforce.departments;
  const maximum = Math.max(...departments.map((department) => department.employees), 1);

  if (departments.length === 0) {
    return <p className="text-sm text-muted">Ainda não há departamentos cadastrados.</p>;
  }

  return (
    <div className="space-y-4">
      {departments.map((department) => (
        <a
          key={department.id}
          href="/workforce"
          className="group block rounded-xl p-2 transition-colors hover:bg-white/[0.03]"
          title={`Ver equipe do departamento ${department.name}`}
        >
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium">{department.name}</span>
            <span className="shrink-0 text-muted tabular-nums">
              {department.employees} pessoas · {department.working} em jornada
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(department.employees / maximum) * 100}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {formatHours(department.workedSeconds)} registrados no período
          </p>
        </a>
      ))}
    </div>
  );
}

const PROJECT_STATUS_LABEL: Record<string, string> = { PLANNING: 'Planejamento', ACTIVE: 'Em andamento', ON_HOLD: 'Pausado', COMPLETED: 'Concluído', ARCHIVED: 'Arquivado' };
const TASK_STATUS_LABEL: Record<string, string> = { TODO: 'A fazer', IN_PROGRESS: 'Em andamento', REVIEW: 'Em revisão', DONE: 'Concluída' };
const PRIORITY_LABEL: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', URGENT: 'Urgente' };

function OperationsBreakdown({ overview }: { overview: DashboardOverview }) {
  const projectStatuses = Object.entries(overview.projects.byStatus);
  const taskStatuses = Object.entries(overview.projects.tasksByStatus);
  const maxProjects = Math.max(overview.projects.total, 1);
  const maxTasks = Math.max(...Object.values(overview.projects.tasksByStatus), 1);
  const priorities = Object.entries(overview.projects.tasksByPriority).sort((a, b) => (b[1] - a[1]));
  const maxPriority = Math.max(...priorities.map(([, count]) => count), 1);
  return <div className="grid gap-6 lg:grid-cols-2">
    <div>
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-medium">Projetos por status</h3><a href="/projects" className="text-xs text-primary">Abrir projetos</a></div>
      {projectStatuses.length ? <ul className="space-y-3">{projectStatuses.map(([status, value]) => <li key={status}><div className="mb-1 flex justify-between text-xs"><span className="text-muted">{PROJECT_STATUS_LABEL[status] ?? status}</span><span className="tabular-nums">{value}</span></div><div className="h-1.5 rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-primary" style={{ width: `${(value / maxProjects) * 100}%` }} /></div></li>)}</ul> : <p className="text-xs text-muted">Nenhum projeto cadastrado.</p>}
    </div>
    <div>
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-medium">Tarefas por andamento</h3><span className="text-xs text-muted">{overview.projects.overdueTasks} atrasadas</span></div>
      {taskStatuses.length ? <ul className="space-y-3">{taskStatuses.map(([status, value]) => <li key={status}><div className="mb-1 flex justify-between text-xs"><span className="text-muted">{TASK_STATUS_LABEL[status] ?? status}</span><span className="tabular-nums">{value}</span></div><div className="h-1.5 rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-secondary" style={{ width: `${(value / maxTasks) * 100}%` }} /></div></li>)}</ul> : <p className="text-xs text-muted">Nenhuma tarefa cadastrada.</p>}
      {priorities.length > 0 && <div className="mt-4 border-t border-line/60 pt-3"><p className="mb-2 text-[10px] text-muted">Pendências por prioridade</p><ul className="space-y-2">{priorities.map(([priority, count]) => <li key={priority}><div className="mb-1 flex justify-between text-[10px]"><span className="text-muted">{PRIORITY_LABEL[priority] ?? priority}</span><span>{count}</span></div><div className="h-1 rounded-full bg-white/[.06]"><div className={`h-full rounded-full ${priority === 'URGENT' || priority === 'HIGH' ? 'bg-rose-400' : priority === 'MEDIUM' ? 'bg-amber-300' : 'bg-slate-400'}`} style={{ width: `${(count / maxPriority) * 100}%` }} /></div></li>)}</ul></div>}
    </div>
  </div>;
}

function FeatureUnavailable({ title, description }: { title: string; description: string }) {
  return (
    <section className="card p-5">
      <p className="eyebrow">Módulo indisponível</p>
      <h3 className="mt-2 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
    </section>
  );
}

function ExecutiveDashboard({ user }: { user: AuthUser }) {
  const [period, setPeriod] = useState<DashboardPeriod>('30d');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (background = false) => {
      if (background) setRefreshing(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams({ period });
        if (departmentId) params.set('departmentId', departmentId);
        const data = await api<DashboardOverview>(`/dashboard/overview?${params.toString()}`);
        setOverview(data);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar o painel');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period, departmentId],
  );

  useEffect(() => {
    let cancelled = false;
    api<Department[]>('/departments')
      .then((result) => { if (!cancelled) setDepartments(result); })
      .catch(() => { if (!cancelled) setDepartments([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(true), REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  const periodOptions: DashboardPeriod[] = ['7d', '30d', '90d'];
  const active = overview?.workforce;
  const attendance = overview?.attendance;

  return (
    <div className="space-y-5">
      <header className="dashboard-heading flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow dashboard-kicker mb-3">Visão geral</p>
          <h1 className="font-semibold tracking-tight">
            {greeting()}, {user.name.split(' ')[0]}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {user.company.name} ·{' '}
            {new Intl.DateTimeFormat('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }).format(new Date())}
          </p>
        </div>
        <div className="dashboard-controls flex flex-wrap items-center gap-1">
          <label className="sr-only" htmlFor="dashboard-department">Departamento do painel</label>
          <select id="dashboard-department" value={departmentId} onChange={(event) => { setOverview(null); setDepartmentId(event.target.value); }} className="input w-auto min-w-40">
            <option value="">Toda a empresa</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
          <label className="sr-only" htmlFor="dashboard-period">Período do painel</label>
          <select
            id="dashboard-period"
            value={period}
            onChange={(event) => {
              setOverview(null);
              setPeriod(event.target.value as DashboardPeriod);
            }}
            className="input w-auto min-w-36"
          >
            {periodOptions.map((option) => (
              <option key={option} value={option}>
                {PERIOD_LABELS[option]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void load(true)}
            disabled={refreshing}
          >
            {refreshing ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
          {error}
          {overview && <span className="ml-1 text-red-200/70">Exibindo os últimos dados carregados.</span>}
        </p>
      )}

      {loading && !overview ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5" aria-label="Carregando indicadores">
          {Array.from({ length: 10 }, (_, index) => (
            <div key={index} className="metric-card h-32 animate-pulse bg-surface2/50" />
          ))}
        </div>
      ) : overview ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5" aria-label="Indicadores executivos">
            <MetricCard
              href="/workforce"
              label="Colaboradores ativos"
              value={String(active?.activeEmployees ?? 0)}
              detail={`${active?.newEmployees.current ?? 0} novos · ${formatChange(active?.newEmployees.changePercent ?? null)}`}
              title="Contagem de contas ativas da empresa; novos colaboradores comparados ao período anterior."
              icon="◎"
            />
            <MetricCard
              href="/workforce"
              label="Em jornada agora"
              value={String(active?.working ?? 0)}
              detail={`${active?.onBreak ?? 0} em intervalo · ${active?.offDuty ?? 0} fora da jornada`}
              title="Status calculado pelo último registro de ponto, não pela conexão à plataforma."
              icon="◷"
            />
            <MetricCard href="/time" label="Em intervalo" value={String(active?.onBreak ?? 0)} detail="Status pelo último registro do dia" title="Colaboradores cujo último registro de jornada é início de intervalo." icon="Ⅱ" />
            <MetricCard
              href="/time"
              label="Horas registradas"
              value={formatHours(attendance?.workedSeconds ?? 0)}
              detail={formatChange(attendance?.changePercent ?? null)}
              title={`Total de tempo trabalhado no período ${overview.period}. Intervalos não são contabilizados.`}
              icon="◫"
            />
            <MetricCard
              href="/time"
              label="Média por colaborador ativo"
              value={formatHours(attendance?.averagePerActiveEmployeeSeconds ?? 0)}
              detail={PERIOD_LABELS[overview.period]}
              title="Horas registradas no período divididas pelo total atual de colaboradores ativos."
              icon="⌁"
            />
            <MetricCard href="/projects" label="Projetos ativos" value={String(overview.projects.active)} detail={`${overview.projects.total} projetos no total`} title="Projetos com status ativo na empresa." icon="▦" />
            <MetricCard href="/projects" label="Tarefas pendentes" value={String(overview.projects.pendingTasks)} detail="A fazer, em andamento ou revisão" title="Tarefas que ainda não foram concluídas." icon="≡" />
            <MetricCard href="/projects" label="Tarefas atrasadas" value={String(overview.projects.overdueTasks)} detail="Prazo anterior a hoje e não concluídas" title="Tarefas vencidas segundo o prazo salvo." icon="!" />
            <MetricCard href="/inbox" label="Notificações não lidas" value={String(overview.unreadNotifications)} detail="Somente notificações da sua conta" title="Notificações não lidas destinadas a você." icon="◉" />
            <MetricCard href="/meetings" label="Reuniões agendadas" value={String(overview.upcomingMeetingsCount)} detail="Próximas, com acesso permitido a você" title="Total de reuniões futuras que você pode ver." icon="◷" />
          </section>

          <section className="card p-5">
            <div className="mb-5 flex items-center justify-between gap-3"><div><p className="eyebrow">Projetos e entregas</p><h2 className="mt-1 text-lg font-semibold">Andamento operacional</h2></div><span className="text-xs text-muted">Dados persistidos</span></div>
            <OperationsBreakdown overview={overview} />
          </section>

          <section className="dashboard-primary-grid grid gap-4 xl:grid-cols-2">
            <article className="card p-5">
              <div className="dashboard-section-title">
                <div>
                  <p className="eyebrow">Visão da equipe</p>
                  <h2 className="mt-1 text-lg font-semibold">Distribuição da jornada</h2>
                </div>
                <span className="dashboard-live">Ao vivo</span>
              </div>
              <WorkforceDonut overview={overview} />
            </article>

            <article className="card p-5">
              <div className="dashboard-section-title">
                <div>
                  <p className="eyebrow">Análise de presença</p>
                  <h2 className="mt-1 text-lg font-semibold">Horas ao longo do tempo</h2>
                </div>
                <p className="text-sm text-muted">
                  {formatHours(attendance?.workedSeconds ?? 0)} · {PERIOD_LABELS[overview.period]}
                </p>
              </div>
              <AttendanceChart overview={overview} />
            </article>
          </section>

          <section className="dashboard-secondary-grid grid gap-4 xl:grid-cols-2">
            <article className="card p-5">
              <div className="mb-5 flex items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Desempenho por departamento</p>
                  <h2 className="mt-1 text-lg font-semibold">Equipe por departamento</h2>
                </div>
                <a href="/workforce" className="text-xs font-medium text-primary hover:text-fg">
                  Ver equipe
                </a>
              </div>
              <DepartmentOverview overview={overview} />
            </article>

            <article className="card p-5">
              <div className="mb-5 flex items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Atividade recente</p>
                  <h2 className="mt-1 text-lg font-semibold">Atividade recente</h2>
                </div>
                <span className="text-xs text-muted">{departmentId ? 'Atividade da empresa' : 'Eventos registrados'}</span>
              </div>
              {overview.activity.length === 0 ? (
                <EmptyState title="Sem atividade recente" description="As ações do espaço de trabalho aparecerão aqui conforme forem registradas." />
              ) : (
                <ActivityFeed>
                  {overview.activity.map((activity) => (
                    <ActivityItem key={activity.id}>
                      <p className="text-xs text-fg">{activity.description}</p>
                      <p className="mt-1 text-[10px] text-muted">
                        {activity.actorName ? `${activity.actorName} · ` : ''}
                        {new Intl.DateTimeFormat('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(activity.createdAt))}
                      </p>
                    </ActivityItem>
                  ))}
                </ActivityFeed>
              )}
            </article>
            <article className="card p-5">
              <div className="mb-4 flex items-end justify-between gap-3"><div><p className="eyebrow">Agenda</p><h2 className="mt-1 text-lg font-semibold">Próximas reuniões</h2></div><a href="/meetings" className="text-xs font-medium text-primary">Ver agenda</a></div>
              {overview.upcomingMeetings.length ? <ul className="divide-y divide-line/60">{overview.upcomingMeetings.map((meeting) => <li key={meeting.id} className="flex items-center gap-3 py-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">◷</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{meeting.name}</p><p className="mt-1 text-xs text-muted">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(meeting.startsAt))} · {meeting.durationMinutes} min</p></div></li>)}</ul> : <EmptyState title="Agenda livre" description="Nenhuma reunião futura visível para você." action={<a className="text-xs text-primary" href="/meetings">Abrir reuniões</a>} />}
            </article>
          </section>

          <section>
            <div className="mb-3">
              <p className="eyebrow">Dependências de dados</p>
              <h2 className="mt-1 text-lg font-semibold">Outros módulos operacionais</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {!overview.availability.intelligence && (
                <FeatureUnavailable
                  title="Inteligência Vizion"
                  description="Insights ficam indisponíveis até existir uma integração e dados operacionais que os fundamentem."
                />
              )}
            </div>
          </section>
        </>
      ) : !loading ? (
        <section className="card p-6 text-center">
          <p className="font-medium">Não foi possível carregar o painel.</p>
          <button type="button" className="btn mt-4" onClick={() => void load()}>
            Tentar novamente
          </button>
        </section>
      ) : null}
    </div>
  );
}

function PersonalDashboard({ user }: { user: AuthUser }) {
  return (
    <div className="space-y-5">
      <header className="dashboard-heading">
        <p className="eyebrow dashboard-kicker mb-3">Visão geral</p>
        <h1 className="font-semibold tracking-tight">Olá, {user.name.split(' ')[0]}</h1>
        <p className="mt-2 text-sm text-muted">{user.company.name}</p>
      </header>
      <section className="card overflow-hidden">
        <div className="relative min-h-[280px] p-8 sm:p-10">
          <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <p className="eyebrow">Sua jornada</p>
          <h2 className="mt-4 text-xl font-semibold">Comece o dia no Vizion Jornada</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
            Registre entrada, intervalos e saída em uma experiência simples e segura. O painel operacional é habilitado para gestores.
          </p>
          <a href="/time" className="btn mt-6 inline-flex items-center">Abrir ponto</a>
        </div>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  return hasMinRole(user.role, 'MANAGER')
    ? <ExecutiveDashboard user={user} />
    : <PersonalDashboard user={user} />;
}
