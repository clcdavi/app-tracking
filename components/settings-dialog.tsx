'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  UserSettings,
  AREA_OPTIONS,
  DEFAULT_SETTINGS,
} from '@/lib/settings';
import {
  Clock,
  Bell,
  Sparkles,
  Timer,
  Send,
  Loader2,
  Calendar,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: UserSettings;
  onSave: (next: UserSettings) => Promise<void>;
}

export function SettingsDialog({
  open,
  onOpenChange,
  settings: initialSettings,
  onSave,
}: SettingsDialogProps) {
  const [form, setForm] = useState<UserSettings>(initialSettings || DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [testingType, setTestingType] = useState<string | null>(null);

  useEffect(() => {
    if (open && initialSettings) {
      setForm(initialSettings);
    }
  }, [open, initialSettings]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(form);
      toast.success('Configuración guardada correctamente.');
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message || 'Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  }

  async function testNotification(type: 'briefing' | 'review' | 'deadline') {
    setTestingType(type);
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo enviar la notificación');
      }
      toast.success(`Notificación enviada a Telegram: ${data.message}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTestingType(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white p-6 rounded-2xl">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            Ajustes y Personalización
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Configurá tu jornada, el temporizador de enfoque y tus recordatorios automáticos de Telegram.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* SECCIÓN 1: JORNADA Y PLANIFICACIÓN */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
              <Calendar size={17} className="text-blue-600" />
              <span>Jornada y Planificación</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Presupuesto diario por defecto
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={15}
                    max={1440}
                    step={15}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white"
                    value={form.dailyBudget}
                    onChange={(e) =>
                      setForm({ ...form, dailyBudget: Math.max(15, parseInt(e.target.value) || 120) })
                    }
                  />
                  <span className="text-xs text-slate-500 whitespace-nowrap">minutos</span>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {[60, 120, 240, 480].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setForm({ ...form, dailyBudget: mins })}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                        form.dailyBudget === mins
                          ? 'bg-blue-600 text-white border-blue-600 font-medium'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {mins / 60}h
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Hora de inicio de jornada
                </label>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-slate-400" />
                  <input
                    type="time"
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white"
                    value={form.workdayStart}
                    onChange={(e) => setForm({ ...form, workdayStart: e.target.value })}
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Se usa como punto de partida en el Timeboxing visual.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Área por defecto
                </label>
                <select
                  value={form.defaultArea}
                  onChange={(e) =>
                    setForm({ ...form, defaultArea: e.target.value as UserSettings['defaultArea'] })
                  }
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                >
                  {AREA_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Duración estándar
                </label>
                <input
                  type="number"
                  min={5}
                  max={240}
                  step={5}
                  value={form.defaultMinutes}
                  onChange={(e) =>
                    setForm({ ...form, defaultMinutes: Math.max(5, parseInt(e.target.value) || 30) })
                  }
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Prioridad estándar
                </label>
                <select
                  value={form.defaultPriority}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      defaultPriority: Number(e.target.value) as UserSettings['defaultPriority'],
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                >
                  <option value={1}>1 - Baja</option>
                  <option value={2}>2 - Media</option>
                  <option value={3}>3 - Alta</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: MODO ENFOQUE (POMODORO) */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
              <Timer size={17} className="text-blue-600" />
              <span>Modo Enfoque (Pomodoro)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Bloque de Enfoque (minutos)
                </label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  step={5}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white"
                  value={form.focusMinutes}
                  onChange={(e) =>
                    setForm({ ...form, focusMinutes: Math.max(5, parseInt(e.target.value) || 25) })
                  }
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Descanso corto (minutos)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white"
                  value={form.breakMinutes}
                  onChange={(e) =>
                    setForm({ ...form, breakMinutes: Math.max(1, parseInt(e.target.value) || 5) })
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <div className="flex items-center gap-2">
                {form.focusSound ? (
                  <Volume2 size={16} className="text-blue-600" />
                ) : (
                  <VolumeX size={16} className="text-slate-400" />
                )}
                <div>
                  <div className="text-xs font-semibold text-slate-700">Sonido al terminar bloque</div>
                  <div className="text-[11px] text-slate-500">
                    Emite un aviso sonoro suave cuando expira el temporizador
                  </div>
                </div>
              </div>
              <Switch
                checked={form.focusSound}
                onCheckedChange={(checked) => setForm({ ...form, focusSound: checked })}
              />
            </div>
          </div>

          {/* SECCIÓN 3: NOTIFICACIONES PROACTIVAS DE TELEGRAM */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                <Bell size={17} className="text-blue-600" />
                <span>Notificaciones Proactivas (Telegram)</span>
              </div>
              <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                Horario Bs. As.
              </span>
            </div>

            {/* Briefing Matutino */}
            <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-800">☀️ Briefing Matutino</div>
                  <div className="text-[11px] text-slate-500">
                    Tu plan del día, prioridades Top 3 y capacidad disponible.
                  </div>
                </div>
                <Switch
                  checked={form.morningBriefing.enabled}
                  onCheckedChange={(checked) =>
                    setForm({
                      ...form,
                      morningBriefing: { ...form.morningBriefing, enabled: checked },
                    })
                  }
                />
              </div>

              {form.morningBriefing.enabled && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 font-medium">Hora de envío:</span>
                    <input
                      type="time"
                      value={form.morningBriefing.time}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          morningBriefing: { ...form.morningBriefing, time: e.target.value },
                        })
                      }
                      className="border border-slate-300 rounded px-2 py-0.5 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => testNotification('briefing')}
                    disabled={testingType !== null}
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded transition-colors font-medium disabled:opacity-50"
                  >
                    {testingType === 'briefing' ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Send size={13} />
                    )}
                    Probar envío
                  </button>
                </div>
              )}
            </div>

            {/* Revisión Vespertina */}
            <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-800">🌙 Revisión Vespertina</div>
                  <div className="text-[11px] text-slate-500">
                    Balance de tareas completadas y botones rápidos para posponer pendientes.
                  </div>
                </div>
                <Switch
                  checked={form.eveningReview.enabled}
                  onCheckedChange={(checked) =>
                    setForm({
                      ...form,
                      eveningReview: { ...form.eveningReview, enabled: checked },
                    })
                  }
                />
              </div>

              {form.eveningReview.enabled && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 font-medium">Hora de envío:</span>
                    <input
                      type="time"
                      value={form.eveningReview.time}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          eveningReview: { ...form.eveningReview, time: e.target.value },
                        })
                      }
                      className="border border-slate-300 rounded px-2 py-0.5 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => testNotification('review')}
                    disabled={testingType !== null}
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded transition-colors font-medium disabled:opacity-50"
                  >
                    {testingType === 'review' ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Send size={13} />
                    )}
                    Probar envío
                  </button>
                </div>
              )}
            </div>

            {/* Recordatorio de Vencimientos */}
            <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-800">⚠️ Vencimientos y Seguimientos</div>
                  <div className="text-[11px] text-slate-500">
                    Alerta cuando hay tareas con fecha límite hoy o vencidas.
                  </div>
                </div>
                <Switch
                  checked={form.deadlineReminder.enabled}
                  onCheckedChange={(checked) =>
                    setForm({
                      ...form,
                      deadlineReminder: { ...form.deadlineReminder, enabled: checked },
                    })
                  }
                />
              </div>

              {form.deadlineReminder.enabled && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 font-medium">Hora de envío:</span>
                    <input
                      type="time"
                      value={form.deadlineReminder.time}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          deadlineReminder: { ...form.deadlineReminder, time: e.target.value },
                        })
                      }
                      className="border border-slate-300 rounded px-2 py-0.5 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => testNotification('deadline')}
                    disabled={testingType !== null}
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded transition-colors font-medium disabled:opacity-50"
                  >
                    {testingType === 'deadline' ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Send size={13} />
                    )}
                    Probar envío
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN 4: INTELIGENCIA ARTIFICIAL GEMINI */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={17} className="text-blue-600" />
                <div>
                  <div className="text-xs font-semibold text-slate-800">
                    Estimación inteligente con Gemini AI
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Sugerir automáticamente duración, área y prioridad al capturar notas por voz o texto.
                  </div>
                </div>
              </div>
              <Switch
                checked={form.aiAutoEstimate}
                onCheckedChange={(checked) => setForm({ ...form, aiAutoEstimate: checked })}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium rounded-lg hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saving ? 'Guardando...' : 'Guardar ajustes'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
