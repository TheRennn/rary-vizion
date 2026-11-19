'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { api } from '@/lib/api';
import { hasMinRole } from '@/lib/roles';
import type { AuthUser, DashboardOverview, DashboardPeriod } from '@/lib/types';

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
}: {
  href: string;
  label: string;
  value: string;
  detail: string;
  title: string;
}) {
  return (
    <a
      href={href}
      title={title}
      className="metric-card group block transition-colors hover:border-primary/50"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted">{label}</p>
        <span aria-hidden="true" className="text-sm text-muted transition-colors group-hover:text-primary">↗</span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-2 text-xs text-muted">{detail}</p>
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
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (background = false) => {
      if (background) setRefreshing(true);
      else setLoading(true);
      try {
        const data = await api<DashboardOverview>(`/dashboard/overview?period=${period}`);
        setOverview(data);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar o painel');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period],
  );

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(true), REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  const periodOptions: DashboardPeriod[] = ['7d', '30d', '90d'];
  const active = overview?.workforce;
  const attendance = overview?.attendance;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow mb-2">Vizion / Overview</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {greeting()}, {user.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {user.company.name} ·{' '}
            {new Intl.DateTimeFormat('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }).format(new Date())}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <span className="text-xs text-muted">
            {overview
              ? `Atualizado ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(overview.generatedAt))}`
              : 'Atualiza a cada 15s'}
          </span>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
          {error}
          {overview && <span className="ml-1 text-red-200/70">Exibindo os últimos dados carregados.</span>}
        </p>
      )}

      {loading && !overview ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Carregando indicadores">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="metric-card h-32 animate-pulse bg-surface2/50" />
          ))}
        </div>
      ) : overview ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores executivos">
            <MetricCard
              href="/workforce"
              label="Colaboradores ativos"
              value={String(active?.activeEmployees ?? 0)}
              detail={`${active?.newEmployees.current ?? 0} novos · ${formatChange(active?.newEmployees.changePercent ?? null)}`}
              title="Contagem de contas ativas da empresa; novos colaboradores comparados ao período anterior."
            />
            <MetricCard
              href="/workforce"
              label="Em jornada agora"
              value={String(active?.working ?? 0)}
              detail={`${active?.onBreak ?? 0} em intervalo · ${active?.offDuty ?? 0} fora da jornada`}
              title="Status calculado pelo último registro de ponto, não pela conexão à plataforma."
            />
            <MetricCard
              href="/time"
              label="Horas registradas"
              value={formatHours(attendance?.workedSeconds ?? 0)}
              detail={formatChange(attendance?.changePercent ?? null)}
              title={`Total de tempo trabalhado no período ${overview.period}. Intervalos não são contabilizados.`}
            />
            <MetricCard
              href="/time"
              label="Média por colaborador ativo"
              value={formatHours(attendance?.averagePerActiveEmployeeSeconds ?? 0)}
              detail={PERIOD_LABELS[overview.period]}
              title="Horas registradas no período divididas pelo total atual de colaboradores ativos."
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <article className="card p-5">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Workforce live overview</p>
                  <h2 className="mt-1 text-lg font-semibold">Distribuição da jornada</h2>
                </div>
                <span className="text-xs text-muted">Atualiza a cada 15s</span>
              </div>
              <WorkforceDonut overview={overview} />
            </article>

            <article className="card p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Attendance analytics</p>
                  <h2 className="mt-1 text-lg font-semibold">Horas ao longo do tempo</h2>
                </div>
                <p className="text-sm text-muted">
                  {formatHours(attendance?.workedSeconds ?? 0)} · {PERIOD_LABELS[overview.period]}
                </p>
              </div>
              <AttendanceChart overview={overview} />
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <article className="card p-5">
              <div className="mb-5 flex items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Department performance</p>
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
                  <p className="eyebrow">Recent activity</p>
                  <h2 className="mt-1 text-lg font-semibold">Atividade recente</h2>
                </div>
                <span className="text-xs text-muted">Eventos registrados</span>
              </div>
              {overview.activity.length === 0 ? (
                <p className="text-sm text-muted">Nenhuma atividade registrada até o momento.</p>
              ) : (
                <ol className="space-y-4">
                  {overview.activity.map((activity) => (
                    <li key={activity.id} className="flex gap-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{activity.description}</p>
                        <p className="mt-1 text-xs text-muted">
                          {activity.actorName ? `${activity.actorName} · ` : ''}
                          {new Intl.DateTimeFormat('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(new Date(activity.createdAt))}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </article>
          </section>

          <section>
            <div className="mb-3">
              <p className="eyebrow">Dependências de dados</p>
              <h2 className="mt-1 text-lg font-semibold">Outros módulos operacionais</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {!overview.availability.projects && (
                <FeatureUnavailable
                  title="Projetos"
                  description="O sistema ainda não possui módulo ou dados de projetos para apresentar."
                />
              )}
              {!overview.availability.tasks && (
                <FeatureUnavailable
                  title="Tarefas e produtividade"
                  description="Não há tarefas integradas; nenhuma taxa de conclusão ou produtividade foi estimada."
                />
              )}
              {!overview.availability.meetings && (
                <FeatureUnavailable
                  title="Reuniões"
                  description="O sistema ainda não possui agenda ou dados de reuniões."
                />
              )}
              {!overview.availability.intelligence && (
                <FeatureUnavailable
                  title="Vizion Intelligence"
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
    <div className="space-y-6">
      <header>
        <p className="eyebrow mb-2">Visão geral</p>
        <h1 className="text-3xl font-semibold tracking-tight">Olá, {user.name.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-muted">{user.company.name}</p>
      </header>
      <section className="card overflow-hidden">
        <div className="relative p-7">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <p className="eyebrow">Sua jornada</p>
          <h2 className="mt-3 text-xl font-semibold">Comece o dia no Vizion Time</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Registre entrada, intervalos e saída em uma experiência simples e segura. O painel operacional é habilitado para gestores.
          </p>
          <a href="/time" className="btn mt-5 inline-flex">Abrir ponto</a>
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
