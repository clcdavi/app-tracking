'use client';

import { useMemo } from 'react';
import { Task, areas, addDays, taskKey } from '@/lib/planner';
import {
  CheckCircle2,
  Clock,
  Flame,
  PieChart,
  Layers,
  TrendingUp,
} from 'lucide-react';

interface MetricsViewProps {
  tasks: Task[];
  date: string;
  onSelectTask: (task: Task) => void;
}

const areaColors: Record<string, { bar: string; text: string; bg: string }> = {
  Personal: { bar: 'bg-[#579dff]', text: 'text-[#579dff]', bg: 'bg-[#579dff]/15' },
  Trabajo: { bar: 'bg-[#9f8fef]', text: 'text-[#9f8fef]', bg: 'bg-[#9f8fef]/15' },
  Estudio: { bar: 'bg-[#f5cd47]', text: 'text-[#f5cd47]', bg: 'bg-[#f5cd47]/15' },
  Iglesia: { bar: 'bg-[#4bce97]', text: 'text-[#4bce97]', bg: 'bg-[#4bce97]/15' },
  Proyectos: { bar: 'bg-[#fea362]', text: 'text-[#fea362]', bg: 'bg-[#fea362]/15' },
};

export function MetricsView({ tasks, date, onSelectTask }: MetricsViewProps) {
  const stats = useMemo(() => {
    const total = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'done');
    const pendingTasks = tasks.filter((t) => t.status !== 'done');

    const totalMinutesCompleted = completedTasks.reduce((acc, t) => acc + (t.minutes || 30), 0);
    const totalMinutesPlanned = tasks.reduce((acc, t) => acc + (t.minutes || 30), 0);

    const completionRate = total > 0 ? Math.round((completedTasks.length / total) * 100) : 0;

    // Time by area
    const areaBreakdown = areas.map((area) => {
      const areaTasks = completedTasks.filter((t) => t.area === area);
      const minutes = areaTasks.reduce((acc, t) => acc + (t.minutes || 30), 0);
      const count = areaTasks.length;
      return {
        area,
        minutes,
        count,
        percent: totalMinutesCompleted > 0 ? Math.round((minutes / totalMinutesCompleted) * 100) : 0,
      };
    });

    // Calculate streak (consecutive days with completed tasks) using Buenos Aires date prop
    const completionDates = new Set(
      completedTasks
        .filter((t) => Boolean(t.completed))
        .map((t) => t.completed.slice(0, 10))
    );

    let streak = 0;
    let cursorDate = date;

    if (!completionDates.has(cursorDate)) {
      cursorDate = addDays(date, -1);
    }

    while (completionDates.has(cursorDate)) {
      streak++;
      cursorDate = addDays(cursorDate, -1);
    }

    // Recent completed tasks (last 8)
    const recentCompleted = [...completedTasks]
      .sort((a, b) => (b.completed || '').localeCompare(a.completed || ''))
      .slice(0, 8);

    return {
      total,
      completedCount: completedTasks.length,
      pendingCount: pendingTasks.length,
      completionRate,
      totalMinutesCompleted,
      totalMinutesPlanned,
      areaBreakdown,
      streak,
      recentCompleted,
    };
  }, [tasks, date]);

  const hours = Math.floor(stats.totalMinutesCompleted / 60);
  const remainingMins = stats.totalMinutesCompleted % 60;
  const timeFormatted = `${hours > 0 ? `${hours}h ` : ''}${remainingMins}m`;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="jira-panel-card p-5">
          <div className="flex items-center justify-between jira-text-subtle mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Cumplimiento</span>
            <CheckCircle2 size={18} className="text-[#579dff]" />
          </div>
          <div className="text-3xl font-bold tracking-tight">
            {stats.completionRate}%
          </div>
          <p className="text-xs jira-text-subtle mt-1">
            {stats.completedCount} de {stats.total} tareas logradas
          </p>
        </div>

        <div className="jira-panel-card p-5">
          <div className="flex items-center justify-between jira-text-subtle mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tiempo Invertido</span>
            <Clock size={18} className="text-[#9f8fef]" />
          </div>
          <div className="text-3xl font-bold tracking-tight">
            {timeFormatted || '0m'}
          </div>
          <p className="text-xs jira-text-subtle mt-1">
            En tareas finalizadas
          </p>
        </div>

        <div className="jira-panel-card p-5">
          <div className="flex items-center justify-between jira-text-subtle mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Racha Activa</span>
            <Flame size={18} className="text-amber-500 fill-amber-500" />
          </div>
          <div className="text-3xl font-bold tracking-tight">
            {stats.streak} {stats.streak === 1 ? 'día' : 'días'}
          </div>
          <p className="text-xs jira-text-subtle mt-1">
            Constancia diaria completando foco
          </p>
        </div>

        <div className="jira-panel-card p-5">
          <div className="flex items-center justify-between jira-text-subtle mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pendientes</span>
            <Layers size={18} className="text-[#4bce97]" />
          </div>
          <div className="text-3xl font-bold tracking-tight">
            {stats.pendingCount}
          </div>
          <p className="text-xs jira-text-subtle mt-1">
            Por resolver a tu ritmo
          </p>
        </div>
      </div>

      {/* Distribución por Áreas de Vida */}
      <div className="jira-panel-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <PieChart size={18} className="text-[#579dff]" />
              Tiempo por Espacio / Área
            </h3>
            <p className="text-xs jira-text-subtle mt-0.5">
              Equilibrio entre los diferentes espacios de trabajo.
            </p>
          </div>
          <span className="text-xs font-medium jira-text-subtle">
            {stats.totalMinutesCompleted} min totales
          </span>
        </div>

        <div className="space-y-4 pt-2">
          {stats.areaBreakdown.map((item) => {
            const style = areaColors[item.area] || {
              bar: 'bg-slate-400',
              text: 'text-slate-400',
              bg: 'bg-slate-500/10',
            };
            const itemHours = Math.floor(item.minutes / 60);
            const itemMins = item.minutes % 60;
            const itemTimeFormatted = `${itemHours > 0 ? `${itemHours}h ` : ''}${itemMins}m`;

            return (
              <div key={item.area} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-semibold text-[11px] ${style.bg} ${style.text}`}>
                      {item.area}
                    </span>
                    <span className="jira-text-subtle">
                      {item.count} {item.count === 1 ? 'tarea' : 'tareas'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{itemTimeFormatted}</span>
                    <span className="jira-text-subtle w-8 text-right">{item.percent}%</span>
                  </div>
                </div>

                <div className="h-2 w-full jira-track-bar rounded-full overflow-hidden">
                  <div
                    className={`h-full ${style.bar} transition-all duration-500 rounded-full`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Últimas Tareas Completadas */}
      <div className="jira-panel-card p-6">
        <h3 className="text-base font-bold flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-[#4bce97]" />
          Historial de Elementos Completados
        </h3>

        {stats.recentCompleted.length === 0 ? (
          <p className="text-xs jira-text-subtle italic py-4 text-center">
            Aún no hay elementos completados en este espacio.
          </p>
        ) : (
          <div className="divide-y divide-[var(--j-border)]">
            {stats.recentCompleted.map((task) => (
              <div
                key={task.id}
                className="py-3 flex items-center justify-between gap-3 hover:bg-[var(--j-bg-surface-hover)] px-2 rounded-lg transition-colors cursor-pointer"
                onClick={() => onSelectTask(task)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle2 size={16} className="text-[#4bce97] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate line-through opacity-80">
                      <span className="font-mono text-xs jira-text-subtle mr-2">
                        {taskKey(task, tasks)}
                      </span>
                      {task.title}
                    </div>
                    <div className="text-[11px] jira-text-subtle flex items-center gap-2 mt-0.5">
                      <span>{task.area}</span>
                      <span>•</span>
                      <span>{task.minutes} min</span>
                      {task.project && (
                        <>
                          <span>•</span>
                          <span>{task.project}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {task.completed && (
                  <span className="text-xs jira-text-subtle shrink-0 font-mono">
                    {new Intl.DateTimeFormat('es-AR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(task.completed))}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
