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
  Moon,
  Sun,
  Palette,
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
      toast.success(data.message || 'Notificación enviada a Telegram con éxito.');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTestingType(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto jira-modal p-6 rounded-xl">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
            Ajustes y Personalización
          </DialogTitle>
          <DialogDescription className="text-sm jira-text-subtle">
            Configurá el tema visual de Enfoco, tu jornada, el temporizador Pomodoro y tus avisos de Telegram.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* SECCIÓN 0: TEMA VISUAL (OSCURO / CLARO) */}
          <div className="jira-panel-card p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Palette size={17} className="text-[#579dff]" />
              <span>Apariencia del Espacio</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, theme: 'dark' })}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                  form.theme === 'dark'
                    ? 'border-[#579dff] bg-[#579dff]/15 ring-1 ring-[#579dff]'
                    : 'border-[var(--j-border)] hover:bg-[var(--j-bg-surface-hover)]'
                }`}
              >
                <span className="w-8 h-8 rounded-md bg-[#1d2125] border border-[#38414a] text-[#579dff] grid place-items-center shrink-0">
                  <Moon size={16} />
                </span>
                <div>
                  <div className="text-xs font-bold">Tema Oscuro</div>
                  <div className="text-[11px] jira-text-subtle">Contraste profundo descanso visual</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setForm({ ...form, theme: 'light' })}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                  form.theme === 'light'
                    ? 'border-[#0c66e4] bg-[#579dff]/15 ring-1 ring-[#0c66e4]'
                    : 'border-[var(--j-border)] hover:bg-[var(--j-bg-surface-hover)]'
                }`}
              >
                <span className="w-8 h-8 rounded-md bg-[#f7f8f9] border border-[#dcdfe4] text-[#0c66e4] grid place-items-center shrink-0">
                  <Sun size={16} />
                </span>
                <div>
                  <div className="text-xs font-bold">Tema Claro</div>
                  <div className="text-[11px] jira-text-subtle">Fondo limpio y luminoso</div>
                </div>
              </button>
            </div>
          </div>

          {/* SECCIÓN 1: JORNADA Y PLANIFICACIÓN */}
          <div className="jira-panel-card p-4 space-y-4">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Calendar size={17} className="text-[#579dff]" />
              <span>Jornada y Planificación</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold jira-text-subtle mb-1 block">
                  Presupuesto diario por defecto
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={15}
                    max={1440}
                    step={15}
                    className="jira-input w-full px-3 py-1.5 text-sm"
                    value={form.dailyBudget}
                    onChange={(e) =>
                      setForm({ ...form, dailyBudget: Math.max(15, parseInt(e.target.value) || 120) })
                    }
                  />
                  <span className="text-xs jira-text-subtle whitespace-nowrap">minutos</span>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {[60, 120, 240, 480].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setForm({ ...form, dailyBudget: mins })}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                        form.dailyBudget === mins
                          ? 'bg-[#579dff] text-[#1d2125] border-[#579dff] font-bold'
                          : 'border-[var(--j-border)] jira-text-subtle hover:bg-[var(--j-bg-surface-hover)]'
                      }`}
                    >
                      {mins / 60}h
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold jira-text-subtle mb-1 block">
                  Hora de inicio de jornada
                </label>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="jira-text-subtle" />
                  <input
                    type="time"
                    className="jira-input w-full px-3 py-1.5 text-sm"
                    value={form.workdayStart}
                    onChange={(e) => setForm({ ...form, workdayStart: e.target.value })}
                  />
                </div>
                <span className="text-[11px] jira-text-subtle mt-1 block">
                  Se usa como punto de partida en el Timeboxing visual.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--j-border)]">
              <div>
                <label className="text-xs font-medium jira-text-subtle mb-1 block">
                  Espacio / Área por defecto
                </label>
                <select
                  value={form.defaultArea}
                  onChange={(e) =>
                    setForm({ ...form, defaultArea: e.target.value as UserSettings['defaultArea'] })
                  }
                  className="jira-input w-full px-2.5 py-1.5 text-xs"
                >
                  {AREA_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium jira-text-subtle mb-1 block">
                  Duración estándar (min)
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
                  className="jira-input w-full px-2.5 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium jira-text-subtle mb-1 block">
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
                  className="jira-input w-full px-2.5 py-1.5 text-xs"
                >
                  <option value={1}>1 - Baja</option>
                  <option value={2}>2 - Media</option>
                  <option value={3}>3 - Alta</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: MODO ENFOQUE (POMODORO) */}
          <div className="jira-panel-card p-4 space-y-4">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Timer size={17} className="text-[#579dff]" />
              <span>Modo Enfoque (Pomodoro)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold jira-text-subtle mb-1 block">
                  Bloque de Enfoque (minutos)
                </label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  step={5}
                  className="jira-input w-full px-3 py-1.5 text-sm"
                  value={form.focusMinutes}
                  onChange={(e) =>
                    setForm({ ...form, focusMinutes: Math.max(5, parseInt(e.target.value) || 25) })
                  }
                />
              </div>

              <div>
                <label className="text-xs font-semibold jira-text-subtle mb-1 block">
                  Descanso corto (minutos)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  className="jira-input w-full px-3 py-1.5 text-sm"
                  value={form.breakMinutes}
                  onChange={(e) =>
                    setForm({ ...form, breakMinutes: Math.max(1, parseInt(e.target.value) || 5) })
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[var(--j-border)]">
              <div className="flex items-center gap-2">
                {form.focusSound ? (
                  <Volume2 size={16} className="text-[#579dff]" />
                ) : (
                  <VolumeX size={16} className="jira-text-subtle" />
                )}
                <div>
                  <div className="text-xs font-semibold">Sonido al terminar bloque</div>
                  <div className="text-[11px] jira-text-subtle">
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
          <div className="jira-panel-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Bell size={17} className="text-[#579dff]" />
                <span>Notificaciones Proactivas (Telegram)</span>
              </div>
              <span className="text-[11px] bg-[#579dff]/15 text-[#579dff] px-2 py-0.5 rounded-full font-medium">
                Horario Bs. As.
              </span>
            </div>

            {/* Briefing Matutino */}
            <div className="p-3 rounded-lg border border-[var(--j-border)] bg-[var(--j-bg-sunken)] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold">☀️ Briefing Matutino</div>
                  <div className="text-[11px] jira-text-subtle">
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
                <div className="flex items-center justify-between pt-2 border-t border-[var(--j-border)] gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs jira-text-subtle font-medium">Hora de envío:</span>
                    <input
                      type="time"
                      value={form.morningBriefing.time}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          morningBriefing: { ...form.morningBriefing, time: e.target.value },
                        })
                      }
                      className="jira-input px-2 py-0.5 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => testNotification('briefing')}
                    disabled={testingType !== null}
                    className="inline-flex items-center gap-1.5 text-xs text-[#579dff] bg-[#579dff]/15 hover:bg-[#579dff]/25 px-2.5 py-1 rounded transition-colors font-semibold disabled:opacity-50"
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
            <div className="p-3 rounded-lg border border-[var(--j-border)] bg-[var(--j-bg-sunken)] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold">🌙 Revisión Vespertina</div>
                  <div className="text-[11px] jira-text-subtle">
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
                <div className="flex items-center justify-between pt-2 border-t border-[var(--j-border)] gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs jira-text-subtle font-medium">Hora de envío:</span>
                    <input
                      type="time"
                      value={form.eveningReview.time}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          eveningReview: { ...form.eveningReview, time: e.target.value },
                        })
                      }
                      className="jira-input px-2 py-0.5 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => testNotification('review')}
                    disabled={testingType !== null}
                    className="inline-flex items-center gap-1.5 text-xs text-[#579dff] bg-[#579dff]/15 hover:bg-[#579dff]/25 px-2.5 py-1 rounded transition-colors font-semibold disabled:opacity-50"
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
            <div className="p-3 rounded-lg border border-[var(--j-border)] bg-[var(--j-bg-sunken)] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold">⚠️ Vencimientos y Seguimientos</div>
                  <div className="text-[11px] jira-text-subtle">
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
                <div className="flex items-center justify-between pt-2 border-t border-[var(--j-border)] gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs jira-text-subtle font-medium">Hora de envío:</span>
                    <input
                      type="time"
                      value={form.deadlineReminder.time}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          deadlineReminder: { ...form.deadlineReminder, time: e.target.value },
                        })
                      }
                      className="jira-input px-2 py-0.5 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => testNotification('deadline')}
                    disabled={testingType !== null}
                    className="inline-flex items-center gap-1.5 text-xs text-[#579dff] bg-[#579dff]/15 hover:bg-[#579dff]/25 px-2.5 py-1 rounded transition-colors font-semibold disabled:opacity-50"
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
          <div className="jira-panel-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={17} className="text-[#579dff]" />
                <div>
                  <div className="text-xs font-semibold">
                    Estimación inteligente con Gemini AI
                  </div>
                  <div className="text-[11px] jira-text-subtle">
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

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[var(--j-border)]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="jira-btn-subtle px-4 py-2"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="jira-create-btn px-5"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saving ? 'Guardando...' : 'Guardar ajustes'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
