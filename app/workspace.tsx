'use client';

import { useEffect, useRef, useState, useMemo, type DragEvent } from 'react';
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
  ChevronUp,
  ChevronsUp,
  ChevronsDown,
  Equal,
  Circle,
  Timer,
  Plug,
  LogOut,
  Settings,
  BarChart3,
  Loader2,
  Globe,
  ListTodo,
  Kanban,
  Bell,
  PanelLeft,
  Grid,
  Zap,
  Filter,
  SlidersHorizontal,
  CheckSquare,
  AlertTriangle,
  ArrowUpDown,
  X,
} from 'lucide-react';
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
  TaskStatus,
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
  taskKey,
  parseChecklist,
  toggleChecklistLine,
} from '@/lib/planner';

type JiraTab = 'summary' | 'list' | 'board' | 'timeline' | 'reports';
type GroupBy = 'none' | 'area' | 'priority' | 'project';
type QuickFilter = 'all' | 'today' | 'top' | 'attention' | 'p3' | 'p2' | 'p1';
type SortField = 'score' | 'key' | 'title' | 'priority' | 'minutes' | 'deadline' | 'status';

const SPACE_COLORS: Record<string, string> = {
  kanban: '#0c66e4',
  Personal: '#0c66e4',
  Trabajo: '#6e5dc6',
  Estudio: '#e2483d',
  Iglesia: '#1f845a',
  Proyectos: '#e56910',
};

const AREA_TAG_STYLES: Record<string, { bg: string; text: string }> = {
  Personal: { bg: '#e9f2ff', text: '#0c66e4' },
  Trabajo: { bg: '#f3f0ff', text: '#5e4db2' },
  Estudio: { bg: '#ffeceb', text: '#ae2e24' },
  Iglesia: { bg: '#dcfff1', text: '#216e4e' },
  Proyectos: { bg: '#fff3d6', text: '#a54800' },
};

const priorityLabels = ['', 'Baja', 'Media', 'Alta'];

type UserInfo = { displayName: string; email: string };

