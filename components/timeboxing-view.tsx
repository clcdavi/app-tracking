'use client';

import { useMemo } from 'react';
import { Task, taskKey } from '@/lib/planner';
import { minutesToTime, timeToMinutes } from '@/lib/settings';
import { Clock, Play, CheckCircle2, Circle } from 'lucide-react';

interface TimeboxingViewProps {
  tasks: Task[];
  workdayStart: string;
  onToggleDone: (task: Task) => void;
  onSelectTask: (task: Task) => void;
  onStartFocus: (task: Task) => void;
}

const areaBadgeColors: Record<string, string> = {
  Personal: 'bg-[#579dff]/15 text-[#579dff] border-[#579dff]/30',
  Trabajo: 'bg-[#9f8fef]/15 text-[#9f8fef] border-[#9f8fef]/30',
  Estudio: 'bg-[#f5cd47]/15 text-[#e2b203] border-[#f5cd47]/30',
  Iglesia: 'bg-[#4bce97]/15 text-[#4bce97] border-[#4bce97]/30',
  Proyectos: 'bg-[#fea362]/15 text-[#fea362] border-[#fea362]/30',
};

export function TimeboxingView({
  tasks,
  workdayStart = '09:00',
  onToggleDone,
  onSelectTask,
  onStartFocus,
}: TimeboxingViewProps) {
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
      <div className="border border-dashed border-[var(--j-border)] rounded-xl p-8 text-center jira-panel-card">
        <Clock size={28} className="mx-auto jira-text-subtle mb-2" />
        <h3 className="text-sm font-semibold">Sin tareas en el itinerario de hoy</h3>
        <p className="text-xs jira-text-subtle max-w-sm mx-auto mt-1">
          Planificá tus prioridades del día para que se organicen automáticamente en bloques de tiempo cronológicos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs jira-text-subtle px-1">
        <span>Itinerario sugerido desde las {workdayStart} hs</span>
        <span>{schedule.length} bloques planificados</span>
      </div>

      <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[var(--j-border)]">
        {schedule.map(({ task, startTime, endTime, isCurrentSlot }) => {
          const isDone = task.status === 'done';
          const areaClass =
            areaBadgeColors[task.area] ||
            'bg-slate-500/15 jira-text-subtle border-[var(--j-border)]';

          return (
            <div
              key={task.id}
              className={`relative jira-panel-card p-3.5 transition-all ${
                isCurrentSlot
                  ? 'border-[#579dff]! ring-2 ring-[#579dff]/20'
                  : 'hover:border-[var(--j-border-input)]'
              } ${isDone ? 'opacity-60' : ''}`}
            >
              {/* Timeline marker */}
              <div
                className={`absolute -left-[19px] top-4.5 w-3 h-3 rounded-full border-2 transition-colors ${
                  isCurrentSlot
                    ? 'bg-[#579dff] border-[var(--j-bg-canvas)] ring-2 ring-[#579dff]'
                    : isDone
                    ? 'bg-[#4bce97] border-[var(--j-bg-canvas)]'
                    : 'bg-[var(--j-bg-surface)] border-[var(--j-border-input)]'
                }`}
              />

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onToggleDone(task)}
                    className="mt-0.5 jira-text-subtle hover:text-[#579dff] transition-colors shrink-0"
                    title={isDone ? 'Marcar como pendiente' : 'Marcar como completada'}
                  >
                    {isDone ? (
                      <CheckCircle2 size={18} className="text-[#4bce97]" />
                    ) : (
                      <Circle size={18} />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-[var(--j-bg-sunken)] border border-[var(--j-border)]">
                        {startTime} – {endTime}
                      </span>
                      <span className="text-[11px] font-mono jira-text-subtle">
                        {taskKey(task, tasks)}
                      </span>
                      <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${areaClass}`}>
                        {task.area}
                      </span>
                      {isCurrentSlot && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#579dff] text-[#1d2125] font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1d2125] animate-pulse" />
                          En curso ahora
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectTask(task)}
                      className={`text-sm font-semibold text-left hover:text-[#579dff] transition-colors block truncate w-full ${
                        isDone ? 'line-through jira-text-subtle' : ''
                      }`}
                    >
                      {task.title}
                    </button>

                    {task.project && (
                      <span className="text-[11px] jira-text-subtle mt-0.5 block truncate">
                        📁 {task.project}
                      </span>
                    )}
                  </div>
                </div>

                {!isDone && (
                  <button
                    type="button"
                    onClick={() => onStartFocus(task)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded bg-[#579dff]/15 text-[#579dff] hover:bg-[#579dff]/25 font-semibold transition-colors shrink-0"
                    title="Iniciar bloque de enfoque"
                  >
                    <Play size={12} className="fill-current" />
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
