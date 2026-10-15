'use client';

import { useMemo } from 'react';
import { Task, areas } from '@/lib/planner';
import {
  CheckCircle2,
  Clock,
  Flame,
  PieChart,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface MetricsViewProps {
  tasks: Task[];
  date: string;
  onSelectTask: (task: Task) => void;
}

const areaColors: Record<string, { bar: string; text: string; bg: string }> = {
  Personal: { bar: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50' },
  Trabajo: { bar: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-50' },
  Estudio: { bar: 'bg-amber-500', text: 'text-amber-800', bg: 'bg-amber-50' },
  Iglesia: { bar: 'bg-teal-500', text: 'text-teal-700', bg: 'bg-teal-50' },
  Proyectos: { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
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

    // Calculate streak (consecutive days with completed tasks)
    const completionDates = new Set(
      completedTasks
        .filter((t) => Boolean(t.completed))
        .map((t) => t.completed.slice(0, 10))
    );

    let streak = 0;
    const cur = new Date();
    // Check if completed something today or yesterday
    const todayStr = cur.toISOString().slice(0, 10);
    let checkDate = new Date();

    if (!completionDates.has(todayStr)) {
      // Check yesterday
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dStr = checkDate.toISOString().slice(0, 10);
      if (completionDates.has(dStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Recent completed tasks (last 10)
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
  }, [tasks]);

  const hours = Math.floor(stats.totalMinutesCompleted / 60);
  const remainingMins = stats.totalMinutesCompleted % 60;
  const timeFormatted = `${hours > 0 ? `${hours}h ` : ''}${remainingMins}m`;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tasa de cumplimiento */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Cumplimiento</span>
            <CheckCircle2 size={18} className="text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900 tracking-tight">
            {stats.completionRate}%
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {stats.completedCount} de {stats.total} tareas logradas
          </p>
        </div>

        {/* Tiempo Invertido */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tiempo Invertido</span>
            <Clock size={18} className="text-purple-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900 tracking-tight">
            {timeFormatted || '0m'}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            En tareas finalizadas
          </p>
        </div>

        {/* Racha de Enfoque */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Racha Activa</span>
            <Flame size={18} className="text-amber-500 fill-amber-500" />
          </div>
          <div className="text-3xl font-bold text-slate-900 tracking-tight">
            {stats.streak} {stats.streak === 1 ? 'día' : 'días'}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Constancia diaria completando foco
          </p>
        </div>

        {/* Pendientes en Bandeja */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pendientes</span>
            <Layers size={18} className="text-emerald-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900 tracking-tight">
            {stats.pendingCount}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Por resolver a tu ritmo
          </p>
        </div>
      </div>

      {/* Distribución por Áreas de Vida */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <PieChart size={18} className="text-blue-600" />
              Tiempo por Área de tu Vida
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Equilibrio entre las diferentes facetas de tu día a día.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500">
            {stats.totalMinutesCompleted} min totales
          </span>
        </div>

        <div className="space-y-4 pt-2">
          {stats.areaBreakdown.map((item) => {
            const style = areaColors[item.area] || {
              bar: 'bg-slate-400',
              text: 'text-slate-600',
              bg: 'bg-slate-50',
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
                    <span className="text-slate-500">
                      {item.count} {item.count === 1 ? 'tarea' : 'tareas'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{itemTimeFormatted}</span>
                    <span className="text-slate-400 w-8 text-right">{item.percent}%</span>
                  </div>
                </div>

                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
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
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-emerald-600" />
          Historial de Victorias Recientes
        </h3>

        {stats.recentCompleted.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4 text-center">
            Aún no has completado tareas. ¡Comenzá marcando tu primera prioridad de hoy!
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {stats.recentCompleted.map((task) => (
              <div
                key={task.id}
                className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 px-2 rounded-lg transition-colors cursor-pointer"
                onClick={() => onSelectTask(task)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate line-through opacity-80">
                      {task.title}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
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
                  <span className="text-xs text-slate-400 shrink-0 font-mono">
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