function PriorityIcon({ priority, showLabel = false }: { priority: number; showLabel?: boolean }) {
  if (priority === 3) {
    return (
      <span className="inline-flex items-center gap-1 text-[#c9372c] font-medium text-xs" title="Prioridad Alta">
        <ChevronsUp size={15} className="stroke-[2.5]" />
        {showLabel && <span>Alta</span>}
      </span>
    );
  }
  if (priority === 1) {
    return (
      <span className="inline-flex items-center gap-1 text-[#0c66e4] font-medium text-xs" title="Prioridad Baja">
        <ChevronsDown size={15} className="stroke-[2.5]" />
        {showLabel && <span>Baja</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[#e56910] font-medium text-xs" title="Prioridad Media">
      <Equal size={14} className="stroke-[2.5]" />
      {showLabel && <span>Media</span>}
    </span>
  );
}

function EmptyColumnIllustration() {
  return (
    <svg width="96" height="76" viewBox="0 0 120 94" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-2 opacity-85">
      <rect x="26" y="10" width="68" height="44" rx="6" fill="#E9F2FF" stroke="#85B8FF" strokeWidth="2" />
      <circle cx="40" cy="25" r="4" fill="#0C66E4" />
      <rect x="50" y="22" width="32" height="6" rx="3" fill="#85B8FF" />
      <circle cx="40" cy="39" r="4" fill="#E56910" />
      <rect x="50" y="36" width="24" height="6" rx="3" fill="#B3D4FF" />
      <path d="M18 68C34 56 86 56 102 68" stroke="#DCDFE4" strokeWidth="2" strokeLinecap="round" />
      <circle cx="84" cy="52" r="10" fill="#FFF3D6" stroke="#F5CD47" strokeWidth="2" />
      <path d="M81 52L83.5 54.5L88 49.5" stroke="#974F0C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

export default function Workspace() {
  const [data, setData] = useState<Data>({ tasks: [], budgets: {} });
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [auth, setAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(today);

  // Navigation & Space state
  // space can be: 'kanban' (global space), 'today' (Para ti), 'inbox', 'starred', 'attention', 'week', 'waiting', 'done', or an Area name ('Personal', 'Trabajo', etc.)
  const [space, setSpace] = useState<string>('kanban');
  const [activeTab, setActiveTab] = useState<JiraTab>('board');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [spacesExpanded, setSpacesExpanded] = useState(true);

  // Board / List Filtering & Grouping state
  const [query, setQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [onlyMyDay, setOnlyMyDay] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [showInboxColumn, setShowInboxColumn] = useState(false);
  const [collapsedLanes, setCollapsedLanes] = useState<Record<string, boolean>>({});
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortAsc, setSortAsc] = useState(false);

  // Drag & Drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Inline Quick Create state (per column or list)
  const [inlineCreateCol, setInlineCreateCol] = useState<TaskStatus | null>(null);
  const [inlineCreateTitle, setInlineCreateTitle] = useState('');
  const [listQuickTitle, setListQuickTitle] = useState('');
  const [newSubtaskInput, setNewSubtaskInput] = useState('');

  // Timeline sub-mode ('week' | 'timeboxing')
  const [timelineMode, setTimelineMode] = useState<'week' | 'timeboxing'>('week');

  // Modals & User state
  const [edit, setEdit] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [planning, setPlanning] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState('120');
  const [user, setUser] = useState<UserInfo | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Customization & AI state
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<string | undefined>(undefined);
  const [aiBreakdownLoading, setAiBreakdownLoading] = useState(false);
  const [aiSubtasks, setAiSubtasks] = useState<{ title: string; minutes: number }[] | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
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

    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((res: { settings?: UserSettings } | null) => {
        if (res?.settings) {
          setSettings(res.settings);
        }
      })
      .catch(() => {});

    // On mobile screens start with sidebar collapsed
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setSidebarCollapsed(true);
    }

    const id = setInterval(() => setDate(today()), 30000);
    return () => clearInterval(id);
  }, []);

  // Keyboard shortcuts: '/' focuses global search, 'c' opens Create modal when not typing
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isInput) return;

      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey && !edit) {
        e.preventDefault();
        startTask();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [edit, settings, space]);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch {
      toast.error('Error al cerrar sesión.');
    }
  }

  async function persist(next: Data) {
    setData(next);
    ref.current.data = next;

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

  // WebMCP tool registration
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

  // Core computed collections
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
  const inboxCount = useMemo(
    () => tasks.filter((t) => t.status === 'inbox').length,
    [tasks]
  );
  const needsAttention = useMemo(
    () => tasks.filter((t) => attention(t, date)),
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

  // Tasks scoped to the active Space + QuickFilter + Search Query
  const spaceTasks = useMemo(() => {
    return tasks.filter((t) => {
      // 1. Space scope
      if (areas.includes(space as typeof areas[number])) {
        if (t.area !== space) return false;
      } else if (space === 'today') {
        if (t.planDate !== date && !(t.top && t.planDate === date)) return false;
      } else if (space === 'inbox') {
        if (t.status !== 'inbox') return false;
      } else if (space === 'starred') {
        if (!t.top) return false;
      } else if (space === 'attention') {
        if (!attention(t, date)) return false;
      } else if (space === 'week') {
        const inWeek =
          (t.planDate >= date && t.planDate <= addDays(date, 6)) ||
          (t.deadline >= date && t.deadline <= addDays(date, 6));
        if (!inWeek) return false;
      }

      // 2. Avatar / "Solo mi día" toggle
      if (onlyMyDay && t.planDate !== date && !t.top) {
        return false;
      }

      // 3. QuickFilter dropdown
      if (quickFilter === 'today' && t.planDate !== date) return false;
      if (quickFilter === 'top' && !t.top) return false;
      if (quickFilter === 'attention' && !attention(t, date)) return false;
      if (quickFilter === 'p3' && t.priority !== 3) return false;
      if (quickFilter === 'p2' && t.priority !== 2) return false;
      if (quickFilter === 'p1' && t.priority !== 1) return false;

      // 4. Search query (matches title, project, notes, area, or Jira issue key like TRA-104)
      if (query.trim()) {
        const q = query.toLowerCase().trim();
        const key = taskKey(t).toLowerCase();
        const matches =
          key.includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.project.toLowerCase().includes(q) ||
          t.notes.toLowerCase().includes(q) ||
          t.area.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [tasks, space, onlyMyDay, quickFilter, query, date]);

  // Sorted tasks for List and Board
  const sortedTasks = useMemo(() => {
    const list = [...spaceTasks];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'score') {
        cmp = score(b, date) - score(a, date);
      } else if (sortField === 'key') {
        cmp = taskKey(a).localeCompare(taskKey(b));
      } else if (sortField === 'title') {
        cmp = a.title.localeCompare(b.title);
      } else if (sortField === 'priority') {
        cmp = b.priority - a.priority;
      } else if (sortField === 'minutes') {
        cmp = b.minutes - a.minutes;
      } else if (sortField === 'deadline') {
        const da = a.deadline || a.planDate || '9999-99-99';
        const db = b.deadline || b.planDate || '9999-99-99';
        cmp = da.localeCompare(db);
      } else if (sortField === 'status') {
        cmp = a.status.localeCompare(b.status);
      }
      return sortAsc ? -cmp : cmp;
    });
    return list;
  }, [spaceTasks, sortField, sortAsc, date]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  }

  function openPlanner() {
    setSelected(recommended.map((t) => t.id));
    setPlanning(true);
  }

  function startTask(preset?: Partial<Task>) {
    const t = newTask();
    const defaultArea = areas.includes(space as typeof areas[number])
      ? space
      : settings.defaultArea || t.area;
    setEdit({
      ...t,
      area: defaultArea,
      minutes: settings.defaultMinutes || t.minutes,
      priority: settings.defaultPriority || t.priority,
      status: space === 'inbox' ? 'inbox' : 'todo',
      ...(space === 'today' ? { planDate: date } : {}),
      ...preset,
    });
    setAiSubtasks(null);
  }

  async function handleInlineColumnCreate(status: TaskStatus) {
    if (!inlineCreateTitle.trim()) {
      setInlineCreateCol(null);
      return;
    }
    try {
      const base = newTask(inlineCreateTitle.trim());
      const defaultArea = areas.includes(space as typeof areas[number])
        ? space
        : settings.defaultArea || base.area;
      await saveTask({
        ...base,
        area: defaultArea,
        status,
        minutes: settings.defaultMinutes || 30,
        priority: settings.defaultPriority || 2,
        planDate: space === 'today' || onlyMyDay ? date : '',
        completed: status === 'done' ? new Date().toISOString() : '',
      });
      setInlineCreateTitle('');
      setInlineCreateCol(null);
      toast.success(`Creada en ${states[status]}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleListQuickCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!listQuickTitle.trim()) return;
    try {
      const base = newTask(listQuickTitle.trim());
      const defaultArea = areas.includes(space as typeof areas[number])
        ? space
        : settings.defaultArea || base.area;
      await saveTask({
        ...base,
        area: defaultArea,
        status: space === 'inbox' ? 'inbox' : 'todo',
        minutes: settings.defaultMinutes || 30,
        priority: settings.defaultPriority || 2,
        planDate: space === 'today' || onlyMyDay ? date : '',
      });
      setListQuickTitle('');
      toast.success('Tarea agregada a la lista.');
    } catch (err) {
      toast.error((err as Error).message);
    }
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
      ...newTask(st.title),
      area: edit.area,
      status: 'todo',
      priority: edit.priority,
      minutes: st.minutes || 20,
      planDate: date,
      deadline: edit.deadline || '',
      project: edit.project || edit.title,
      notes: `Subtarea de: ${edit.title}`,
    }));

    const current = ref.current.data;
    await persist({
      ...current,
      tasks: [...newItems, ...current.tasks],
    });
    setAiSubtasks(null);
    toast.success(`Se crearon ${newItems.length} subtareas en el tablero.`);
  }

  function appendSubtasksToNotes() {
    if (!edit || !aiSubtasks) return;
    const text = aiSubtasks.map((s) => `- [ ] ${s.title} (${s.minutes} min)`).join('\n');
    setEdit({
      ...edit,
      notes: edit.notes ? `${edit.notes}\n\n${text}` : text,
    });
    setAiSubtasks(null);
    toast.success('Subtareas agregadas al checklist.');
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
    if (top.length >= 3 && !(t.top && t.planDate === date)) {
      toast.error('Tu Top 3 de hoy ya tiene 3 prioridades. Quitá una para hacer lugar.');
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
      toast.success('Tu Top 3 de hoy está listo.');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  // Drag & Drop handlers for Kanban columns
  function handleDragStart(e: DragEvent<HTMLElement>, task: Task) {
    setDraggedTaskId(task.id);
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd() {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  }

  function handleColumnDragOver(e: DragEvent<HTMLElement>, colKey: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== colKey) {
      setDragOverColumn(colKey);
    }
  }

  async function handleColumnDrop(
    e: DragEvent<HTMLElement>,
    targetStatus: TaskStatus,
    laneOverrides?: Partial<Task>
  ) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDraggedTaskId(null);
    setDragOverColumn(null);
    if (!id) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const updates: Partial<Task> = {
      status: targetStatus,
      completed:
        targetStatus === 'done'
          ? task.completed || new Date().toISOString()
          : '',
      ...(targetStatus === 'waiting' ? { top: false } : {}),
      ...laneOverrides,
    };

    await patch(task, updates);
  }

  // Space display metadata
  const spaceTitleMap: Record<string, string> = {
    kanban: 'Mi espacio de Kanban',
    today: 'Para ti · Mi Día',
    inbox: 'Bandeja de entrada (Backlog)',
    starred: 'Marcados como favoritos (Top 3)',
    attention: 'Necesita atención',
    week: 'Plan de próximos 7 días',
    Personal: 'Espacio Personal',
    Trabajo: 'Espacio Trabajo',
    Estudio: 'Espacio Estudio',
    Iglesia: 'Espacio Iglesia',
    Proyectos: 'Espacio Proyectos',
  };

  const currentSpaceTitle = spaceTitleMap[space] || space;
  const currentSpaceColor = SPACE_COLORS[space] || '#0c66e4';
  const displayName = user?.displayName || 'Usuario';
  const userInitial = displayName.charAt(0).toUpperCase();

  // Kanban columns configuration
  const boardColumns: { status: TaskStatus; label: string }[] = useMemo(() => {
    const cols: { status: TaskStatus; label: string }[] = [];
    if (showInboxColumn || space === 'inbox') {
      cols.push({ status: 'inbox', label: 'BANDEJA / BACKLOG' });
    }
    cols.push(
      { status: 'todo', label: 'POR HACER' },
      { status: 'doing', label: 'EN CURSO' },
      { status: 'waiting', label: 'EN REVISIÓN' },
      { status: 'done', label: 'COMPLETADO' }
    );
    return cols;
  }, [showInboxColumn, space]);

  // Swimlane groups computation
  const swimlanes = useMemo(() => {
    if (groupBy === 'none') {
      return [
        {
          id: 'all',
          title: 'Todas las tareas',
          tasks: sortedTasks,
          overrides: {} as Partial<Task>,
        },
      ];
    }
    if (groupBy === 'area') {
      return areas.map((a) => ({
        id: `area-${a}`,
        title: a,
        tasks: sortedTasks.filter((t) => t.area === a),
        overrides: { area: a } as Partial<Task>,
      }));
    }
    if (groupBy === 'priority') {
      return [
        {
          id: 'prio-3',
          title: 'Prioridad Alta',
          tasks: sortedTasks.filter((t) => t.priority === 3),
          overrides: { priority: 3 } as Partial<Task>,
        },
        {
          id: 'prio-2',
          title: 'Prioridad Media',
          tasks: sortedTasks.filter((t) => t.priority === 2),
          overrides: { priority: 2 } as Partial<Task>,
        },
        {
          id: 'prio-1',
          title: 'Prioridad Baja',
          tasks: sortedTasks.filter((t) => t.priority === 1),
          overrides: { priority: 1 } as Partial<Task>,
        },
      ];
    }
    // groupBy === 'project'
    const projectSet = new Set<string>();
    sortedTasks.forEach((t) => {
      if (t.project.trim()) projectSet.add(t.project.trim());
    });
    const lanes = Array.from(projectSet)
      .sort()
      .map((proj) => ({
        id: `proj-${proj}`,
        title: `📁 ${proj}`,
        tasks: sortedTasks.filter((t) => t.project.trim() === proj),
        overrides: { project: proj } as Partial<Task>,
      }));
    lanes.push({
      id: 'proj-none',
      title: 'Sin proyecto asignado',
      tasks: sortedTasks.filter((t) => !t.project.trim()),
      overrides: { project: '' } as Partial<Task>,
    });
    return lanes;
  }, [groupBy, sortedTasks]);

  // Render an individual Jira Kanban Card
  function renderJiraCard(t: Task) {
    const key = taskKey(t);
    const isOverdue = Boolean(t.deadline && t.deadline < date && t.status !== 'done');
    const isToday = t.planDate === date;
    const isTopToday = t.top && t.planDate === date;
    const checklist = parseChecklist(t.notes);
    const areaStyle = AREA_TAG_STYLES[t.area] || { bg: '#f1f2f4', text: '#44546f' };

    return (
      <article
        key={t.id}
        draggable
        onDragStart={(e) => handleDragStart(e, t)}
        onDragEnd={handleDragEnd}
        className={`jira-card group ${t.status === 'done' ? 'is-done' : ''} ${
          isTopToday ? 'is-top' : ''
        } ${draggedTaskId === t.id ? 'opacity-40 scale-[0.98]' : ''}`}
      >
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setEdit({ ...t });
              setAiSubtasks(null);
            }}
            className="jira-card-title flex-1"
          >
            {t.title}
          </button>

          <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 shrink-0">
            {t.status !== 'done' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFocusTaskId(t.id);
                  setFocusOpen(true);
                }}
                title="Iniciar Pomodoro"
                className="p-1 rounded hover:bg-slate-200/70 text-slate-500 hover:text-blue-600 transition-colors"
              >
                <Timer size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleTop(t);
              }}
              title={isTopToday ? 'Quitar de Favoritos / Top 3' : 'Marcar como Favorito (Top 3)'}
              className={`p-1 rounded hover:bg-slate-200/70 transition-colors ${
                isTopToday ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'
              }`}
            >
              <Star size={13} fill={isTopToday ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        {/* Tags & Badges Row */}
        <div className="jira-card-tags">
          <span
            className="jira-tag"
            style={{ backgroundColor: areaStyle.bg, color: areaStyle.text }}
          >
            {t.area}
          </span>

          {t.project && (
            <span className="jira-tag bg-slate-100 text-slate-700">
              {t.project}
            </span>
          )}

          {isOverdue && (
            <span className="jira-tag bg-[#ffeceb] text-[#ae2e24]">
              <AlertTriangle size={11} />
              Venció {dayLabel(t.deadline)}
            </span>
          )}

          {!isOverdue && t.deadline && (
            <span className="jira-tag bg-slate-100 text-slate-600">
              📅 {dayLabel(t.deadline)}
            </span>
          )}

          {isToday && t.status !== 'done' && (
            <span className="jira-tag bg-[#e9f2ff] text-[#0c66e4]">
              Hoy
            </span>
          )}

          {checklist.total > 0 && (
            <span
              className={`jira-tag ${
                checklist.done === checklist.total
                  ? 'bg-[#dcfff1] text-[#216e4e]'
                  : 'bg-slate-100 text-slate-600'
              }`}
              title="Subtareas / Checklist"
            >
              <CheckSquare size={11} />
              {checklist.done}/{checklist.total}
            </span>
          )}
        </div>

        {/* Jira Card Footer: Issue Key left, Estimate + Priority + Avatar right */}
        <div className="jira-card-footer">
          <button
            type="button"
            onClick={() => complete(t)}
            className="jira-issue-key hover:underline"
            title={t.status === 'done' ? 'Reabrir tarea' : 'Completar tarea'}
          >
            <span
              className="jira-type-checkbox"
              style={{
                background: t.status === 'done' ? '#1f845a' : '#4bade8',
              }}
            >
              <Check size={11} className="stroke-[3]" />
            </span>
            <span>{key}</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
              {t.minutes}m
            </span>
            <PriorityIcon priority={t.priority} />
            <span
              className="w-5 h-5 rounded-full bg-[#0c66e4] text-white text-[10px] font-bold grid place-items-center"
              title={`Asignado a ${displayName}`}
            >
              {userInitial}
            </span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="jira-shell">
      {/* ====================================================================
          1. JIRA CLOUD GLOBAL TOP NAVIGATION BAR
         ==================================================================== */}
      <header className="jira-topnav">
        <div className="jira-topnav-left">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="jira-icon-btn"
            title={sidebarCollapsed ? 'Mostrar barra lateral' : 'Ocultar barra lateral'}
            aria-label="Alternar barra lateral"
          >
            <PanelLeft size={18} />
          </button>

          <button
            type="button"
            onClick={() => {
              setSpace('kanban');
              setActiveTab('board');
            }}
            className="jira-icon-btn hidden sm:inline-flex"
            title="Cambiar vista a Tablero global"
          >
            <Grid size={18} />
          </button>

          <button
            type="button"
            onClick={() => {
              setSpace('kanban');
              setActiveTab('board');
            }}
            className="jira-brand"
          >
            <span className="jira-brand-logo">
              <Kanban size={15} />
            </span>
            <span>Enfoco</span>
          </button>
        </div>

        {/* Center Search + Primary "+ Crear" Button */}
        <div className="jira-topnav-center">
          <div className="jira-global-search">
            <Search size={15} className="text-slate-500 shrink-0" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar tablero, clave (ej. TRA-104) o proyecto… ( / )"
              aria-label="Buscar tareas"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-slate-400 hover:text-slate-700"
                title="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => startTask()}
            disabled={loading || auth}
            className="jira-create-btn"
            title="Crear nuevo pendiente (Atajo: C)"
          >
            <Plus size={16} className="stroke-[2.5]" />
            <span>Crear</span>
          </button>
        </div>

        {/* Right Actions */}
        <div className="jira-topnav-right">
          <button
            type="button"
            onClick={() => {
              const nextTask =
                top.find((t) => t.status !== 'done') ||
                tasks.find((t) => t.status === 'doing') ||
                tasks.find((t) => t.status !== 'done');
              setFocusTaskId(nextTask?.id);
              setFocusOpen(true);
            }}
            className="jira-btn-subtle hidden md:inline-flex"
            title="Abrir Temporizador Pomodoro (Modo Enfoque)"
          >
            <Timer size={15} className="text-[#0c66e4]" />
            <span>Enfoque</span>
          </button>

          <button
            type="button"
            onClick={openPlanner}
            className="jira-icon-btn"
            title="Auto-planificar Top 3 del día"
            aria-label="Proponer mi día"
          >
            <Zap size={17} />
          </button>

          <button
            type="button"
            onClick={() => {
              setSpace('attention');
              setActiveTab('list');
            }}
            className={`jira-icon-btn ${space === 'attention' ? 'is-active' : ''}`}
            title="Pendientes que requieren atención (vencidos o seguimientos)"
            aria-label="Notificaciones de atención"
          >
            <Bell size={17} />
            {needsAttention.length > 0 && (
              <span className="jira-badge-dot">{needsAttention.length}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => void reload()}
            disabled={busy || loading}
            className="jira-icon-btn"
            title="Sincronizar ahora"
            aria-label="Actualizar pendientes"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="jira-icon-btn"
            title="Ajustes y Notificaciones"
            aria-label="Ajustes y Personalización"
          >
            <Settings size={17} />
          </button>

          {/* User Avatar & Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-8 h-8 rounded-full bg-[#0c66e4] text-white font-bold text-xs grid place-items-center hover:ring-2 hover:ring-blue-200 transition-all ml-1"
              title={`${displayName} (${user?.email || 'Sesión activa'})`}
            >
              {userInitial}
            </button>

            {userMenuOpen && (
              <div
                className="fixed inset-0 z-50"
                onClick={() => setUserMenuOpen(false)}
              >
                <div
                  className="absolute right-4 top-13 w-64 bg-white rounded-lg shadow-xl border border-slate-200 p-3 z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <span className="w-9 h-9 rounded-full bg-[#0c66e4] text-white font-bold text-sm grid place-items-center">
                      {userInitial}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {displayName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {user?.email || 'Espacio personal'}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setSettingsOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md"
                    >
                      <Settings size={14} /> Ajustes de cuenta y bot
                    </button>
                    <Link
                      href="/integrations"
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md"
                    >
                      <Plug size={14} /> API Keys e Integraciones
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md"
                    >
                      <LogOut size={14} /> Cerrar sesión
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ====================================================================
          2. BODY: LEFT SIDEBAR + MAIN JIRA WORKSPACE
         ==================================================================== */}
      <div className="jira-body">
        {/* Left Sidebar */}
        <aside className={`jira-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
          {/* Quick Personal Views */}
          <div className="jira-nav-section">
            <button
              type="button"
              onClick={() => {
                setSpace('today');
                setQuickFilter('all');
              }}
              className={`jira-nav-item ${space === 'today' ? 'is-active' : ''}`}
            >
              <Sun size={16} className="text-amber-500 shrink-0" />
              <span>Para ti (Mi día)</span>
              {dayTasks.length > 0 && (
                <span className="jira-nav-count">{dayTasks.length}</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setSpace('inbox');
                setQuickFilter('all');
              }}
              className={`jira-nav-item ${space === 'inbox' ? 'is-active' : ''}`}
            >
              <Inbox size={16} className="text-blue-600 shrink-0" />
              <span>Bandeja de entrada</span>
              {inboxCount > 0 && (
                <span className="jira-nav-count">{inboxCount}</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setSpace('starred');
                setQuickFilter('all');
              }}
              className={`jira-nav-item ${space === 'starred' ? 'is-active' : ''}`}
            >
              <Star size={16} className="text-amber-500 shrink-0" />
              <span>Favoritos (Top 3)</span>
              {top.length > 0 && (
                <span className="jira-nav-count">{top.length}/3</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setSpace('attention');
                setQuickFilter('all');
              }}
              className={`jira-nav-item ${space === 'attention' ? 'is-active' : ''}`}
            >
              <Flag size={16} className="text-red-600 shrink-0" />
              <span>Necesita atención</span>
              {needsAttention.length > 0 && (
                <span className="jira-nav-count bg-red-100 text-red-700">
                  {needsAttention.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setSpace('week');
                setActiveTab('timeline');
                setQuickFilter('all');
              }}
              className={`jira-nav-item ${space === 'week' ? 'is-active' : ''}`}
            >
              <CalendarDays size={16} className="text-emerald-600 shrink-0" />
              <span>Planes (7 días)</span>
            </button>
          </div>

          {/* Spaces Section (Jira Spaces / Areas) */}
          <div className="jira-nav-section">
            <div className="jira-nav-header">
              <button
                type="button"
                onClick={() => setSpacesExpanded(!spacesExpanded)}
                className="flex items-center gap-1 text-[11px] font-bold text-[#626f86] hover:text-[#172b4d] bg-transparent border-0 p-0"
              >
                {spacesExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <span>ESPACIOS</span>
              </button>
              <button
                type="button"
                onClick={() => startTask()}
                className="text-slate-500 hover:text-slate-800 p-0.5 rounded"
                title="Crear pendiente en espacio"
              >
                <Plus size={13} />
              </button>
            </div>

            {spacesExpanded && (
              <div className="space-y-0.5 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSpace('kanban');
                    setQuickFilter('all');
                  }}
                  className={`jira-nav-item ${space === 'kanban' ? 'is-active' : ''}`}
                >
                  <span
                    className="jira-space-avatar"
                    style={{ background: SPACE_COLORS.kanban }}
                  >
                    K
                  </span>
                  <span className="truncate">Mi espacio de Kanban</span>
                  <span className="jira-nav-count">
                    {tasks.filter((t) => t.status !== 'done').length}
                  </span>
                </button>

                {areas.map((areaName) => {
                  const count = tasks.filter(
                    (t) => t.area === areaName && t.status !== 'done'
                  ).length;
                  return (
                    <button
                      key={areaName}
                      type="button"
                      onClick={() => {
                        setSpace(areaName);
                        setQuickFilter('all');
                      }}
                      className={`jira-nav-item ${space === areaName ? 'is-active' : ''}`}
                    >
                      <span
                        className="jira-space-avatar"
                        style={{ background: SPACE_COLORS[areaName] || '#44546f' }}
                      >
                        {areaName.charAt(0)}
                      </span>
                      <span className="truncate">{areaName}</span>
                      {count > 0 && <span className="jira-nav-count">{count}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Daily Capacity Mini-Widget inside Sidebar */}
          <div className="mx-2 my-2 p-3 rounded-lg bg-white border border-[#dcdfe4] shadow-2xs">
            <div className="flex items-center justify-between text-xs font-semibold text-[#172b4d] mb-1">
              <span className="flex items-center gap-1.5">
                <Clock size={13} className="text-[#0c66e4]" />
                Capacidad hoy
              </span>
              <button
                type="button"
                onClick={() => {
                  setBudgetInput(String(budget));
                  setBudgetOpen(true);
                }}
                className="text-[11px] text-[#0c66e4] hover:underline font-semibold"
              >
                {plannedMinutes}/{budget}m
              </button>
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
              className="h-1.5"
            />
            <div className="flex items-center justify-between text-[11px] text-[#626f86] mt-1.5">
              <span>{doneMinutes}m completados</span>
              <span>Top {top.length}/3</span>
            </div>
          </div>

          {/* Sidebar Footer Links */}
          <div className="mt-auto pt-3 border-t border-[#dcdfe4] space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('reports');
              }}
              className={`jira-nav-item ${activeTab === 'reports' ? 'is-active' : ''}`}
            >
              <BarChart3 size={16} className="text-slate-600 shrink-0" />
              <span>Paneles e Informes</span>
            </button>

            <Link href="/integrations" className="jira-nav-item">
              <Plug size={16} className="text-slate-600 shrink-0" />
              <span>Integraciones y Bot</span>
            </Link>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="jira-nav-item"
            >
              <Settings size={16} className="text-slate-600 shrink-0" />
              <span>Configurar espacio</span>
            </button>
          </div>
        </aside>

        {/* ==================================================================
            3. MAIN WORKSPACE AREA
           ================================================================== */}
        <main className="jira-main">
          {/* Space Header + Horizontal View Tabs */}
          <div className="jira-space-header">
            <div className="jira-space-top">
              <div className="jira-space-title-group">
                <div className="jira-breadcrumbs">
                  <span>Espacios</span>
                  <ChevronRight size={12} />
                  <span>{currentSpaceTitle}</span>
                </div>
                <div className="jira-space-title">
                  <span
                    className="w-6 h-6 rounded-md text-white text-xs font-bold grid place-items-center shrink-0"
                    style={{ background: currentSpaceColor }}
                  >
                    {currentSpaceTitle.charAt(0)}
                  </span>
                  <h1 className="text-lg sm:text-xl font-semibold text-[#172b4d] truncate">
                    {currentSpaceTitle}
                  </h1>
                </div>
              </div>

              <div className="jira-space-actions">
                <button
                  type="button"
                  onClick={openPlanner}
                  className="jira-btn-subtle"
                  title="Sugerir Top 3 según prioridad y capacidad"
                >
                  <Sparkles size={14} className="text-[#0c66e4]" />
                  <span>Proponer mi día</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBudgetInput(String(budget));
                    setBudgetOpen(true);
                  }}
                  className="jira-btn-subtle"
                  title="Ajustar presupuesto de minutos de hoy"
                >
                  <Clock size={14} />
                  <span>
                    {plannedMinutes} / {budget} min
                  </span>
                </button>
              </div>
            </div>

            {/* 5 Jira View Switcher Tabs */}
            <nav className="jira-tabs" aria-label="Vistas del espacio">
              <button
                type="button"
                onClick={() => setActiveTab('summary')}
                className={`jira-tab ${activeTab === 'summary' ? 'is-active' : ''}`}
              >
                <Globe size={15} />
                <span>Resumen</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className={`jira-tab ${activeTab === 'list' ? 'is-active' : ''}`}
              >
                <ListTodo size={15} />
                <span>Lista</span>
                <span className="text-xs px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-full">
                  {spaceTasks.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('board')}
                className={`jira-tab ${activeTab === 'board' ? 'is-active' : ''}`}
              >
                <Kanban size={15} />
                <span>Tablero</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`jira-tab ${activeTab === 'timeline' ? 'is-active' : ''}`}
              >
                <CalendarDays size={15} />
                <span>Cronograma</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('reports')}
                className={`jira-tab ${activeTab === 'reports' ? 'is-active' : ''}`}
              >
                <BarChart3 size={15} />
                <span>Informes</span>
              </button>
            </nav>
          </div>

          {/* Board / List Sub-Toolbar (matches Jira screenshot: Search board, Avatar, Filter, Group by) */}
          {(activeTab === 'board' || activeTab === 'list') && (
            <div className="jira-subtoolbar">
              <div className="jira-subtoolbar-left">
                <label className="jira-board-search">
                  <Search size={14} className="shrink-0" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar tablero"
                    aria-label="Buscar en el tablero"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setOnlyMyDay(!onlyMyDay)}
                  className={`jira-avatar-filter ${onlyMyDay ? 'is-active' : ''}`}
                  title={
                    onlyMyDay
                      ? 'Mostrando solo tareas de hoy (clic para ver todas)'
                      : 'Filtrar mis tareas planificadas para hoy'
                  }
                >
                  {userInitial}
                </button>

                {/* Filter Selector */}
                <div className="inline-flex items-center gap-1.5">
                  <Filter size={14} className="text-[#44546f] ml-1" />
                  <select
                    aria-label="Filtrar tareas"
                    value={quickFilter}
                    onChange={(e) => setQuickFilter(e.target.value as QuickFilter)}
                    className="jira-btn-subtle pr-6 cursor-pointer"
                  >
                    <option value="all">Filtro: Todos</option>
                    <option value="today">📅 Planificados para hoy</option>
                    <option value="top">⭐ Favoritos (Top 3)</option>
                    <option value="attention">⚠️ Requiere atención / Vencidos</option>
                    <option value="p3">⏫ Prioridad Alta</option>
                    <option value="p2">🟰 Prioridad Media</option>
                    <option value="p1">⏬ Prioridad Baja</option>
                  </select>
                </div>

                {(onlyMyDay || quickFilter !== 'all' || query) && (
                  <button
                    type="button"
                    onClick={() => {
                      setOnlyMyDay(false);
                      setQuickFilter('all');
                      setQuery('');
                    }}
                    className="text-xs text-[#0c66e4] hover:underline font-medium px-1.5"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>

              <div className="jira-subtoolbar-right">
                {activeTab === 'board' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowInboxColumn(!showInboxColumn)}
                      className={`jira-btn-subtle ${showInboxColumn ? 'is-active' : ''}`}
                      title="Mostrar u ocultar columna Bandeja de entrada en el tablero Kanban"
                    >
                      <Inbox size={14} />
                      <span>Bandeja ({inboxCount})</span>
                    </button>

                    <div className="inline-flex items-center gap-1.5">
                      <span className="text-xs text-[#626f86] hidden sm:inline">Agrupar:</span>
                      <select
                        aria-label="Agrupar tablero por"
                        value={groupBy}
                        onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                        className="jira-btn-subtle cursor-pointer"
                      >
                        <option value="none">Grupo: Ninguno</option>
                        <option value="area">Grupo: Área</option>
                        <option value="priority">Grupo: Prioridad</option>
                        <option value="project">Grupo: Proyecto</option>
                      </select>
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="jira-icon-btn"
                  title="Preferencias de vista"
                >
                  <SlidersHorizontal size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mx-6 mt-2 error-banner" role="alert">
              <span>{error}</span>
              {auth ? (
                <Link href="/login" className="underline font-semibold ml-2">
                  Iniciar sesión
                </Link>
              ) : (
                <button onClick={() => void reload()} disabled={busy}>
                  Reintentar
                </button>
              )}
            </div>
          )}

          {/* ================================================================
              4. SCROLLABLE CANVAS FOR ACTIVE VIEW
             ================================================================ */}
          <div className="jira-canvas">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2" aria-label="Cargando tablero">
                <Skeleton className="h-80 rounded-lg" />
                <Skeleton className="h-80 rounded-lg" />
                <Skeleton className="h-80 rounded-lg" />
                <Skeleton className="h-80 rounded-lg" />
              </div>
            ) : activeTab === 'board' ? (
              /* ==============================================================
                 TAB 3: TABLERO KANBAN (WITH DRAG & DROP + SWIMLANES)
                 ============================================================== */
              <div className="space-y-6">
                {/* Top 3 Banner when inside "Para ti (Mi día)" or "Favoritos" */}
                {(space === 'today' || space === 'starred') && (
                  <div className="bg-[#f7f8f9] border border-[#dcdfe4] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Star size={16} className="text-amber-500 fill-amber-500" />
                        <h2 className="text-sm font-bold text-[#172b4d]">
                          Tus 3 Prioridades del Día ({top.length}/3)
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={openPlanner}
                        className="text-xs font-semibold text-[#0c66e4] hover:underline flex items-center gap-1"
                      >
                        <Sparkles size={13} /> Elegir automáticamente
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[0, 1, 2].map((i) => {
                        const t = top[i];
                        return t ? (
                          <div key={t.id}>{renderJiraCard(t)}</div>
                        ) : (
                          <button
                            key={i}
                            type="button"
                            onClick={() =>
                              tasks.some((x) => x.status !== 'done')
                                ? openPlanner()
                                : startTask({ top: true, planDate: date, status: 'todo' })
                            }
                            className="border border-dashed border-[#b3b9c4] rounded-md p-4 flex flex-col items-center justify-center text-center hover:bg-white transition-colors min-h-[96px]"
                          >
                            <Plus size={18} className="text-[#626f86] mb-1" />
                            <span className="text-xs font-semibold text-[#44546f]">
                              Prioridad 0{i + 1} disponible
                            </span>
                            <span className="text-[11px] text-[#626f86]">
                              Clic para asignar foco de hoy
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {swimlanes.map((lane) => {
                  const isCollapsed = Boolean(collapsedLanes[lane.id]);
                  return (
                    <div key={lane.id} className="space-y-2">
                      {groupBy !== 'none' && (
                        <button
                          type="button"
                          onClick={() =>
                            setCollapsedLanes({
                              ...collapsedLanes,
                              [lane.id]: !isCollapsed,
                            })
                          }
                          className="flex items-center gap-2 w-full py-1.5 px-2 rounded bg-[#f1f2f4] hover:bg-[#dcdfe4]/60 text-xs font-bold text-[#172b4d] uppercase tracking-wider"
                        >
                          {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                          <span>{lane.title}</span>
                          <span className="px-2 py-0.5 rounded-full bg-white text-[#44546f] text-[11px]">
                            {lane.tasks.length}
                          </span>
                        </button>
                      )}

                      {!isCollapsed && (
                        <div className="jira-board">
                          {boardColumns.map((col) => {
                            const colTasks = lane.tasks.filter((t) => t.status === col.status);
                            const colMinutes = colTasks.reduce((s, t) => s + t.minutes, 0);
                            const dropKey = `${lane.id}-${col.status}`;
                            const isWipExceeded =
                              col.status === 'doing' && colTasks.length > 3;

                            return (
                              <section
                                key={col.status}
                                onDragOver={(e) => handleColumnDragOver(e, dropKey)}
                                onDragLeave={() => setDragOverColumn(null)}
                                onDrop={(e) =>
                                  void handleColumnDrop(e, col.status, lane.overrides)
                                }
                                className={`jira-column ${
                                  dragOverColumn === dropKey ? 'is-drag-over' : ''
                                } ${isWipExceeded ? 'ring-1 ring-amber-400' : ''}`}
                              >
                                <header className="jira-column-header">
                                  <div className="flex items-center min-w-0">
                                    <span className="truncate">{col.label}</span>
                                    <span className="jira-column-count">{colTasks.length}</span>
                                    {isWipExceeded && (
                                      <span
                                        className="ml-1.5 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold"
                                        title="Límite WIP sugerido: máx 3 tareas en curso al mismo tiempo"
                                      >
                                        WIP!
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {colMinutes > 0 && (
                                      <span className="text-[11px] font-normal text-[#626f86] lowercase">
                                        {colMinutes}m
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setInlineCreateCol(col.status);
                                        setInlineCreateTitle('');
                                      }}
                                      className="p-1 rounded hover:bg-slate-200/70 text-[#44546f]"
                                      title={`Crear en ${col.label}`}
                                    >
                                      <Plus size={14} />
                                    </button>
                                  </div>
                                </header>

                                <div className="jira-column-body">
                                  {colTasks.length > 0 ? (
                                    colTasks.map(renderJiraCard)
                                  ) : (
                                    <div className="flex flex-col items-center justify-center text-center py-8 px-4 my-auto select-none">
                                      {col.status === 'todo' && groupBy === 'none' && (
                                        <EmptyColumnIllustration />
                                      )}
                                      <p className="text-xs font-semibold text-[#44546f]">
                                        {col.status === 'todo'
                                          ? 'Empieza ahora mismo'
                                          : `Sin tareas en ${col.label.toLowerCase()}`}
                                      </p>
                                      <p className="text-[11px] text-[#626f86] mt-0.5">
                                        Arrastrá una tarjeta acá o creá una nueva.
                                      </p>
                                    </div>
                                  )}

                                  {/* Inline Column Quick Create Card */}
                                  {inlineCreateCol === col.status && groupBy === 'none' ? (
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        void handleInlineColumnCreate(col.status);
                                      }}
                                      className="bg-white rounded-md p-2.5 shadow-md border-2 border-[#0c66e4] space-y-2"
                                    >
                                      <textarea
                                        autoFocus
                                        rows={2}
                                        value={inlineCreateTitle}
                                        onChange={(e) => setInlineCreateTitle(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            void handleInlineColumnCreate(col.status);
                                          } else if (e.key === 'Escape') {
                                            setInlineCreateCol(null);
                                          }
                                        }}
                                        placeholder="¿Qué se debe hacer?"
                                        className="w-full text-sm text-[#172b4d] border-0 outline-none resize-none"
                                      />
                                      <div className="flex items-center justify-between pt-1">
                                        <span className="text-[11px] text-[#626f86]">
                                          Enter para guardar
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => setInlineCreateCol(null)}
                                            className="px-2 py-1 text-xs text-[#44546f] hover:bg-slate-100 rounded"
                                          >
                                            Cancelar
                                          </button>
                                          <button
                                            type="submit"
                                            className="px-2.5 py-1 text-xs font-semibold bg-[#0c66e4] text-white rounded hover:bg-[#0055cc]"
                                          >
                                            Crear
                                          </button>
                                        </div>
                                      </div>
                                    </form>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (groupBy === 'none') {
                                          setInlineCreateCol(col.status);
                                          setInlineCreateTitle('');
                                        } else {
                                          startTask({
                                            status: col.status,
                                            ...lane.overrides,
                                          });
                                        }
                                      }}
                                      className="jira-column-create-btn mt-auto"
                                    >
                                      <Plus size={15} />
                                      <span>Crear</span>
                                    </button>
                                  )}
                                </div>
                              </section>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : activeTab === 'list' ? (
              /* ==============================================================
                 TAB 2: VISTA LISTA (JIRA WORK MANAGEMENT SPREADSHEET)
                 ============================================================== */
              <div className="space-y-3">
                <div className="jira-table-wrap">
                  <table className="jira-table">
                    <thead>
                      <tr>
                        <th className="w-9 text-center">✓</th>
                        <th>
                          <button
                            type="button"
                            onClick={() => toggleSort('key')}
                            className="inline-flex items-center gap-1 font-bold text-[#626f86] hover:text-[#172b4d]"
                          >
                            <span>Clave</span>
                            <ArrowUpDown size={12} />
                          </button>
                        </th>
                        <th>
                          <button
                            type="button"
                            onClick={() => toggleSort('title')}
                            className="inline-flex items-center gap-1 font-bold text-[#626f86] hover:text-[#172b4d]"
                          >
                            <span>Resumen</span>
                            <ArrowUpDown size={12} />
                          </button>
                        </th>
                        <th>
                          <button
                            type="button"
                            onClick={() => toggleSort('status')}
                            className="inline-flex items-center gap-1 font-bold text-[#626f86] hover:text-[#172b4d]"
                          >
                            <span>Estado</span>
                            <ArrowUpDown size={12} />
                          </button>
                        </th>
                        <th>Área / Espacio</th>
                        <th>Proyecto</th>
                        <th>
                          <button
                            type="button"
                            onClick={() => toggleSort('priority')}
                            className="inline-flex items-center gap-1 font-bold text-[#626f86] hover:text-[#172b4d]"
                          >
                            <span>Prioridad</span>
                            <ArrowUpDown size={12} />
                          </button>
                        </th>
                        <th>
                          <button
                            type="button"
                            onClick={() => toggleSort('minutes')}
                            className="inline-flex items-center gap-1 font-bold text-[#626f86] hover:text-[#172b4d]"
                          >
                            <span>Estimación</span>
                            <ArrowUpDown size={12} />
                          </button>
                        </th>
                        <th>
                          <button
                            type="button"
                            onClick={() => toggleSort('deadline')}
                            className="inline-flex items-center gap-1 font-bold text-[#626f86] hover:text-[#172b4d]"
                          >
                            <span>Plan / Vence</span>
                            <ArrowUpDown size={12} />
                          </button>
                        </th>
                        <th className="text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTasks.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="text-center py-12 text-slate-500">
                            No hay tareas que coincidan con los filtros actuales.
                          </td>
                        </tr>
                      ) : (
                        sortedTasks.map((t) => {
                          const key = taskKey(t);
                          const isTopToday = t.top && t.planDate === date;
                          const isOverdue =
                            Boolean(t.deadline && t.deadline < date && t.status !== 'done');
                          const checklist = parseChecklist(t.notes);

                          return (
                            <tr key={t.id} className={t.status === 'done' ? 'opacity-65' : ''}>
                              <td className="text-center">
                                <Checkbox
                                  checked={t.status === 'done'}
                                  onCheckedChange={() => void complete(t)}
                                  aria-label={`Completar ${t.title}`}
                                />
                              </td>
                              <td>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEdit({ ...t });
                                    setAiSubtasks(null);
                                  }}
                                  className="jira-issue-key hover:underline"
                                >
                                  <span className="jira-type-checkbox">
                                    <Check size={10} />
                                  </span>
                                  <span>{key}</span>
                                </button>
                              </td>
                              <td className="max-w-md">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEdit({ ...t });
                                      setAiSubtasks(null);
                                    }}
                                    className={`font-medium text-left hover:text-[#0c66e4] truncate ${
                                      t.status === 'done' ? 'line-through text-slate-500' : ''
                                    }`}
                                  >
                                    {t.title}
                                  </button>
                                  {checklist.total > 0 && (
                                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                                      ✓ {checklist.done}/{checklist.total}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <select
                                  aria-label={`Estado de ${t.title}`}
                                  value={t.status}
                                  onChange={(e) => {
                                    const nextStatus = e.target.value as TaskStatus;
                                    void patch(t, {
                                      status: nextStatus,
                                      completed:
                                        nextStatus === 'done'
                                          ? t.completed || new Date().toISOString()
                                          : '',
                                    });
                                  }}
                                  className={`jira-lozenge jira-lozenge-${t.status} border-0 cursor-pointer`}
                                >
                                  {Object.entries(states).map(([stKey, stLabel]) => (
                                    <option key={stKey} value={stKey}>
                                      {stLabel.toUpperCase()}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <select
                                  aria-label={`Área de ${t.title}`}
                                  value={t.area}
                                  onChange={(e) => void patch(t, { area: e.target.value })}
                                  className="text-xs font-medium bg-slate-100 text-slate-700 rounded px-2 py-1 border-0 cursor-pointer"
                                >
                                  {areas.map((a) => (
                                    <option key={a} value={a}>
                                      {a}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <span className="text-xs text-slate-600">
                                  {t.project || '—'}
                                </span>
                              </td>
                              <td>
                                <select
                                  aria-label={`Prioridad de ${t.title}`}
                                  value={String(t.priority)}
                                  onChange={(e) =>
                                    void patch(t, { priority: Number(e.target.value) })
                                  }
                                  className="text-xs font-medium bg-transparent border border-transparent hover:border-slate-200 rounded px-1.5 py-0.5 cursor-pointer"
                                >
                                  <option value="3">⏫ Alta</option>
                                  <option value="2">🟰 Media</option>
                                  <option value="1">⏬ Baja</option>
                                </select>
                              </td>
                              <td>
                                <span className="font-mono text-xs text-slate-600">
                                  {t.minutes} min
                                </span>
                              </td>
                              <td>
                                <div className="flex flex-col text-xs">
                                  {t.deadline && (
                                    <span
                                      className={
                                        isOverdue
                                          ? 'text-red-600 font-semibold'
                                          : 'text-slate-700'
                                      }
                                    >
                                      Vence: {dayLabel(t.deadline)}
                                    </span>
                                  )}
                                  {t.planDate && (
                                    <span className="text-slate-500">
                                      Plan: {t.planDate === date ? 'Hoy' : dayLabel(t.planDate)}
                                    </span>
                                  )}
                                  {!t.deadline && !t.planDate && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void patch(t, {
                                          planDate: date,
                                          status: t.status === 'inbox' ? 'todo' : t.status,
                                        })
                                      }
                                      className="text-left text-[11px] text-[#0c66e4] hover:underline"
                                    >
                                      + Planificar hoy
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="text-right">
                                <div className="inline-flex items-center gap-1">
                                  {t.status !== 'done' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFocusTaskId(t.id);
                                        setFocusOpen(true);
                                      }}
                                      className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
                                      title="Iniciar bloque Pomodoro"
                                    >
                                      <Timer size={14} />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => toggleTop(t)}
                                    className={`p-1.5 rounded hover:bg-slate-200 ${
                                      isTopToday ? 'text-amber-500' : 'text-slate-400'
                                    }`}
                                    title="Alternar Top 3"
                                  >
                                    <Star size={14} fill={isTopToday ? 'currentColor' : 'none'} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleting(t)}
                                    className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                                    title="Eliminar"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>

                  {/* Inline Quick Add Row at the bottom of the Jira Table */}
                  <form
                    onSubmit={handleListQuickCreate}
                    className="flex items-center gap-3 px-4 py-2.5 bg-[#f7f8f9] border-t border-[#dcdfe4]"
                  >
                    <Plus size={16} className="text-[#44546f]" />
                    <input
                      value={listQuickTitle}
                      onChange={(e) => setListQuickTitle(e.target.value)}
                      placeholder="Crear nuevo pendiente en esta lista… (presioná Enter)"
                      className="flex-1 bg-transparent border-0 outline-none text-sm text-[#172b4d]"
                    />
                    <button
                      type="submit"
                      disabled={!listQuickTitle.trim()}
                      className="px-3 py-1 text-xs font-semibold bg-[#0c66e4] text-white rounded disabled:opacity-40"
                    >
                      Añadir
                    </button>
                  </form>
                </div>
              </div>
            ) : activeTab === 'summary' ? (
              /* ==============================================================
                 TAB 1: RESUMEN DEL ESPACIO (JIRA SUMMARY DASHBOARD)
                 ============================================================== */
              <div className="max-w-6xl space-y-6 py-2">
                {/* 4 Top Jira Summary KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="border border-[#dcdfe4] rounded-lg p-4 bg-white flex items-center gap-3.5">
                    <span className="w-10 h-10 rounded-full bg-[#dcfff1] text-[#216e4e] grid place-items-center shrink-0">
                      <CheckCheck size={20} />
                    </span>
                    <div>
                      <div className="text-xl font-bold text-[#172b4d]">
                        {spaceTasks.filter((t) => t.status === 'done').length} completadas
                      </div>
                      <div className="text-xs text-[#626f86]">en este espacio</div>
                    </div>
                  </div>

                  <div className="border border-[#dcdfe4] rounded-lg p-4 bg-white flex items-center gap-3.5">
                    <span className="w-10 h-10 rounded-full bg-[#e9f2ff] text-[#0c66e4] grid place-items-center shrink-0">
                      <Play size={18} />
                    </span>
                    <div>
                      <div className="text-xl font-bold text-[#172b4d]">
                        {spaceTasks.filter((t) => t.status === 'doing').length} en curso
                      </div>
                      <div className="text-xs text-[#626f86]">trabajando activamente</div>
                    </div>
                  </div>

                  <div className="border border-[#dcdfe4] rounded-lg p-4 bg-white flex items-center gap-3.5">
                    <span className="w-10 h-10 rounded-full bg-[#f1f2f4] text-[#44546f] grid place-items-center shrink-0">
                      <Inbox size={19} />
                    </span>
                    <div>
                      <div className="text-xl font-bold text-[#172b4d]">
                        {
                          spaceTasks.filter(
                            (t) => t.status === 'todo' || t.status === 'inbox'
                          ).length
                        }{' '}
                        por hacer
                      </div>
                      <div className="text-xs text-[#626f86]">en cola y bandeja</div>
                    </div>
                  </div>

                  <div className="border border-[#dcdfe4] rounded-lg p-4 bg-white flex items-center gap-3.5">
                    <span className="w-10 h-10 rounded-full bg-[#ffeceb] text-[#ae2e24] grid place-items-center shrink-0">
                      <AlertTriangle size={19} />
                    </span>
                    <div>
                      <div className="text-xl font-bold text-[#172b4d]">
                        {spaceTasks.filter((t) => attention(t, date)).length} requieren atención
                      </div>
                      <div className="text-xs text-[#626f86]">vencidas o seguimiento</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Status Overview Card */}
                  <div className="border border-[#dcdfe4] rounded-lg p-5 bg-white">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-[#172b4d]">Resumen de estado</h3>
                        <p className="text-xs text-[#626f86]">
                          Instantánea del estado de tus elementos de trabajo.
                        </p>
                      </div>
                      <span className="text-xs font-bold text-[#44546f]">
                        {spaceTasks.length} totales
                      </span>
                    </div>

                    <div className="space-y-3">
                      {(
                        [
                          ['inbox', 'Sin organizar (Bandeja)', 'bg-slate-400'],
                          ['todo', 'Por hacer (To Do)', 'bg-slate-600'],
                          ['doing', 'En curso (In Progress)', 'bg-[#0c66e4]'],
                          ['waiting', 'En revisión / Espera', 'bg-amber-500'],
                          ['done', 'Completado (Done)', 'bg-emerald-600'],
                        ] as const
                      ).map(([st, label, barColor]) => {
                        const count = spaceTasks.filter((t) => t.status === st).length;
                        const pct =
                          spaceTasks.length > 0
                            ? Math.round((count / spaceTasks.length) * 100)
                            : 0;
                        return (
                          <div key={st} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-[#172b4d]">{label}</span>
                              <span className="text-[#626f86]">
                                {count} ({pct}%)
                              </span>
                            </div>
                            <div className="h-2 bg-[#f1f2f4] rounded-full overflow-hidden">
                              <div
                                className={`h-full ${barColor} rounded-full transition-all`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Priority Breakdown + Today's Capacity */}
                  <div className="border border-[#dcdfe4] rounded-lg p-5 bg-white flex flex-col justify-between space-y-5">
                    <div>
                      <h3 className="text-sm font-bold text-[#172b4d] mb-1">
                        Desglose de prioridad (Pendientes activos)
                      </h3>
                      <p className="text-xs text-[#626f86] mb-4">
                        Visión holística de cómo se prioriza el trabajo.
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { p: 3, label: 'Alta', color: 'border-red-200 bg-red-50/50' },
                          { p: 2, label: 'Media', color: 'border-amber-200 bg-amber-50/50' },
                          { p: 1, label: 'Baja', color: 'border-blue-200 bg-blue-50/50' },
                        ].map(({ p, label, color }) => {
                          const count = spaceTasks.filter(
                            (t) => t.status !== 'done' && t.priority === p
                          ).length;
                          return (
                            <div
                              key={p}
                              className={`border rounded-lg p-3 text-center ${color}`}
                            >
                              <PriorityIcon priority={p} showLabel />
                              <div className="text-2xl font-bold text-[#172b4d] mt-1">
                                {count}
                              </div>
                              <div className="text-[11px] text-[#626f86]">pendientes</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[#f1f2f4]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#172b4d]">
                          Presupuesto de Capacidad de Hoy ({dayLabel(date)})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setBudgetInput(String(budget));
                            setBudgetOpen(true);
                          }}
                          className="text-xs text-[#0c66e4] hover:underline font-semibold"
                        >
                          Configurar ({budget} min)
                        </button>
                      </div>
                      <Progress
                        value={
                          budget
                            ? Math.min(100, (plannedMinutes / budget) * 100)
                            : plannedMinutes
                            ? 100
                            : 0
                        }
                      />
                      <p className="text-xs text-[#626f86] mt-1.5">
                        {plannedMinutes} min planificados hoy · {doneMinutes} min ya completados.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === 'timeline' ? (
              /* ==============================================================
                 TAB 4: CRONOGRAMA (7-DAY SPRINT TIMELINE + DAILY TIMEBOXING)
                 ============================================================== */
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#f1f2f4]">
                  <div>
                    <h2 className="text-sm font-bold text-[#172b4d]">
                      Cronograma y Planificación Temporal
                    </h2>
                    <p className="text-xs text-[#626f86]">
                      Arrastrá tareas entre los próximos 7 días o visualizá tus bloques de hoy por hora.
                    </p>
                  </div>
                  <div className="inline-flex bg-[#f1f2f4] p-0.5 rounded-md">
                    <button
                      type="button"
                      onClick={() => setTimelineMode('week')}
                      className={`px-3 py-1 text-xs font-semibold rounded ${
                        timelineMode === 'week'
                          ? 'bg-white text-[#0c66e4] shadow-2xs'
                          : 'text-[#44546f]'
                      }`}
                    >
                      Semana (7 días)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimelineMode('timeboxing')}
                      className={`px-3 py-1 text-xs font-semibold rounded ${
                        timelineMode === 'timeboxing'
                          ? 'bg-white text-[#0c66e4] shadow-2xs'
                          : 'text-[#44546f]'
                      }`}
                    >
                      Timeboxing de Hoy ({settings.workdayStart} hs)
                    </button>
                  </div>
                </div>

                {timelineMode === 'timeboxing' ? (
                  <div className="max-w-3xl">
                    <TimeboxingView
                      tasks={dayTasks}
                      workdayStart={settings.workdayStart}
                      onToggleDone={(t) => void complete(t)}
                      onSelectTask={(t) => {
                        setEdit({ ...t });
                        setAiSubtasks(null);
                      }}
                      onStartFocus={(t) => {
                        setFocusTaskId(t.id);
                        setFocusOpen(true);
                      }}
                    />
                  </div>
                ) : (
                  <div className="jira-board">
                    {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                      const dStr = addDays(date, offset);
                      const dayItems = spaceTasks.filter(
                        (t) =>
                          t.status !== 'done' &&
                          (t.planDate === dStr || (!t.planDate && t.deadline === dStr))
                      );
                      const mins = dayItems.reduce((s, t) => s + t.minutes, 0);
                      const dropKey = `day-${dStr}`;

                      return (
                        <section
                          key={dStr}
                          onDragOver={(e) => handleColumnDragOver(e, dropKey)}
                          onDragLeave={() => setDragOverColumn(null)}
                          onDrop={async (e) => {
                            e.preventDefault();
                            const id = e.dataTransfer.getData('text/plain') || draggedTaskId;
                            setDraggedTaskId(null);
                            setDragOverColumn(null);
                            if (!id) return;
                            const task = tasks.find((x) => x.id === id);
                            if (task) {
                              await patch(task, {
                                planDate: dStr,
                                status: task.status === 'inbox' ? 'todo' : task.status,
                              });
                              toast.success(`Reprogramada para ${dayLabel(dStr)}`);
                            }
                          }}
                          className={`jira-column min-w-[235px] ${
                            dragOverColumn === dropKey ? 'is-drag-over' : ''
                          }`}
                        >
                          <header className="jira-column-header">
                            <div>
                              <span className={offset === 0 ? 'text-[#0c66e4]' : ''}>
                                {offset === 0
                                  ? 'HOY'
                                  : offset === 1
                                  ? 'MAÑANA'
                                  : dayLabel(dStr).toUpperCase()}
                              </span>
                              <span className="jira-column-count">{dayItems.length}</span>
                            </div>
                            <span className="text-[11px] font-normal text-[#626f86] lowercase">
                              {mins}m
                            </span>
                          </header>

                          <div className="jira-column-body">
                            {dayItems.map(renderJiraCard)}
                            <button
                              type="button"
                              onClick={() =>
                                startTask({
                                  planDate: dStr,
                                  status: 'todo',
                                })
                              }
                              className="jira-column-create-btn mt-auto"
                            >
                              <Plus size={14} />
                              <span>Planificar el {dayLabel(dStr)}</span>
                            </button>
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* ==============================================================
                 TAB 5: INFORMES Y MÉTRICAS
                 ============================================================== */
              <div className="py-2">
                <MetricsView
                  tasks={spaceTasks}
                  date={date}
                  onSelectTask={(t) => {
                    setEdit({ ...t });
                    setAiSubtasks(null);
                  }}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ====================================================================
          5. JIRA-STYLE 2-COLUMN ISSUE DETAIL & CREATE MODAL
         ==================================================================== */}
      <Dialog
        open={Boolean(edit)}
        onOpenChange={(v) => {
          if (!v && !busy) setEdit(null);
        }}
      >
        <DialogContent
          className="max-w-4xl! w-[95vw]! max-h-[92dvh] overflow-y-auto p-0! bg-white rounded-xl border border-[#dcdfe4]"
          onOpenAutoFocus={(event) => {
            if (window.matchMedia('(max-width: 767px)').matches) event.preventDefault();
          }}
        >
          {edit && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await saveTask(edit);
                  setEdit(null);
                  toast.success('Elemento guardado.');
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
              className="flex flex-col"
            >
              {/* Modal Top Jira Issue Header */}
              <div className="flex items-center justify-between gap-2 px-6 py-3.5 border-b border-[#dcdfe4] bg-[#f7f8f9]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#626f86]">
                  <span className="jira-type-checkbox">
                    <Check size={10} />
                  </span>
                  <span className="font-mono">{taskKey(edit)}</span>
                  <span>/</span>
                  <span>{edit.area}</span>
                </div>

                <div className="flex items-center gap-2 pr-6">
                  {tasks.some((t) => t.id === edit.id) && edit.status !== 'done' && (
                    <button
                      type="button"
                      onClick={() => {
                        setFocusTaskId(edit.id);
                        setEdit(null);
                        setFocusOpen(true);
                      }}
                      className="jira-btn-subtle text-xs"
                    >
                      <Timer size={13} className="text-[#0c66e4]" />
                      <span>Iniciar Pomodoro</span>
                    </button>
                  )}

                  {tasks.some((t) => t.id === edit.id) && (
                    <button
                      type="button"
                      onClick={() => setDeleting(edit)}
                      className="jira-btn-subtle text-red-600 hover:bg-red-50"
                      title="Eliminar pendiente"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              <DialogHeader className="sr-only">
                <DialogTitle>
                  {tasks.some((t) => t.id === edit.id)
                    ? `Editar ${taskKey(edit)}`
                    : 'Crear pendiente'}
                </DialogTitle>
                <DialogDescription>
                  Detalle completo del elemento de trabajo estilo Jira.
                </DialogDescription>
              </DialogHeader>

              {/* 2-Column Jira Issue Body */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6">
                {/* Left Column (7 cols): Title, Description/Notes, Checklist, Gemini AI */}
                <div className="md:col-span-7 space-y-5">
                  <div>
                    <label
                      htmlFor="task-title"
                      className="block text-xs font-bold uppercase text-[#626f86] mb-1.5"
                    >
                      Resumen del pendiente *
                    </label>
                    <input
                      id="task-title"
                      value={edit.title}
                      required
                      maxLength={240}
                      placeholder="Ej.: Configurar despliegue continuo en el servidor"
                      onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                      className="w-full text-lg font-semibold text-[#172b4d] border border-[#dcdfe4] focus:border-[#0c66e4] rounded-md px-3 py-2 outline-none"
                    />
                  </div>

                  {/* Interactive Subtasks / Checklist Section */}
                  {(() => {
                    const cl = parseChecklist(edit.notes);
                    return (
                      <div className="border border-[#dcdfe4] rounded-lg p-3.5 bg-[#f7f8f9]/60 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase text-[#44546f] flex items-center gap-1.5">
                            <CheckSquare size={14} className="text-[#0c66e4]" />
                            Subtareas / Checklist ({cl.done}/{cl.total})
                          </span>
                          {cl.total > 0 && (
                            <span className="text-xs font-semibold text-[#0c66e4]">
                              {Math.round((cl.done / cl.total) * 100)}%
                            </span>
                          )}
                        </div>

                        {cl.total > 0 && (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {cl.items.map((item) => (
                              <label
                                key={item.index}
                                className="flex items-center gap-2 text-xs bg-white p-2 rounded border border-[#dcdfe4] cursor-pointer hover:bg-slate-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={item.checked}
                                  onChange={() =>
                                    setEdit({
                                      ...edit,
                                      notes: toggleChecklistLine(edit.notes, item.index),
                                    })
                                  }
                                  className="rounded border-slate-300"
                                />
                                <span
                                  className={
                                    item.checked ? 'line-through text-slate-400' : 'text-[#172b4d]'
                                  }
                                >
                                  {item.text}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <input
                            value={newSubtaskInput}
                            onChange={(e) => setNewSubtaskInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (!newSubtaskInput.trim()) return;
                                const line = `- [ ] ${newSubtaskInput.trim()}`;
                                setEdit({
                                  ...edit,
                                  notes: edit.notes ? `${edit.notes}\n${line}` : line,
                                });
                                setNewSubtaskInput('');
                              }
                            }}
                            placeholder="Añadir subtarea al checklist… (Enter)"
                            className="flex-1 text-xs bg-white border border-[#dcdfe4] rounded px-2.5 py-1.5 outline-none focus:border-[#0c66e4]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!newSubtaskInput.trim()) return;
                              const line = `- [ ] ${newSubtaskInput.trim()}`;
                              setEdit({
                                ...edit,
                                notes: edit.notes ? `${edit.notes}\n${line}` : line,
                              });
                              setNewSubtaskInput('');
                            }}
                            className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-[#dcdfe4] rounded hover:bg-slate-100 text-[#172b4d]"
                          >
                            + Subtarea
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Notes / Description */}
                  <div>
                    <label
                      htmlFor="task-notes"
                      className="block text-xs font-bold uppercase text-[#626f86] mb-1.5"
                    >
                      Descripción y Notas
                    </label>
                    <textarea
                      id="task-notes"
                      rows={4}
                      maxLength={10000}
                      value={edit.notes ?? ''}
                      onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                      placeholder="Añadí contexto, enlaces o pasos usando '- [ ] paso'…"
                      className="w-full text-sm text-[#172b4d] border border-[#dcdfe4] focus:border-[#0c66e4] rounded-md p-2.5 outline-none"
                    />
                  </div>

                  {/* Gemini AI Smart Breakdown */}
                  <div className="p-3.5 bg-[#e9f2ff]/60 border border-[#85b8ff] rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#0c66e4]">
                        <Sparkles size={15} />
                        <span>Asistente Gemini AI · Desglosar trabajo</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAiBreakdown}
                        disabled={aiBreakdownLoading || !edit.title.trim()}
                        className="inline-flex items-center gap-1.5 text-xs bg-white hover:bg-blue-50 text-[#0c66e4] font-semibold px-3 py-1.5 rounded border border-[#85b8ff] transition-colors disabled:opacity-50"
                      >
                        {aiBreakdownLoading ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Sparkles size={13} />
                        )}
                        {aiBreakdownLoading ? 'Analizando…' : 'Sugerir subtareas con IA'}
                      </button>
                    </div>

                    {aiSubtasks && aiSubtasks.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-[#85b8ff]/40">
                        <div className="space-y-1 max-h-36 overflow-y-auto">
                          {aiSubtasks.map((st, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs bg-white p-2 rounded border border-blue-100"
                            >
                              <span className="text-[#172b4d] font-medium truncate flex-1">
                                {idx + 1}. {st.title}
                              </span>
                              <span className="text-[11px] text-[#626f86] font-mono ml-2">
                                {st.minutes}m
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={appendSubtasksToNotes}
                            className="text-xs font-semibold bg-[#0c66e4] hover:bg-[#0055cc] text-white px-3 py-1.5 rounded flex-1"
                          >
                            Añadir al Checklist de esta tarea
                          </button>
                          <button
                            type="button"
                            onClick={applyAiSubtasks}
                            className="text-xs font-semibold bg-white hover:bg-slate-100 text-[#172b4d] border border-[#dcdfe4] px-3 py-1.5 rounded"
                          >
                            Crear como tarjetas separadas
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column (5 cols): Jira Details Panel */}
                <div className="md:col-span-5 space-y-4">
                  <div className="border border-[#dcdfe4] rounded-lg p-4 bg-[#f7f8f9]/40 space-y-3.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#626f86] border-b border-[#dcdfe4] pb-2">
                      Detalles del elemento
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="task-status"
                          className="block text-xs font-semibold text-[#44546f] mb-1"
                        >
                          Estado
                        </label>
                        <Choice
                          id="task-status"
                          label="Estado"
                          value={edit.status}
                          onChange={(v) =>
                            setEdit({
                              ...edit,
                              status: v as Task['status'],
                              top: v === 'waiting' ? false : edit.top,
                              completed:
                                v === 'done'
                                  ? edit.completed || new Date().toISOString()
                                  : '',
                            })
                          }
                          items={Object.entries(states)}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="task-priority"
                          className="block text-xs font-semibold text-[#44546f] mb-1"
                        >
                          Prioridad
                        </label>
                        <Choice
                          id="task-priority"
                          label="Prioridad"
                          value={String(edit.priority)}
                          onChange={(v) => setEdit({ ...edit, priority: Number(v) })}
                          items={['1', '2', '3'].map((v) => [
                            v,
                            priorityLabels[Number(v)],
                          ])}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="task-area"
                          className="block text-xs font-semibold text-[#44546f] mb-1"
                        >
                          Espacio / Área
                        </label>
                        <Choice
                          id="task-area"
                          label="Área"
                          value={edit.area}
                          onChange={(area) => setEdit({ ...edit, area })}
                          items={areas.map((a) => [a, a])}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="task-minutes"
                          className="block text-xs font-semibold text-[#44546f] mb-1"
                        >
                          Estimación (min)
                        </label>
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
                          className="w-full h-[43px] border border-[#dbe2ed] rounded-[7px] px-3 bg-white text-sm text-[#172b4d]"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="task-project"
                        className="block text-xs font-semibold text-[#44546f] mb-1"
                      >
                        Proyecto / Épica (opcional)
                      </label>
                      <input
                        id="task-project"
                        maxLength={120}
                        value={edit.project ?? ''}
                        placeholder="Ej.: Lanzamiento Web, DevOps…"
                        onChange={(e) => setEdit({ ...edit, project: e.target.value })}
                        className="w-full h-[38px] border border-[#dbe2ed] rounded-[7px] px-3 bg-white text-sm text-[#172b4d]"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="task-plan-date"
                          className="text-xs font-semibold text-[#44546f]"
                        >
                          Día planificado
                        </label>
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() =>
                              setEdit({
                                ...edit,
                                planDate: date,
                                status: edit.status === 'inbox' ? 'todo' : edit.status,
                              })
                            }
                            className="text-[#0c66e4] hover:underline font-medium"
                          >
                            Hoy
                          </button>
                          <span>·</span>
                          <button
                            type="button"
                            onClick={() =>
                              setEdit({
                                ...edit,
                                planDate: addDays(date, 1),
                                status: edit.status === 'inbox' ? 'todo' : edit.status,
                              })
                            }
                            className="text-[#0c66e4] hover:underline font-medium"
                          >
                            Mañana
                          </button>
                        </div>
                      </div>
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
                              edit.status === 'inbox' && e.target.value
                                ? 'todo'
                                : edit.status,
                          })
                        }
                        className="w-full h-[38px] border border-[#dbe2ed] rounded-[7px] px-3 bg-white text-sm text-[#172b4d]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="task-deadline"
                          className="block text-xs font-semibold text-[#44546f] mb-1"
                        >
                          Fecha límite
                        </label>
                        <input
                          id="task-deadline"
                          type="date"
                          value={edit.deadline ?? ''}
                          onChange={(e) =>
                            setEdit({ ...edit, deadline: e.target.value })
                          }
                          className="w-full h-[38px] border border-[#dbe2ed] rounded-[7px] px-2.5 bg-white text-xs text-[#172b4d]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="task-follow-up"
                          className="block text-xs font-semibold text-[#44546f] mb-1"
                        >
                          Seguimiento
                        </label>
                        <input
                          id="task-follow-up"
                          type="date"
                          value={edit.followUp ?? ''}
                          onChange={(e) =>
                            setEdit({ ...edit, followUp: e.target.value })
                          }
                          className="w-full h-[38px] border border-[#dbe2ed] rounded-[7px] px-2.5 bg-white text-xs text-[#172b4d]"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 pt-1 cursor-pointer text-xs font-semibold text-[#172b4d]">
                      <input
                        type="checkbox"
                        checked={Boolean(edit.top)}
                        onChange={(e) =>
                          setEdit({
                            ...edit,
                            top: e.target.checked,
                            planDate: e.target.checked ? edit.planDate || date : edit.planDate,
                          })
                        }
                        className="rounded border-slate-300"
                      />
                      <Star size={14} className="text-amber-500" />
                      <span>Destacar en mi Top 3 del día</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#dcdfe4] bg-[#f7f8f9]">
                <span className="text-xs text-[#626f86]">
                  {tasks.some((t) => t.id === edit.id)
                    ? `Actualizado: ${new Intl.DateTimeFormat('es-AR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                        timeZone: 'America/Argentina/Buenos_Aires',
                      }).format(new Date(edit.updated))}`
                    : 'Nuevo elemento en ' + edit.area}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEdit(null)}
                    className="jira-btn-subtle"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="jira-create-btn"
                  >
                    {busy ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
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
                    <b>
                      <span className="font-mono text-xs text-slate-500 mr-1.5">
                        {taskKey(t)}
                      </span>
                      {t.title}
                    </b>
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

          <button
            className="jira-create-btn w-full justify-center py-2.5"
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
        </DialogContent>
      </Dialog>

      {/* Budget Configuration Dialog */}
      <Dialog open={budgetOpen} onOpenChange={(v) => !busy && setBudgetOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tu capacidad disponible hoy</DialogTitle>
            <DialogDescription>
              Definí cuántos minutos reales podés dedicar hoy a tus pendientes.
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
                toast.success('Capacidad del día actualizada.');
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
              {[60, 120, 180, 240, 360].map((n) => (
                <button
                  type="button"
                  className="outline-btn"
                  key={n}
                  onClick={() => setBudgetInput(String(n))}
                >
                  {n} min ({n / 60}h)
                </button>
              ))}
            </div>
            <button className="jira-create-btn" disabled={busy}>
              Guardar capacidad
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
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
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
    </div>
  );
}
