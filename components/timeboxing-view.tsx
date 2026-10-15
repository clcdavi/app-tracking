'use client';

import { useMemo } from 'react';
import { Task } from '@/lib/planner';
import { minutesToTime, timeToMinutes } from '@/lib/settings';
import { Clock, Play, CheckCircle2, Circle, AlertCircle } from 'lucide-react';

interface TimeboxingViewProps {
  tasks: Task[];
  workdayStart: string;
  onToggleDone: (task: Task) => void;
  onSelectTask: (task: Task) => void;
  onStartFocus: (task: Task) => void;
}

const areaBadgeColors: Record<string, string> = {
  Personal: 'bg-blue-50 text-blue-700 border-blue-200',
  Trabajo: 'bg-purple-50 text-purple-700 border-purple-200',
  Estudio: 'bg-amber-50 text-amber-800 border-amber-200',
  Iglesia: 'bg-teal-50 text-teal-700 border-teal-200',
  Proyectos: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export function TimeboxingView({
  tasks,
  workdayStart = '09:00',
  onToggleDone,
  onSelectTask,
  onStartFocus,
}: TimeboxingViewProps) {
  // Current time in Buenos Aires (minutes since midnight)
  const currentMinutesInBsAs = useMemo(() => {
    try {
      const now = new Date();
      const parts = new Intl.DateTimeFormat('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      }).formatToParts(now);

      const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
      const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
      return hour * 60 + minute;
    } catch {
      const now = new Date();
      return now.getHours() * 60 + now.getMinutes();
    }
  }, []);

  const schedule = useMemo(() => {
    let currentMin = timeToMinutes(workdayStart);
    return tasks.map((task) => {
      const startMin = currentMin;
      const endMin = startMin + (task.minutes || 30);
      currentMin = endMin;

      const isCurrentSlot =
        currentMinutesInBsAs >= startMin && currentMinutesInBsAs < endMin;

      return {
        task,
        startTime: minutesToTime(startMin),
        endTime: minutesToTime(endMin),
        startMin,
        endMin,
        isCurrentSlot,
      };
    });
  }, [tasks, workdayStart, currentMinutesInBsAs]);

  if (tasks.length === 0) {
    return (
      <div className="border border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50/50">
        <Clock size={28} className="mx-auto text-slate-400 mb-2" />
        <h3 className="text-sm font-semibold text-slate-700">Sin tareas en el itinerario de hoy</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          Planificá tus prioridades del día para que se organicen automáticamente en bloques de tiempo cronológicos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>Itinerario sugerido desde las {workdayStart} hs</span>
        <span>{schedule.length} bloques planificados</span>
      </div>

      <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
        {schedule.map(({ task, startTime, endTime, isCurrentSlot }) => {
          const isDone = task.status === 'done';
          const areaClass = areaBadgeColors[task.area] || 'bg-slate-50 text-slate-700 border-slate-200';

          return (
            <div
              key={task.id}
              className={`relative bg-white border rounded-xl p-3.5 transition-all shadow-xs ${
                isCurrentSlot
                  ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/30'
                  : 'border-slate-200 hover:border-slate-300'
              } ${isDone ? 'opacity-60 bg-slate-50/60' : ''}`}
            >
              {/* Timeline marker */}
              <div
                className={`absolute -left-[19px] top-4.5 w-3 h-3 rounded-full border-2 transition-colors ${
                  isCurrentSlot
                    ? 'bg-blue-600 border-white ring-2 ring-blue-500'
                    : isDone
                    ? 'bg-emerald-500 border-white'
                    : 'bg-white border-slate-300'
                }`}
              />

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onToggleDone(task)}
                    className="mt-0.5 text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                    title={isDone ? 'Marcar como pendiente' : 'Marcar como completada'}
                  >
                    {isDone ? (
                      <CheckCircle2 size={18} className="text-emerald-600" />
                    ) : (
                      <Circle size={18} />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {startTime} – {endTime}
                      </span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${areaClass}`}>
                        {task.area}
                      </span>
                      {isCurrentSlot && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-600 text-white font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          En curso ahora
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectTask(task)}
                      className={`text-sm font-semibold text-left text-slate-900 hover:text-blue-600 transition-colors block truncate w-full ${
                        isDone ? 'line-through text-slate-400' : ''
                      }`}
                    >
                      {task.title}
                    </button>

                    {task.project && (
                      <span className="text-[11px] text-slate-500 mt-0.5 block truncate">
                        📁 {task.project}
                      </span>
                    )}
                  </div>
                </div>

                {!isDone && (
                  <button
                    type="button"
                    onClick={() => onStartFocus(task)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold transition-colors shrink-0"
                    title="Iniciar bloque de enfoque"
                  >
                    <Play size={12} className="fill-blue-700" />
                    <span>Foco</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
