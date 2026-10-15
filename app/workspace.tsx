'use client';

import { useEffect, useRef, useState, useMemo, type FormEvent } from 'react';
import Link from 'next/link';
import {
  Sun,
  Inbox,
  CalendarDays,
  Flag,
  Clock,
  CheckCheck,
  Layers,
  Plus,
  Search,
  Target,
  RefreshCw,
  Check,
  Play,
  Star,
  Trash2,
  Sparkles,
  Briefcase,
  BookOpen,
  Heart,
  Folder,
  ChevronRight,
  ChevronDown,
  Circle,
  Timer,
  Plug,
  LogOut,
  Settings,
  BarChart3,
  Loader2,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { SettingsDialog } from '@/components/settings-dialog';
import { FocusModeDialog } from '@/components/focus-mode-dialog';
import { TimeboxingView } from '@/components/timeboxing-view';
import { MetricsView } from '@/components/metrics-view';
import { UserSettings, DEFAULT_SETTINGS } from '@/lib/settings';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Toaster, toast } from 'sonner';
import {
  Task,
  Data,
  areas,
  states,
  today,
  addDays,
  dayLabel,
  newTask,
  attention,
  reason,
  score,
  suggestions,
} from '@/lib/planner';

const navs = [
  ['today', 'Mi día', Sun],
  ['inbox', 'Bandeja de entrada', Inbox],
  ['week', 'Próximos 7 días', CalendarDays],
  ['attention', 'Necesita atención', Flag],
  ['waiting', 'Esperando', Clock],
  ['all', 'Todos los pendientes', Layers],
  ['done', 'Completadas', CheckCheck],
  ['metrics', 'Métricas y Hábitos', BarChart3],
] as const;

const areaIcons = [Heart, Briefcase, BookOpen, Heart, Folder];
const priorityLabels = ['', 'Baja', 'Media', 'Alta'];

const arDateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Argentina/Buenos_Aires',
});

type UserInfo = { displayName: string; email: string };

