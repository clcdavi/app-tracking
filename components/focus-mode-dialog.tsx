'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Task } from '@/lib/planner';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Coffee,
  Brain,
  Volume2,
  VolumeX,
  X,
  ChevronDown,
} from 'lucide-react';

interface FocusModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  initialTaskId?: string;
  focusMinutes?: number;
  breakMinutes?: number;
  soundEnabled?: boolean;
  onCompleteTask: (task: Task) => Promise<void>;
}

export function FocusModeDialog({
  open,
  onOpenChange,
  tasks,
  initialTaskId,
  focusMinutes = 25,
  breakMinutes = 5,
  soundEnabled = true,
  onCompleteTask,
}: FocusModeDialogProps) {
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [selectedTaskId, setSelectedTaskId] = useState<string>(initialTaskId || '');
  const [secondsLeft, setSecondsLeft] = useState<number>(focusMinutes * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [audioActive, setAudioActive] = useState<boolean>(soundEnabled);

  // Sync initial task
  useEffect(() => {
    if (initialTaskId) {
      setSelectedTaskId(initialTaskId);
    } else if (tasks.length > 0 && !selectedTaskId) {
      const topPending = tasks.find((t) => t.status !== 'done');
      if (topPending) setSelectedTaskId(topPending.id);
    }
  }, [initialTaskId, tasks, selectedTaskId]);

  // Sync timer duration if mode changes or dialog opens
  useEffect(() => {
    if (open) {
      const duration = mode === 'focus' ? focusMinutes * 60 : breakMinutes * 60;
      setSecondsLeft(duration);
      setIsRunning(false);
    }
  }, [open, mode, focusMinutes, breakMinutes]);

  const activeTask = tasks.find((t) => t.id === selectedTaskId) || null;

  const playNotificationSound = useCallback(() => {
    if (!audioActive) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {
      console.warn('Audio playback not permitted or supported:', e);
    }
  }, [audioActive]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (isRunning && secondsLeft === 0) {
      setIsRunning(false);
      playNotificationSound();
      // Auto-toggle to the other mode
      if (mode === 'focus') {
        setMode('break');
        setSecondsLeft(breakMinutes * 60);
      } else {
        setMode('focus');
        setSecondsLeft(focusMinutes * 60);
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, secondsLeft, mode, focusMinutes, breakMinutes, playNotificationSound]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const totalDuration = mode === 'focus' ? focusMinutes * 60 : breakMinutes * 60;
  const progressPercent = Math.max(0, Math.min(100, ((totalDuration - secondsLeft) / totalDuration) * 100));

  function handleReset() {
    setIsRunning(false);
    setSecondsLeft(mode === 'focus' ? focusMinutes * 60 : breakMinutes * 60);
  }

  function toggleMode(newMode: 'focus' | 'break') {
    setIsRunning(false);
    setMode(newMode);
    setSecondsLeft(newMode === 'focus' ? focusMinutes * 60 : breakMinutes * 60);
  }

  async function handleMarkComplete() {
    if (!activeTask) return;
    playNotificationSound();
    await onCompleteTask(activeTask);
    // Switch to next available pending task
    const nextPending = tasks.find((t) => t.id !== activeTask.id && t.status !== 'done');
    if (nextPending) {
      setSelectedTaskId(nextPending.id);
      toggleMode('break');
    } else {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl bg-slate-900 text-white border-slate-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Background gradient orb */}
        <div
          className={`absolute -top-32 -right-32 w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-700 ${
            mode === 'focus' ? 'bg-blue-500' : 'bg-emerald-500'
          }`}
        />

        {/* Top Controls */}
        <div className="flex items-center justify-between relative z-10 mb-6">
          <div className="flex items-center gap-2 bg-slate-800/80 backdrop-blur-sm p-1 rounded-xl border border-slate-700/60">
            <button
              type="button"
              onClick={() => toggleMode('focus')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'focus'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Brain size={14} />
              Enfoque ({focusMinutes}m)
            </button>
            <button
              type="button"
              onClick={() => toggleMode('break')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'break'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Coffee size={14} />
              Descanso ({breakMinutes}m)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAudioActive(!audioActive)}
              className="p-2 rounded-lg bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition-colors"
              title={audioActive ? 'Silenciar sonido' : 'Activar sonido'}
            >
              {audioActive ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-lg bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Active Task Card */}
        <div className="relative z-10 bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 mb-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {mode === 'focus' ? 'Pendiente en foco' : 'En pausa'}
            </span>
            {activeTask && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium border border-blue-500/30">
                {activeTask.area}
              </span>
            )}
          </div>

          {activeTask ? (
            <div>
              <h3 className="text-lg font-semibold text-white leading-snug line-clamp-2">
                {activeTask.title}
              </h3>
              {activeTask.notes && (
                <p className="text-xs text-slate-400 mt-1 line-clamp-1">{activeTask.notes}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No hay tarea seleccionada</p>
          )}

          {/* Change task selector */}
          <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
            <span className="text-xs text-slate-400">Cambiar de tarea:</span>
            <div className="relative">
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="appearance-none bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg pl-2.5 pr-7 py-1 focus:outline-none focus:border-blue-500 max-w-[200px] truncate"
              >
                {tasks
                  .filter((t) => t.status !== 'done')
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </select>
              <ChevronDown
                size={12}
                className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Big Timer Display */}
        <div className="relative z-10 text-center py-6">
          <div className="text-7xl sm:text-8xl font-black tracking-tighter text-white font-mono drop-shadow-md">
            {formattedTime}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-800 rounded-full h-2 mt-6 overflow-hidden border border-slate-700/60">
            <div
              className={`h-full transition-all duration-300 ease-out ${
                mode === 'focus' ? 'bg-blue-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Timer Control Buttons */}
        <div className="relative z-10 flex items-center justify-center gap-4 mt-4">
          <button
            type="button"
            onClick={handleReset}
            className="p-3.5 rounded-2xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700/80 transition-all shadow-sm"
            title="Reiniciar temporizador"
          >
            <RotateCcw size={18} />
          </button>

          <button
            type="button"
            onClick={() => setIsRunning(!isRunning)}
            className={`flex items-center gap-2.5 px-8 py-3.5 rounded-2xl font-bold text-base shadow-lg transition-all ${
              isRunning
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : mode === 'focus'
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/25'
            }`}
          >
            {isRunning ? <Pause size={20} /> : <Play size={20} />}
            <span>{isRunning ? 'Pausar' : 'Comenzar'}</span>
          </button>

          {activeTask && mode === 'focus' && (
            <button
              type="button"
              onClick={handleMarkComplete}
              className="flex items-center gap-2 px-4 py-3.5 rounded-2xl bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 transition-all text-sm font-semibold"
              title="Marcar tarea como completada"
            >
              <CheckCircle2 size={18} />
              <span>Completada</span>
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