function Choice({
  value,
  onChange,
  items,
  label,
  id,
}: {
  value: string;
  onChange: (s: string) => void;
  items: [string, string][] | string[][];
  label: string;
  id?: string;
}) {
  return (
    <div className="select-wrapper">
      <select
        id={id}
        aria-label={label}
        className="select-control"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {items.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <ChevronDown className="select-chevron" size={16} />
    </div>
  );
}

function Nav({
  view,
  setView,
  tasks,
  date,
  user,
  onLogout,
  onOpenSettings,
}: {
  view: string;
  setView: (v: string) => void;
  tasks: Task[];
  date: string;
  user: UserInfo | null;
  onLogout: () => void;
  onOpenSettings: () => void;
}) {
  const { setOpenMobile } = useSidebar();
  function go(v: string) {
    setView(v);
    setOpenMobile(false);
  }

  const displayName = user?.displayName || 'Usuario';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <Sidebar>
      <SidebarHeader className="brand">
        <span className="brand-icon">
          <span />
          <span />
          <span />
        </span>
        <span>
          enfoco<span className="brand-dot">.</span>
        </span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="nav-label">TU ESPACIO</SidebarGroupLabel>
          <SidebarMenu>
            {navs.map(([key, label, Icon]) => (
              <SidebarMenuItem key={key}>
                <SidebarMenuButton
                  className="nav-item"
                  isActive={view === key}
                  onClick={() => go(key)}
                >
                  <Icon />
                  <span>{label}</span>
                  {key === 'inbox' &&
                    tasks.filter((t) => t.status === 'inbox').length > 0 && (
                      <b className="nav-count">
                        {tasks.filter((t) => t.status === 'inbox').length}
                      </b>
                    )}
                  {key === 'attention' &&
                    tasks.some((t) => attention(t, date)) && (
                      <b className="nav-count">
                        {tasks.filter((t) => attention(t, date)).length}
                      </b>
                    )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="nav-label">ÁREAS DE TU VIDA</SidebarGroupLabel>
          <SidebarMenu>
            {areas.map((a, i) => {
              const Icon = areaIcons[i];
              return (
                <SidebarMenuItem key={a}>
                  <SidebarMenuButton
                    className="nav-item"
                    isActive={view === a}
                    onClick={() => go(a)}
                  >
                    <Icon />
                    <span>{a}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="profile">
          <span className="avatar">{initial}</span>
          <div className="min-w-0 flex-1">
            <b>{displayName}</b>
            <p className="truncate">{user?.email || 'Mi espacio personal'}</p>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors mt-1"
            >
              <LogOut size={12} /> Cerrar sesión
            </button>
          </div>
        </div>
        <div className="sidebar-note">
          <Target size={16} /> Un día posible, a tu ritmo.
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="sidebar-integration w-full text-left"
        >
          <Settings size={16} /> Ajustes y Notificaciones
        </button>
        <Link href="/integrations" className="sidebar-integration">
          <Plug size={16} /> Conectar otra app
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function Workspace() {
  const [data, setData] = useState<Data>({ tasks: [], budgets: {} });
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [auth, setAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(today);
  const [view, setView] = useState('today');
  const [query, setQuery] = useState('');
  const [quick, setQuick] = useState('');
  const [edit, setEdit] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [planning, setPlanning] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState('120');
  const [user, setUser] = useState<UserInfo | null>(null);

  // New customization & productivity states
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<string | undefined>(undefined);
  const [todayTab, setTodayTab] = useState<'list' | 'timeboxing'>('list');
  const [aiBreakdownLoading, setAiBreakdownLoading] = useState(false);
  const [aiSubtasks, setAiSubtasks] = useState<{ title: string; minutes: number }[] | null>(null);

  const isSyncingRef = useRef(false);
  const pendingSyncRef = useRef<Data | null>(null);

  const ref = useRef({ data, version });
  ref.current.data = data;
  ref.current.version = version;

  const tasks = data.tasks;
  const budget = data.budgets[date] ?? settings.dailyBudget ?? 120;

  async function reload() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/state', { cache: 'no-store' });
      const result = (await res.json()) as {
        data: Data;
        version: number;
        error: string;
      };
      if (!res.ok) {
        if (res.status === 401) {
          setAuth(true);
          window.location.href = '/login';
          return;
        }
        throw new Error(result.error);
      }
      setData(result.data);
      setVersion(result.version);
      setAuth(false);
    } catch (e) {
      setError((e as Error).message || 'No se pudo conectar.');
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(next: UserSettings) {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Error al guardar ajustes');
    }
    setSettings(result.settings);
  }

  useEffect(() => {
    void reload();

    // Fetch user details
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        const res = data as { user?: UserInfo } | null;
        if (res?.user) {
          setUser({
            displayName: res.user.displayName,
            email: res.user.email,
          });
        }
      })
      .catch(() => {});

    // Fetch user settings
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((res: { settings?: UserSettings } | null) => {
        if (res?.settings) {
          setSettings(res.settings);
        }
      })
      .catch(() => {});

    const id = setInterval(() => setDate(today()), 30000);
    return () => clearInterval(id);
  }, []);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch {
      toast.error('Error al cerrar sesión.');
    }
  }

  async function persist(next: Data) {
    // Optimistic update: render changes instantly (0ms latency)!
    setData(next);
    ref.current.data = next;

    // Queue sync in background
    pendingSyncRef.current = next;
    if (isSyncingRef.current) {
      return;
    }

    isSyncingRef.current = true;
    try {
      while (pendingSyncRef.current) {
        const toSync = pendingSyncRef.current;
        pendingSyncRef.current = null;

        const res = await fetch('/api/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: toSync, version: ref.current.version }),
        });

        const result = (await res.json()) as {
          data: Data;
          version: number;
          error?: string;
        };

        if (!res.ok) {
          setError(result.error || 'Error al guardar.');
          toast.error(result.error || 'No se pudieron sincronizar los cambios.');
          void reload();
          return;
        }

        ref.current.version = result.version;
        setVersion(result.version);
        setError('');
      }
    } catch (e) {
      console.error('Sync error:', e);
      toast.error('Problema de conexión al sincronizar.');
    } finally {
      isSyncingRef.current = false;
    }
  }

  async function saveTask(task: Task) {
    if (!task.title.trim()) throw new Error('Escribí qué necesitás hacer.');
    const t = {
      ...task,
      title: task.title.trim(),
      updated: new Date().toISOString(),
    };
    const current = ref.current.data;
    await persist({
      ...current,
      tasks: current.tasks.some((x) => x.id === t.id)
        ? current.tasks.map((x) => (x.id === t.id ? t : x))
        : [t, ...current.tasks],
    });
    return t;
  }

  async function patch(t: Task, changes: Partial<Task>) {
    try {
      await saveTask({ ...t, ...changes });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const actionRef = useRef({ saveTask });
  actionRef.current = { saveTask };

  // WebMCP tool registration (supported environments)
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: { registerTool: (t: unknown, o: unknown) => Promise<void> };
      }
    ).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    try {
      for (const tool of [
        {
          name: 'list_tasks',
          description: 'List the personal tasks currently loaded in Enfoco.',
          inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: () => ({ tasks: ref.current.data.tasks }),
        },
        {
          name: 'create_task',
          description: 'Create and save a new task in the inbox, visible in Enfoco.',
          inputSchema: {
            type: 'object',
            properties: { title: { type: 'string', minLength: 1, maxLength: 240 } },
            required: ['title'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          execute: async (input: unknown) => {
            const v = input as { title?: unknown };
            if (!v || typeof v.title !== 'string' || !v.title.trim() || v.title.length > 240)
              throw new Error('A title of 1–240 characters is required.');
            const t = await actionRef.current.saveTask(newTask(v.title));
            return { id: t.id, title: t.title, status: t.status };
          },
        },
      ]) {
        Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {});
      }
    } catch {}
    return () => lifecycle.abort();
  }, []);

  const dayTasks = useMemo(
    () => tasks.filter((t) => t.planDate === date && t.status !== 'waiting'),
    [tasks, date]
  );
  const top = useMemo(
    () => tasks.filter((t) => t.planDate === date && t.top),
    [tasks, date]
  );
  const plannedMinutes = useMemo(
    () => dayTasks.reduce((s, t) => s + t.minutes, 0),
    [dayTasks]
  );
  const doneMinutes = useMemo(
    () => dayTasks.filter((t) => t.status === 'done').reduce((s, t) => s + t.minutes, 0),
    [dayTasks]
  );
  const doneToday = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status === 'done' &&
          t.completed &&
          t.completed.slice(0, 10) === date
      ).length,
    [tasks, date]
  );

  const candidates = useMemo(
    () =>
      tasks
        .filter(
          (t) =>
            t.status !== 'done' &&
            t.status !== 'waiting' &&
            !(t.top && t.planDate === date) &&
            (!t.planDate || t.planDate <= date)
        )
        .sort((a, b) => score(b, date) - score(a, date)),
    [tasks, date]
  );

  const recommended = useMemo(
    () => suggestions(tasks, date, budget),
    [tasks, date, budget]
  );
  const needsAttention = useMemo(
    () => tasks.filter((t) => attention(t, date)),
    [tasks, date]
  );

  const filtered = useMemo(
    () =>
      tasks
        .filter((t) => {
          let match = false;
          if (view === 'today')
            match = t.planDate === date && t.status !== 'done' && t.status !== 'waiting';
          else if (view === 'inbox') match = t.status === 'inbox';
          else if (view === 'week')
            match =
              t.status !== 'done' &&
              ((t.planDate >= date && t.planDate <= addDays(date, 6)) ||
                (t.deadline >= date && t.deadline <= addDays(date, 6)));
          else if (view === 'attention') match = attention(t, date);
          else if (view === 'waiting') match = t.status === 'waiting';
          else if (view === 'done') match = t.status === 'done';
          else if (view === 'all') match = t.status !== 'done';
          else if (view === 'metrics') match = false;
          else match = t.area === view && t.status !== 'done';

          return (
            match &&
            (!query ||
              [t.title, t.project, t.notes].some((s) =>
                s.toLowerCase().includes(query.toLowerCase())
              ))
          );
        })
        .sort((a, b) =>
          view === 'done'
            ? b.completed.localeCompare(a.completed)
            : score(b, date) - score(a, date)
        ),
    [tasks, view, date, query]
  );

  const pageTitle =
    view === 'today'
      ? 'Dale foco a tu día.'
      : navs.find((n) => n[0] === view)?.[1] ?? view;

  const subtitle: Record<string, string> = {
    today: 'Elegí lo importante. Dejá espacio para lo inesperado.',
    inbox: 'Capturá primero. Decidí cuándo después.',
    week: 'Lo que elegiste hacer y lo que está por vencer.',
    attention: 'Revisá vencimientos, planes anteriores y próximos seguimientos.',
    waiting: 'Lo que depende de una respuesta o de otra persona.',
    all: 'Todos tus pendientes, ordenados por urgencia y prioridad.',
    done: 'El registro de lo que ya avanzaste.',
    metrics: 'Métricas de avance, tiempo invertido por área y constancia.',
  };

  function openPlanner() {
    setSelected(recommended.map((t) => t.id));
    setPlanning(true);
  }

  function startTask(topPriority = false) {
    const t = newTask();
    setEdit({
      ...t,
      area: settings.defaultArea || t.area,
      minutes: settings.defaultMinutes || t.minutes,
      priority: settings.defaultPriority || t.priority,
      ...(topPriority ? { top: true, planDate: date, status: 'todo' as const } : {}),
    });
    setAiSubtasks(null);
  }

  async function handleAiBreakdown() {
    if (!edit || !edit.title.trim()) {
      toast.error('Ingresá el título del pendiente para desglosarlo.');
      return;
    }
    setAiBreakdownLoading(true);
    try {
      const res = await fetch('/api/ai/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: edit.title,
          notes: edit.notes || '',
          area: edit.area,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'No se pudo desglosar la tarea');
      }
      setAiSubtasks(result.subtasks || []);
      toast.success('Desglose generado con Gemini AI.');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAiBreakdownLoading(false);
    }
  }

  async function applyAiSubtasks() {
    if (!edit || !aiSubtasks || aiSubtasks.length === 0) return;
    const newItems: Task[] = aiSubtasks.map((st) => ({
      id: 't-' + Math.random().toString(36).slice(2, 9),
      title: st.title,
      area: edit.area,
      status: 'todo',
      priority: edit.priority,
      minutes: st.minutes || 20,
      planDate: date,
      deadline: edit.deadline || '',
      followUp: '',
      project: edit.project || edit.title,
      notes: `Subtarea de: ${edit.title}`,
      top: false,
      created: new Date().toISOString(),
      completed: '',
      updated: new Date().toISOString(),
    }));

    const current = ref.current.data;
    await persist({
      ...current,
      tasks: [...newItems, ...current.tasks],
    });
    setAiSubtasks(null);
    toast.success(`Se agregaron ${newItems.length} subtareas a tu plan de hoy.`);
  }

  function appendSubtasksToNotes() {
    if (!edit || !aiSubtasks) return;
    const text = aiSubtasks.map((s) => `- [ ] ${s.title} (${s.minutes} min)`).join('\n');
    setEdit({
      ...edit,
      notes: edit.notes ? `${edit.notes}\n\nSubtareas sugeridas:\n${text}` : `Subtareas sugeridas:\n${text}`,
    });
    setAiSubtasks(null);
    toast.success('Subtareas agregadas a las notas.');
  }

  const complete = (t: Task) =>
    patch(t, {
      status: t.status === 'done' ? 'todo' : 'done',
      completed: t.status === 'done' ? '' : new Date().toISOString(),
    });

  const toggleTop = (t: Task) => {
    if (t.top && t.planDate === date) {
      void patch(t, { top: false });
      return;
    }
    if (top.length >= 3) {
      toast.error('Tu Top 3 ya está completo. Quitá una prioridad para hacer lugar.');
      return;
    }
    void patch(t, {
      top: true,
      planDate: date,
      status: t.status === 'inbox' || t.status === 'waiting' ? 'todo' : t.status,
    });
  };

  const selectedTasks = candidates.filter((t) => selected.includes(t.id));
  const addedMinutes = selectedTasks
    .filter((t) => t.planDate !== date)
    .reduce((s, t) => s + t.minutes, 0);

  async function acceptPlan() {
    try {
      const current = ref.current.data;
      await persist({
        ...current,
        tasks: current.tasks.map((t) =>
          selected.includes(t.id)
            ? {
                ...t,
                planDate: date,
                top: true,
                status: t.status === 'inbox' ? 'todo' : t.status,
                updated: new Date().toISOString(),
              }
            : t
        ),
      });
      setPlanning(false);
      setView('today');
      toast.success('Tu plan de hoy está listo.');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function row(t: Task) {
    return (
      <div className={'task-row ' + (t.status === 'done' ? 'is-done' : '')} key={t.id}>
        <Checkbox
          className="task-check"
          aria-label={t.status === 'done' ? `Reabrir ${t.title}` : `Completar ${t.title}`}
          checked={t.status === 'done'}
          onCheckedChange={() => void complete(t)}
        />
        <button className="task-main" onClick={() => setEdit({ ...t })}>
          <strong>{t.title}</strong>
          <div className="task-meta">
            <span className={'area-pill area-' + areas.indexOf(t.area as typeof areas[number])}>
              {t.area}
            </span>
            {t.project && <span>{t.project}</span>}
            <span>
              <Timer size={13} />
              {t.minutes} min
            </span>
            {t.deadline && (
              <span className={t.deadline < date && t.status !== 'done' ? 'late' : ''}>
                Vence {dayLabel(t.deadline)}
              </span>
            )}
            {t.planDate && view !== 'today' && <span>Plan: {dayLabel(t.planDate)}</span>}
            {t.followUp && <span>Seguimiento: {dayLabel(t.followUp)}</span>}
          </div>
        </button>
        <div className="row-end">
          {view === 'today' && t.status === 'todo' && (
            <button
              className="inline-action start-btn"
              aria-label={`Empezar ${t.title}`}
              title={`Empezar ${t.title}`}
              onClick={() => void patch(t, { status: 'doing' })}
            >
              <Play size={14} />
              <span>Empezar</span>
            </button>
          )}
          {view === 'attention' &&
            Boolean(t.planDate) &&
            t.planDate < date &&
            t.status !== 'waiting' && (
              <button
                className="inline-action reschedule-btn"
                aria-label={`Planificar ${t.title} para hoy`}
                title={`Planificar ${t.title} para hoy`}
                onClick={() =>
                  void patch(t, {
                    planDate: date,
                    top: false,
                    status: t.status === 'inbox' ? 'todo' : t.status,
                  })
                }
              >
                <CalendarDays size={14} />
                <span>Planificar hoy</span>
              </button>
            )}
          <span className={'priority p' + t.priority}>
            <span /> {priorityLabels[t.priority]}
          </span>
          {t.status !== 'todo' && t.status !== 'done' && (
            <span className="status-text">{states[t.status]}</span>
          )}
          {t.status !== 'done' && (
            <button
              className="icon-btn"
              title="Iniciar bloque de enfoque"
              aria-label={`Iniciar bloque de enfoque para ${t.title}`}
              onClick={() => {
                setFocusTaskId(t.id);
                setFocusOpen(true);
              }}
            >
              <Timer size={16} />
            </button>
          )}
          <button
            className={'icon-btn ' + (t.top && t.planDate === date ? 'starred' : '')}
            title={t.top && t.planDate === date ? 'Quitar de Top 3' : 'Elegir para Top 3 de hoy'}
            aria-label={t.top && t.planDate === date ? 'Quitar de Top 3' : 'Elegir para Top 3 de hoy'}
            disabled={t.status === 'done'}
            onClick={() => toggleTop(t)}
          >
            <Star
              size={18}
              fill={t.top && t.planDate === date ? 'currentColor' : 'none'}
            />
          </button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Nav
        view={view}
        setView={(v) => {
          setView(v);
          setQuery('');
        }}
        tasks={tasks}
        date={date}
        user={user}
        onLogout={handleLogout}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger className="mobile-menu" />
            <span>Mi espacio</span>
            <ChevronRight size={14} />
            <b>{navs.find((n) => n[0] === view)?.[1] ?? view}</b>
          </div>
          <div className="top-actions">
            <span className="private-label">Espacio privado</span>
            <button
              className="outline-btn"
              onClick={() => {
                const nextTask =
                  top.find((t) => t.status !== 'done') ||
                  tasks.find((t) => t.status !== 'done');
                setFocusTaskId(nextTask?.id);
                setFocusOpen(true);
              }}
              title="Modo Enfoque (Pomodoro)"
            >
              <Timer size={16} /> Modo Enfoque
            </button>
            <button
              className="icon-btn"
              onClick={() => setSettingsOpen(true)}
              title="Ajustes y Personalización"
              aria-label="Ajustes y Personalización"
            >
              <Settings size={18} />
            </button>
            <button
              className="icon-btn"
              aria-label="Actualizar pendientes"
              onClick={() => void reload()}
              disabled={busy || loading}
            >
              <RefreshCw size={17} className={loading ? 'spin' : ''} />
            </button>
            <button
              className="primary-btn"
              disabled={loading || auth}
              onClick={() => startTask()}
            >
              <Plus size={17} /> Nueva tarea
            </button>
          </div>
        </header>

        <div className="page">
          <section className="heading">
            <div>
              <p className="eyebrow">
                {new Intl.DateTimeFormat('es-AR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  timeZone: 'UTC',
                }).format(new Date(date + 'T12:00:00Z'))}
              </p>
              <h1>{pageTitle}</h1>
              <p className="subtitle">
                {subtitle[view] ?? 'Un lugar para avanzar en esta parte de tu vida.'}
              </p>
            </div>
            {view === 'today' && (
              <div className="daily-achieved">
                <span>{doneToday.toString().padStart(2, '0')}</span>
                <div>
                  completadas
                  <br />
                  hoy
                </div>
                <CheckCheck size={22} />
              </div>
            )}
          </section>

          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              {auth ? (
                <Link href="/login" className="underline font-semibold ml-2">
                  Iniciar sesión
                </Link>
              ) : (
                <button onClick={() => void reload()} disabled={busy}>
                  Actualizar vista
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className="loading-grid" aria-label="Cargando pendientes">
              <Skeleton className="h-44" />
              <Skeleton className="h-44" />
              <Skeleton className="h-44" />
            </div>
          ) : (
            <>
              <form
                className="quick-capture"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!quick.trim()) return;
                  try {
                    await saveTask(newTask(quick));
                    setQuick('');
                    toast.success('Guardada en tu bandeja de entrada.');
                  } catch (err) {
                    toast.error((err as Error).message);
                  }
                }}
              >
                <Plus size={20} />
                <input
                  aria-label="Capturar un pendiente"
                  placeholder="¿Qué tenés en mente? Anotalo acá…"
                  maxLength={240}
                  value={quick}
                  onChange={(e) => setQuick(e.target.value)}
                  disabled={auth}
                />
                <span className="capture-hint">A tu bandeja de entrada</span>
                <button
                  type="submit"
                  className="capture-button"
                  disabled={!quick.trim() || auth}
                >
                  Guardar
                </button>
              </form>

              <div className={'content-grid ' + (view === 'today' ? '' : 'single')}>
                <div className="main-column">
                  {view === 'metrics' ? (
                    <MetricsView
                      tasks={tasks}
                      date={date}
                      onSelectTask={(t) => setEdit({ ...t })}
                    />
                  ) : (
                    <>
                      {view === 'today' && (
                        <>
                          <div className="section-heading">
                            <div>
                              <h2>
                                <Target size={19} /> Tus 3 prioridades
                              </h2>
                              <p>No hace falta hacer todo para avanzar.</p>
                            </div>
                            <button
                              className="text-btn"
                              onClick={openPlanner}
                              disabled={auth}
                            >
                              <Sparkles size={16} /> Proponer mi día
                            </button>
                          </div>

                          <div className="top-three">
                            {[0, 1, 2].map((i) => {
                              const t = top[i];
                              return t ? (
                                <article
                                  className={
                                    'focus-card ' + (t.status === 'done' ? 'completed' : '')
                                  }
                                  key={t.id}
                                >
                                  <div className="focus-top">
                                    <span className="focus-number">0{i + 1}</span>
                                    <span
                                      className={
                                        'area-pill area-' +
                                        areas.indexOf(t.area as typeof areas[number])
                                      }
                                    >
                                      {t.area}
                                    </span>
                                    <div className="flex items-center gap-1 ml-auto">
                                      {t.status !== 'done' && (
                                        <button
                                          className="icon-btn"
                                          onClick={() => {
                                            setFocusTaskId(t.id);
                                            setFocusOpen(true);
                                          }}
                                          title="Iniciar bloque de enfoque"
                                          aria-label={`Iniciar bloque de enfoque para ${t.title}`}
                                        >
                                          <Timer size={15} />
                                        </button>
                                      )}
                                      <button
                                        className="icon-btn"
                                        onClick={() => toggleTop(t)}
                                        aria-label={`Quitar ${t.title} de Top 3`}
                                      >
                                        <Star size={16} fill="currentColor" />
                                      </button>
                                    </div>
                                  </div>
                                  <button
                                    className="focus-title"
                                    onClick={() => setEdit({ ...t })}
                                  >
                                    {t.title}
                                  </button>
                                  <p className="focus-reason">
                                    {t.status === 'done'
                                      ? 'Completada. Buen avance.'
                                      : reason(t, date)}
                                  </p>
                                  <div className="focus-bottom">
                                    <span>
                                      <Clock size={14} />
                                      {t.minutes} min
                                    </span>
                                    <button
                                      className="complete-btn"
                                      onClick={() => void complete(t)}
                                    >
                                      {t.status === 'done' ? (
                                        <Check size={16} />
                                      ) : (
                                        <Circle size={16} />
                                      )}{' '}
                                      {t.status === 'done' ? 'Hecha' : 'Completar'}
                                    </button>
                                  </div>
                                </article>
                              ) : (
                                <button
                                  className="focus-card empty-focus"
                                  key={i}
                                  onClick={() =>
                                    tasks.some((task) => task.status !== 'done')
                                      ? openPlanner()
                                      : startTask(true)
                                  }
                                  disabled={auth}
                                >
                                  <span className="focus-number">0{i + 1}</span>
                                  <span className="empty-plus">
                                    <Plus size={21} />
                                  </span>
                                  <b>Elegí una prioridad</b>
                                  <span>Un paso que valga la pena hoy</span>
                                </button>
                              );
                            })}
                          </div>

                          {needsAttention.length > 0 && (
                            <button
                              className="attention-strip"
                              onClick={() => setView('attention')}
                            >
                              <span>
                                <Flag size={17} />
                                <b>
                                  {needsAttention.length}{' '}
                                  {needsAttention.length === 1
                                    ? 'pendiente necesita'
                                    : 'pendientes necesitan'}{' '}
                                  tu atención
                                </b>
                              </span>
                              <span>
                                Revisar <ChevronRight size={16} />
                              </span>
                            </button>
                          )}
                        </>
                      )}

                      <section className="task-panel">
                        <div className="list-toolbar">
                          <div className="flex items-center gap-3">
                            <h2>
                              {view === 'today' ? 'Tu plan de hoy' : 'Pendientes'}{' '}
                              <span className="count-pill">{filtered.length}</span>
                            </h2>
                            {view === 'today' && (
                              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => setTodayTab('list')}
                                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                                    todayTab === 'list'
                                      ? 'bg-white text-slate-800 shadow-xs'
                                      : 'text-slate-500 hover:text-slate-700'
                                  }`}
                                >
                                  Lista
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTodayTab('timeboxing')}
                                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                                    todayTab === 'timeboxing'
                                      ? 'bg-white text-blue-600 shadow-xs'
                                      : 'text-slate-500 hover:text-slate-700'
                                  }`}
                                >
                                  Timeboxing
                                </button>
                              </div>
                            )}
                          </div>
                          <label className="search">
                            <Search size={16} />
                            <input
                              aria-label="Buscar en esta vista"
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                              placeholder="Buscar…"
                            />
                          </label>
                        </div>

                        {view === 'today' && todayTab === 'timeboxing' ? (
                          <div className="p-5">
                            <TimeboxingView
                              tasks={dayTasks}
                              workdayStart={settings.workdayStart}
                              onToggleDone={(t) => void complete(t)}
                              onSelectTask={(t) => setEdit({ ...t })}
                              onStartFocus={(t) => {
                                setFocusTaskId(t.id);
                                setFocusOpen(true);
                              }}
                            />
                          </div>
                        ) : filtered.length ? (
                          filtered.map(row)
                        ) : (
                      <Empty className="empty-state">
                        <EmptyHeader>
                          <div className="empty-symbol">
                            {view === 'done' ? (
                              <CheckCheck size={25} />
                            ) : view === 'today' ? (
                              <Sun size={25} />
                            ) : (
                              <Inbox size={25} />
                            )}
                          </div>
                          <EmptyTitle>
                            {query
                              ? 'No encontramos coincidencias'
                              : view === 'today'
                                ? 'Tu día empieza con una decisión'
                                : view === 'done'
                                  ? 'Cada avance va a quedar acá'
                                  : view === 'attention'
                                    ? 'Todo al día por acá'
                                    : 'Todavía no hay pendientes acá'}
                          </EmptyTitle>
                          <EmptyDescription>
                            {query
                              ? 'Probá con otra palabra.'
                              : view === 'today'
                                ? 'Anotá tus pendientes, definí tu tiempo disponible y elegí hasta tres prioridades.'
                                : view === 'attention'
                                  ? 'Los vencimientos, seguimientos y planes anteriores aparecerán en esta vista.'
                                  : view === 'done'
                                    ? 'Completá una tarea para empezar a ver tu progreso.'
                                    : 'Agregá una tarea o cambiá su área o estado desde el detalle.'}
                          </EmptyDescription>
                        </EmptyHeader>
                        {!query && view !== 'done' && view !== 'attention' && (
                          <button
                            className="outline-btn"
                            disabled={auth}
                            onClick={() =>
                              tasks.length && view === 'today'
                                ? openPlanner()
                                : startTask()
                            }
                          >
                            <Plus size={16} />
                            {tasks.length && view === 'today'
                              ? 'Elegir tareas para hoy'
                              : 'Agregar mi primer pendiente'}
                          </button>
                        )}
                      </Empty>
                    )}
                  </section>

                  {view === 'today' && (
                    <p className="below-note">
                      Lo que no elijas hoy sigue en tus pendientes. Podés volver a planificarlo
                      cuando tenga sentido.
                    </p>
                  )}
                    </>
                  )}
                </div>

                {view === 'today' && (
                  <aside className="day-aside">
                    <section className="capacity-card">
                      <div className="aside-title">
                        <span className="tiny-icon">
                          <Clock size={18} />
                        </span>
                        <h2>Un plan que entre</h2>
                      </div>
                      <p>¿Cuánto tiempo tenés hoy?</p>
                      <button
                        className="budget-value"
                        onClick={() => {
                          setBudgetInput(String(budget));
                          setBudgetOpen(true);
                        }}
                        disabled={auth}
                      >
                        {budget < 60
                          ? `${budget} min`
                          : `${Math.floor(budget / 60)} h${
                              budget % 60 ? ' ' + (budget % 60) + ' min' : ''
                            }`}
                        <span>Editar</span>
                      </button>
                      <div className="budget-label">
                        <span>{plannedMinutes} min planificados</span>
                        <b>{budget ? Math.round((plannedMinutes / budget) * 100) : plannedMinutes ? '>100' : 0}%</b>
                      </div>
                      <Progress
                        aria-label="Capacidad del día utilizada"
                        value={
                          budget
                            ? Math.min(100, (plannedMinutes / budget) * 100)
                            : plannedMinutes
                              ? 100
                              : 0
                        }
                      />
                      <p
                        className={
                          plannedMinutes > budget ? 'capacity-warning' : 'capacity-caption'
                        }
                      >
                        {plannedMinutes > budget
                          ? `Tu plan excede tu tiempo por ${
                              plannedMinutes - budget
                            } min. Reprogramá alguna tarea.`
                          : `Te quedan ${budget - plannedMinutes} min sin asignar.`}
                      </p>
                      <div className="capacity-divider" />
                      <div className="completed-minutes">
                        <CheckCheck size={17} />
                        <span>{doneMinutes} min de tareas completadas</span>
                      </div>
                    </section>

                    <section className="next-step">
                      <div className="aside-title">
                        <Sparkles size={18} />
                        <h2>Tu siguiente paso</h2>
                      </div>
                      {top.find((t) => t.status !== 'done') ? (
                        <>
                          <p>Empezá por una de las prioridades que elegiste.</p>
                          <button
                            className="next-title"
                            onClick={() =>
                              setEdit({ ...top.find((t) => t.status !== 'done')! })
                            }
                          >
                            {top.find((t) => t.status !== 'done')!.title}
                            <ChevronRight size={17} />
                          </button>
                        </>
                      ) : (
                        <>
                          <p>
                            {tasks.some((t) => t.status !== 'done')
                              ? 'Podemos ayudarte a elegir según vencimiento, prioridad y tiempo disponible.'
                              : 'Sacá los pendientes de tu cabeza. Después elegimos por dónde empezar.'}
                          </p>
                          <button
                            className="text-btn"
                            disabled={auth}
                            onClick={() => (tasks.length ? openPlanner() : startTask())}
                          >
                            {tasks.length ? 'Preparar mi Top 3' : 'Anotar un pendiente'}
                          </button>
                        </>
                      )}
                    </section>

                    <section className="daily-ritual">
                      <span className="eyebrow">TU REVISIÓN DIARIA</span>
                      <p>
                        <b>Al empezar</b>
                        <br />
                        Elegí un plan posible.
                      </p>
                      <p>
                        <b>Al terminar</b>
                        <br />
                        Reconocé el avance y revisá lo que quedó.
                      </p>
                      <span>Fechas en horario de Buenos Aires</span>
                    </section>
                  </aside>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Task Edit / Create Dialog */}
      <Dialog
        open={Boolean(edit)}
        onOpenChange={(v) => {
          if (!v && !busy) setEdit(null);
        }}
      >
        <DialogContent
          className="task-dialog"
          onOpenAutoFocus={(event) => {
            if (window.matchMedia('(max-width: 767px)').matches) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {edit && tasks.some((t) => t.id === edit.id)
                ? 'Detalle del pendiente'
                : 'Un nuevo pendiente'}
            </DialogTitle>
            <DialogDescription>
              Definí el próximo paso. Podés organizar los detalles después.
            </DialogDescription>
          </DialogHeader>

          {edit && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await saveTask(edit);
                  setEdit(null);
                  toast.success('Pendiente guardado.');
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            >
              <div className="field">
                <label htmlFor="task-title">¿Qué necesitás hacer?</label>
                <input
                  id="task-title"
                  value={edit.title}
                  required
                  maxLength={240}
                  placeholder="Ej.: terminar el ejercicio de programación"
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                />
              </div>

              <div className="form-grid">
                <div className="field">
                  <label htmlFor="task-area">Área</label>
                  <Choice
                    id="task-area"
                    label="Área"
                    value={edit.area}
                    onChange={(area) => setEdit({ ...edit, area })}
                    items={areas.map((a) => [a, a])}
                  />
                </div>
                <div className="field">
                  <label htmlFor="task-status">Estado</label>
                  <Choice
                    id="task-status"
                    label="Estado"
                    value={edit.status}
                    onChange={(v) =>
                      setEdit({
                        ...edit,
                        status: v as Task['status'],
                        top: v === 'waiting' ? false : edit.top,
                        completed: v === 'done' ? (edit.completed || new Date().toISOString()) : '',
                      })
                    }
                    items={Object.entries(states)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="task-priority">Prioridad</label>
                  <Choice
                    id="task-priority"
                    label="Prioridad"
                    value={String(edit.priority)}
                    onChange={(v) => setEdit({ ...edit, priority: Number(v) })}
                    items={['1', '2', '3'].map((v) => [v, priorityLabels[Number(v)]])}
                  />
                </div>
                <div className="field">
                  <label htmlFor="task-minutes">Duración estimada (min)</label>
                  <input
                    id="task-minutes"
                    type="number"
                    min={5}
                    max={1440}
                    required
                    value={edit.minutes ?? 30}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setEdit({
                        ...edit,
                        minutes: isNaN(val) ? 30 : Math.min(1440, Math.max(1, val)),
                      });
                    }}
                  />
                </div>
                <div className="field">
                  <label htmlFor="task-plan-date">Día para hacerlo</label>
                  <input
                    id="task-plan-date"
                    type="date"
                    value={edit.planDate ?? ''}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        planDate: e.target.value,
                        top: e.target.value ? edit.top : false,
                        status:
                          edit.status === 'inbox' && e.target.value ? 'todo' : edit.status,
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="task-deadline">Fecha límite real</label>
                  <input
                    id="task-deadline"
                    type="date"
                    value={edit.deadline ?? ''}
                    onChange={(e) => setEdit({ ...edit, deadline: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="task-follow-up">Próximo seguimiento</label>
                  <input
                    id="task-follow-up"
                    type="date"
                    value={edit.followUp ?? ''}
                    onChange={(e) => setEdit({ ...edit, followUp: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="task-project">Proyecto (opcional)</label>
                  <input
                    id="task-project"
                    maxLength={120}
                    value={edit.project ?? ''}
                    placeholder="Ej.: DevOps"
                    onChange={(e) => setEdit({ ...edit, project: e.target.value })}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="task-notes">Notas / próximo paso</label>
                <textarea
                  id="task-notes"
                  rows={3}
                  maxLength={10000}
                  value={edit.notes ?? ''}
                  onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                  placeholder="Qué falta, de quién depende o cómo retomar…"
                />
              </div>

              {/* Desglose Inteligente con IA (Gemini) */}
              <div className="mb-4 p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-900">
                    <Sparkles size={15} className="text-blue-600" />
                    <span>Desglose Inteligente (Gemini AI)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAiBreakdown}
                    disabled={aiBreakdownLoading || !edit.title.trim()}
                    className="inline-flex items-center gap-1.5 text-xs bg-white hover:bg-blue-100 text-blue-700 font-semibold px-3 py-1.5 rounded-lg border border-blue-200 shadow-2xs transition-colors disabled:opacity-50"
                  >
                    {aiBreakdownLoading ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Sparkles size={13} />
                    )}
                    {aiBreakdownLoading ? 'Desglosando...' : 'Desglosar en pasos'}
                  </button>
                </div>

                {aiSubtasks && aiSubtasks.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-blue-200/60">
                    <span className="text-[11px] font-medium text-blue-800">
                      Subtareas sugeridas ({aiSubtasks.reduce((a, b) => a + b.minutes, 0)} min total):
                    </span>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {aiSubtasks.map((st, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-blue-100"
                        >
                          <span className="text-slate-800 font-medium truncate flex-1">
                            {idx + 1}. {st.title}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono shrink-0 ml-2 bg-slate-100 px-1.5 py-0.5 rounded">
                            {st.minutes} min
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={applyAiSubtasks}
                        className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors flex-1"
                      >
                        Insertar como pendientes para hoy
                      </button>
                      <button
                        type="button"
                        onClick={appendSubtasksToNotes}
                        className="text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Copiar a notas
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {edit.top && (
                <p className="form-hint">
                  Está en tu Top 3 del {dayLabel(edit.planDate)}.
                </p>
              )}

              <div className="dialog-actions">
                {tasks.some((t) => t.id === edit.id) && (
                  <button
                    type="button"
                    className="delete-btn"
                    onClick={() => setDeleting(edit)}
                    disabled={busy}
                  >
                    <Trash2 size={17} />
                    Eliminar
                  </button>
                )}
                <button className="primary-btn" type="submit" disabled={busy}>
                  {busy ? 'Guardando…' : 'Guardar pendiente'}
                </button>
              </div>

              {tasks.some((t) => t.id === edit.id) && (
                <p className="last-updated">
                  Última actividad:{' '}
                  {new Intl.DateTimeFormat('es-AR', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'America/Argentina/Buenos_Aires',
                  }).format(new Date(edit.updated))}
                </p>
              )}
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Plan Suggestions Dialog */}
      <Dialog open={planning} onOpenChange={(v) => !busy && setPlanning(v)}>
        <DialogContent className="plan-dialog">
          <DialogHeader>
            <DialogTitle>Armemos un día posible</DialogTitle>
            <DialogDescription>
              Priorizamos vencimientos, tareas en curso y prioridad. Elegí hasta{' '}
              {Math.max(0, 3 - top.length)} más para tu Top 3.
            </DialogDescription>
          </DialogHeader>

          <div className="plan-summary">
            <span>
              {plannedMinutes + addedMinutes} / {budget} min del día
            </span>
            <b>
              {selected.length + top.length} / 3 prioridades
            </b>
          </div>

          {plannedMinutes + addedMinutes > budget && (
            <p className="capacity-warning">
              La selección supera tu tiempo disponible. Quitá tareas o ajustá tu capacidad.
            </p>
          )}

          <div className="candidate-list">
            {candidates.length ? (
              candidates.map((t) => (
                <label key={t.id} className="candidate">
                  <Checkbox
                    checked={selected.includes(t.id)}
                    disabled={
                      !selected.includes(t.id) && selected.length + top.length >= 3
                    }
                    onCheckedChange={(checked) =>
                      setSelected(
                        checked
                          ? [...selected, t.id]
                          : selected.filter((id) => id !== t.id)
                      )
                    }
                  />
                  <span>
                    <b>{t.title}</b>
                    <small>
                      {reason(t, date)} · {t.area} · {t.minutes} min
                    </small>
                  </span>
                </label>
              ))
            ) : (
              <p className="form-hint">
                No hay tareas disponibles para sumar. Agregá un pendiente o revisá las tareas con
                fecha futura.
              </p>
            )}
          </div>

          {candidates.length > 0 && !selected.length && top.length < 3 && (
            <p className="form-hint">
              No hay una sugerencia que entre automáticamente. Podés elegir tareas o ajustar tu
              tiempo disponible.
            </p>
          )}

          <button
            className="primary-btn"
            disabled={
              busy ||
              !selected.length ||
              selected.length + top.length > 3 ||
              plannedMinutes + addedMinutes > budget
            }
            onClick={() => void acceptPlan()}
          >
            {busy ? 'Guardando…' : 'Confirmar mi plan'}
          </button>
          <p className="form-hint">
            Las tareas que no elijas conservan su fecha. Esta propuesta usa reglas claras; no
            utiliza IA.
          </p>
        </DialogContent>
      </Dialog>

      {/* Budget Configuration Dialog */}
      <Dialog open={budgetOpen} onOpenChange={(v) => !busy && setBudgetOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tu tiempo disponible hoy</DialogTitle>
            <DialogDescription>
              Contá el tiempo real que podés dedicar a estos pendientes. Reservá margen para
              descansar y para imprevistos.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await persist({
                  ...ref.current.data,
                  budgets: {
                    ...ref.current.data.budgets,
                    [date]: Number(budgetInput),
                  },
                });
                setBudgetOpen(false);
                toast.success('Tiempo disponible actualizado.');
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          >
            <label className="field">
              Minutos disponibles
              <input
                type="number"
                required
                min={0}
                max={1440}
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
              />
            </label>
            <div className="budget-presets">
              {[30, 60, 120, 180, 240].map((n) => (
                <button
                  type="button"
                  className="outline-btn"
                  key={n}
                  onClick={() => setBudgetInput(String(n))}
                >
                  {n} min
                </button>
              ))}
            </div>
            <button className="primary-btn" disabled={busy}>
              Guardar para hoy
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && !busy && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este pendiente?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará “{deleting?.title}”. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Conservar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white"
              disabled={busy}
              onClick={async (e) => {
                e.preventDefault();
                try {
                  await persist({
                    ...ref.current.data,
                    tasks: ref.current.data.tasks.filter((t) => t.id !== deleting?.id),
                  });
                  setDeleting(null);
                  setEdit(null);
                  toast.success('Pendiente eliminado.');
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Settings Dialog */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSave={saveSettings}
      />

      {/* Focus Mode (Pomodoro) Dialog */}
      <FocusModeDialog
        open={focusOpen}
        onOpenChange={setFocusOpen}
        tasks={tasks}
        initialTaskId={focusTaskId}
        focusMinutes={settings.focusMinutes}
        breakMinutes={settings.breakMinutes}
        soundEnabled={settings.focusSound}
        onCompleteTask={async (t) => {
          await complete(t);
        }}
      />

      <Toaster position="bottom-right" richColors closeButton />
    </SidebarProvider>
  );
}
