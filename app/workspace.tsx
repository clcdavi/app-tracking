'use client';

import { useEffect, useRef, useState, useMemo, type DragEvent } from 'react';
import Link from 'next/link';
import {
  Sun,
  Moon,
  Inbox,
  CalendarDays,
  Flag,
  Clock,
  CheckCheck,
  Layers,
  Plus,
  Search,
  RefreshCw,
  Check,
  Play,
  Star,
  Trash2,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  Equal,
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
  Maximize2,
  Minimize2,
  Share2,
  MoreHorizontal,
  UserCheck,
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
  kanban: '#f87462',
  Personal: '#579dff',
  Trabajo: '#9f8fef',
  Estudio: '#f5cd47',
  Iglesia: '#4bce97',
  Proyectos: '#fea362',
};

const AREA_TAG_STYLES: Record<string, { bg: string; text: string }> = {
  Personal: { bg: 'rgba(87, 157, 255, 0.16)', text: '#579dff' },
  Trabajo: { bg: 'rgba(159, 143, 239, 0.16)', text: '#9f8fef' },
  Estudio: { bg: 'rgba(245, 205, 71, 0.16)', text: '#e2b203' },
  Iglesia: { bg: 'rgba(75, 206, 151, 0.16)', text: '#4bce97' },
  Proyectos: { bg: 'rgba(254, 163, 98, 0.16)', text: '#fea362' },
};

const priorityLabels = ['', 'Baja', 'Media', 'Alta'];

type UserInfo = { displayName: string; email: string };

function PriorityIcon({ priority, showLabel = false }: { priority: number; showLabel?: boolean }) {
  if (priority === 3) {
    return (
      <span className="inline-flex items-center gap-1 text-[#f87462] font-medium text-xs" title="Prioridad Alta">
        <ChevronsUp size={15} className="stroke-[2.5]" />
        {showLabel && <span>Alta</span>}
      </span>
    );
  }
  if (priority === 1) {
    return (
      <span className="inline-flex items-center gap-1 text-[#579dff] font-medium text-xs" title="Prioridad Baja">
        <ChevronsDown size={15} className="stroke-[2.5]" />
        {showLabel && <span>Baja</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[#fea362] font-medium text-xs" title="Prioridad Media">
      <Equal size={14} className="stroke-[2.5]" />
      {showLabel && <span>Media</span>}
    </span>
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
    <div className="relative w-full">
      <select
        id={id}
        aria-label={label}
        className="jira-input w-full h-[38px] appearance-none px-3 pr-8 text-xs font-medium cursor-pointer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {items.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <ChevronDown
        className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none jira-text-subtle"
        size={14}
      />
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
  const [space, setSpace] = useState<string>('kanban');
  const [activeTab, setActiveTab] = useState<JiraTab>('board');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [spacesExpanded, setSpacesExpanded] = useState(true);
  const [mobileCol, setMobileCol] = useState<'all' | TaskStatus>('all');

  function selectSpace(nextSpace: string) {
    setSpace(nextSpace);
    setQuickFilter('all');
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setSidebarCollapsed(true);
    }
  }

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

  // Customization, Theme & AI state
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
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

  // Apply theme class to <html> element and persist in localStorage
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
    try {
      localStorage.setItem('enfoco_theme', theme);
    } catch {}
  }, [theme]);

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
    if (next.theme) {
      setTheme(next.theme);
    }
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
    if (result.settings?.theme) {
      setTheme(result.settings.theme);
    }
  }

  async function toggleThemeQuick() {
    const nextTheme: 'dark' | 'light' = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    const updated = { ...settings, theme: nextTheme };
    setSettings(updated);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch {}
  }

  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem('enfoco_theme');
      if (storedTheme === 'light' || storedTheme === 'dark') {
        setTheme(storedTheme);
      }
    } catch {}

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
          if (res.settings.theme) {
            setTheme(res.settings.theme);
          }
        }
      })
      .catch(() => {});

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
  const starredCount = useMemo(
    () => tasks.filter((t) => t.top && t.status !== 'done').length,
    [tasks]
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
        if (t.planDate !== date && !t.top) return false;
      } else if (space === 'inbox') {
        // In List view, show only inbox tasks for fast triage;
        // In Board view, keep all tasks visible with the Backlog column open so dragging doesn't make cards vanish
        if (activeTab === 'list' && t.status !== 'inbox') return false;
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

      // 4. Search query (matches title, project, notes, area, sequential key KAN-1, or hash key)
      if (query.trim()) {
        const q = query.toLowerCase().trim();
        const seqKey = taskKey(t, tasks).toLowerCase();
        const hashKey = taskKey(t).toLowerCase();
        const matches =
          seqKey.includes(q) ||
          hashKey.includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.project.toLowerCase().includes(q) ||
          t.notes.toLowerCase().includes(q) ||
          t.area.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [tasks, space, activeTab, onlyMyDay, quickFilter, query, date]);

  // Sorted tasks for List and Board
  const sortedTasks = useMemo(() => {
    const list = [...spaceTasks];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'score') {
        cmp = score(b, date) - score(a, date);
      } else if (sortField === 'key') {
        cmp = taskKey(a, tasks).localeCompare(taskKey(b, tasks), undefined, { numeric: true });
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
  }, [spaceTasks, tasks, sortField, sortAsc, date]);

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
      ...(space === 'today' || onlyMyDay ? { planDate: date } : {}),
      ...(space === 'starred' ? { top: true, planDate: date } : {}),
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
        top: space === 'starred',
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
        top: space === 'starred',
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

  // Fixed toggleTop: unstars any task with top === true; stars if top === false (respecting Top 3 limit for today)
  const toggleTop = (t: Task) => {
    if (t.top) {
      void patch(t, { top: false });
      return;
    }
    if (top.length >= 3) {
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
      ...(space === 'today' && !task.planDate ? { planDate: date } : {}),
      ...laneOverrides,
    };

    await patch(task, updates);
  }

  // Space display metadata
  const spaceTitleMap: Record<string, string> = {
    kanban: 'Mi espacio de Kanban',
    today: 'Para ti · Mi Día',
    inbox: 'Recientes · Bandeja de entrada',
    starred: 'Marcados como favoritos',
    attention: 'Necesita atención',
    week: 'Planes · Próximos 7 días',
    Personal: 'Espacio Personal',
    Trabajo: 'Espacio Trabajo',
    Estudio: 'Espacio Estudio',
    Iglesia: 'Espacio Iglesia',
    Proyectos: 'Espacio Proyectos',
  };

  const currentSpaceTitle = spaceTitleMap[space] || space;
  const currentSpaceColor = SPACE_COLORS[space] || '#f87462';
  const displayName = user?.displayName || 'Usuario';
  const userInitial = displayName.charAt(0).toUpperCase();

  // Kanban columns configuration (matches Jira Cloud screenshot: To Do, In Progress, In Review, Done + optional Backlog)
  const boardColumns: { status: TaskStatus; label: string }[] = useMemo(() => {
    const cols: { status: TaskStatus; label: string }[] = [];
    if (showInboxColumn || space === 'inbox') {
      cols.push({ status: 'inbox', label: 'Backlog' });
    }
    cols.push(
      { status: 'todo', label: 'To Do' },
      { status: 'doing', label: 'In Progress' },
      { status: 'waiting', label: 'In Review' },
      { status: 'done', label: 'Done' }
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
    const key = taskKey(t, tasks);
    const isOverdue = Boolean(t.deadline && t.deadline < date && t.status !== 'done');
    const isToday = t.planDate === date;
    const isStarred = Boolean(t.top);
    const checklist = parseChecklist(t.notes);
    const areaStyle = AREA_TAG_STYLES[t.area] || {
      bg: 'rgba(159, 173, 188, 0.16)',
      text: '#9fadbc',
    };

    return (
      <article
        key={t.id}
        draggable
        onDragStart={(e) => handleDragStart(e, t)}
        onDragEnd={handleDragEnd}
        className={`jira-card group ${t.status === 'done' ? 'is-done' : ''} ${
          isStarred ? 'is-top' : ''
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

          <div className="flex items-center gap-0.5 opacity-75 group-hover:opacity-100 shrink-0">
            {t.status !== 'done' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFocusTaskId(t.id);
                  setFocusOpen(true);
                }}
                title="Iniciar Pomodoro"
                className="p-1 rounded hover:bg-[var(--j-bg-sunken)] jira-text-subtle hover:text-[#579dff] transition-colors"
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
              title={isStarred ? 'Quitar de Favoritos / Top 3' : 'Marcar como Favorito (Top 3)'}
              className={`p-1 rounded hover:bg-[var(--j-bg-sunken)] transition-colors ${
                isStarred ? 'text-[#f5cd47]' : 'jira-text-subtle hover:text-[#f5cd47]'
              }`}
            >
              <Star size={13} fill={isStarred ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        {/* Tags & Badges Row */}
        {(t.area !== space ||
          t.project ||
          t.status === 'inbox' ||
          isOverdue ||
          t.deadline ||
          isToday ||
          checklist.total > 0) && (
          <div className="jira-card-tags">
            {t.status === 'inbox' && !showInboxColumn && space !== 'inbox' && (
              <span className="jira-tag bg-amber-500/15 text-[#f5cd47]">
                Bandeja
              </span>
            )}

            <span
              className="jira-tag"
              style={{ backgroundColor: areaStyle.bg, color: areaStyle.text }}
            >
              {t.area}
            </span>

            {t.project && (
              <span className="jira-tag bg-[var(--j-bg-sunken)] jira-text-subtle border border-[var(--j-border)]">
                {t.project}
              </span>
            )}

            {isOverdue && (
              <span className="jira-tag bg-[#f87462]/20 text-[#f87462]">
                <AlertTriangle size={11} />
                Venció {dayLabel(t.deadline)}
              </span>
            )}

            {!isOverdue && t.deadline && (
              <span className="jira-tag bg-[var(--j-bg-sunken)] jira-text-subtle">
                📅 {dayLabel(t.deadline)}
              </span>
            )}

            {isToday && t.status !== 'done' && (
              <span className="jira-tag bg-[#579dff]/20 text-[#579dff]">
                Hoy
              </span>
            )}

            {checklist.total > 0 && (
              <span
                className={`jira-tag ${
                  checklist.done === checklist.total
                    ? 'bg-[#4bce97]/20 text-[#4bce97]'
                    : 'bg-[var(--j-bg-sunken)] jira-text-subtle'
                }`}
                title="Subtareas / Checklist"
              >
                <CheckSquare size={11} />
                {checklist.done}/{checklist.total}
              </span>
            )}
          </div>
        )}

        {/* Jira Card Footer: Issue Icon + Key left, Estimate + Priority + Avatar right */}
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
                background:
                  t.status === 'done'
                    ? '#4bce97'
                    : t.priority === 3
                    ? '#e2483d'
                    : '#4bade8',
              }}
            >
              <Check size={10} className="stroke-[3]" />
            </span>
            <span>{key}</span>
          </button>

          <div className="flex items-center gap-1.5">
            {/* Touch-friendly 1-tap column/status switcher (ideal for iOS Chrome where HTML5 drag is unavailable) */}
            <select
              aria-label={`Cambiar columna de ${t.title}`}
              value={t.status}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const nextStatus = e.target.value as TaskStatus;
                void patch(t, {
                  status: nextStatus,
                  completed:
                    nextStatus === 'done'
                      ? t.completed || new Date().toISOString()
                      : '',
                  ...(nextStatus === 'waiting' ? { top: false } : {}),
                });
              }}
              className="md:hidden text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--j-bg-sunken)] border border-[var(--j-border)] jira-text-subtle cursor-pointer"
            >
              <option value="inbox">Backlog</option>
              <option value="todo">To Do</option>
              <option value="doing">In Progress</option>
              <option value="waiting">In Review</option>
              <option value="done">Done</option>
            </select>
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-[var(--j-bg-sunken)] jira-text-subtle">
              {t.minutes}m
            </span>
            <PriorityIcon priority={t.priority} />
            <span
              className="w-5 h-5 rounded-full bg-[var(--j-bg-sunken)] border border-[var(--j-border-input)] jira-text-subtle text-[10px] font-bold grid place-items-center"
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
    <div className={`jira-shell ${theme === 'dark' ? 'theme-dark' : ''}`}>
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
            <PanelLeft size={17} />
          </button>

          <button
            type="button"
            onClick={() => {
              setSpace('kanban');
              setActiveTab('board');
            }}
            className="jira-icon-btn hidden sm:inline-flex"
            title="Ir al espacio principal"
          >
            <Grid size={17} />
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
              <Kanban size={14} />
            </span>
            <span>Enfoco</span>
          </button>
        </div>

        {/* Center Search + Primary "+ Crear" Button */}
        <div className="jira-topnav-center">
          <div className="jira-global-search">
            <Search size={14} className="shrink-0" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar"
              aria-label="Buscar tareas"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="jira-text-subtle hover:text-[var(--j-text)]"
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
            <Plus size={15} className="stroke-[2.5]" />
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
            className="jira-btn-subtle hidden lg:inline-flex border-[#9f8fef]/50! text-[#9f8fef]!"
            title="Iniciar Modo Enfoque (Pomodoro)"
          >
            <Timer size={14} />
            <span>Modo Enfoque</span>
          </button>

          <button
            type="button"
            onClick={() => void toggleThemeQuick()}
            className="jira-icon-btn"
            title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            aria-label="Cambiar tema de color"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
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
            title="Ajustes y Personalización"
            aria-label="Ajustes y Personalización"
          >
            <Settings size={17} />
          </button>

          {/* User Avatar & Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-7 h-7 rounded-full bg-[#e56910] text-white font-bold text-xs grid place-items-center hover:ring-2 hover:ring-[#579dff] transition-all ml-1"
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
                  className="absolute right-4 top-12 w-64 jira-panel-card shadow-2xl p-3 z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3 pb-3 border-b border-[var(--j-border)]">
                    <span className="w-9 h-9 rounded-full bg-[#e56910] text-white font-bold text-sm grid place-items-center">
                      {userInitial}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">
                        {displayName}
                      </p>
                      <p className="text-xs jira-text-subtle truncate">
                        {user?.email || 'Espacio personal'}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        void toggleThemeQuick();
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium hover:bg-[var(--j-bg-surface-hover)] rounded-md"
                    >
                      {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                      <span>
                        Cambiar a tema {theme === 'dark' ? 'claro' : 'oscuro'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setSettingsOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium hover:bg-[var(--j-bg-surface-hover)] rounded-md"
                    >
                      <Settings size={14} /> Ajustes de cuenta y bot
                    </button>
                    <Link
                      href="/integrations"
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium hover:bg-[var(--j-bg-surface-hover)] rounded-md"
                    >
                      <Plug size={14} /> API Keys e Integraciones
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-[#f87462] hover:bg-[#f87462]/10 rounded-md"
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
        {/* Mobile Backdrop when sidebar is open */}
        {!sidebarCollapsed && (
          <div
            className="jira-sidebar-backdrop md:hidden"
            onClick={() => setSidebarCollapsed(true)}
            aria-hidden="true"
          />
        )}

        {/* Left Sidebar */}
        <aside className={`jira-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
          {/* Quick Personal Views */}
          <div className="jira-nav-section space-y-0.5">
            <button
              type="button"
              onClick={() => selectSpace('today')}
              className={`jira-nav-item ${space === 'today' ? 'is-active' : ''}`}
            >
              <UserCheck size={15} className="shrink-0" />
              <span>Para ti</span>
              {dayTasks.length > 0 && (
                <span className="jira-nav-count">{dayTasks.length}</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowInboxColumn(true);
                selectSpace('inbox');
              }}
              className={`jira-nav-item ${space === 'inbox' ? 'is-active' : ''}`}
            >
              <Clock size={15} className="shrink-0" />
              <span>Recientes</span>
              {inboxCount > 0 ? (
                <span className="jira-nav-count">{inboxCount}</span>
              ) : (
                <ChevronRight size={13} className="ml-auto opacity-60" />
              )}
            </button>

            <button
              type="button"
              onClick={() => selectSpace('starred')}
              className={`jira-nav-item ${space === 'starred' ? 'is-active' : ''}`}
            >
              <Star size={15} className="shrink-0" />
              <span>Marcados como favoritos</span>
              {starredCount > 0 ? (
                <span className="jira-nav-count">{starredCount}</span>
              ) : (
                <ChevronRight size={13} className="ml-auto opacity-60" />
              )}
            </button>

            <button
              type="button"
              onClick={() => selectSpace('attention')}
              className={`jira-nav-item ${space === 'attention' ? 'is-active' : ''}`}
            >
              <Flag size={15} className="shrink-0" />
              <span>Necesita atención</span>
              {needsAttention.length > 0 && (
                <span className="jira-nav-count text-[#f87462]!">
                  {needsAttention.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('timeline');
                selectSpace('week');
              }}
              className={`jira-nav-item ${space === 'week' ? 'is-active' : ''}`}
            >
              <CalendarDays size={15} className="shrink-0" />
              <span>Planes</span>
            </button>
          </div>

          {/* Spaces Section (Jira Spaces / Areas) */}
          <div className="jira-nav-section">
            <div className="jira-nav-header">
              <button
                type="button"
                onClick={() => setSpacesExpanded(!spacesExpanded)}
                className="flex items-center gap-1.5 text-xs font-semibold jira-text-subtle hover:text-[var(--j-text)] bg-transparent border-0 p-0"
              >
                <Layers size={14} />
                <span>Espacio</span>
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => startTask()}
                  className="jira-text-subtle hover:text-[var(--j-text)] p-0.5 rounded"
                  title="Crear pendiente en espacio"
                >
                  <Plus size={14} />
                </button>
                <MoreHorizontal size={14} className="jira-text-subtle" />
              </div>
            </div>

            {spacesExpanded && (
              <div className="space-y-0.5 mt-1">
                <div className="px-2.5 py-1 text-[11px] font-semibold jira-text-subtle">
                  Recientes
                </div>
                <button
                  type="button"
                  onClick={() => selectSpace('kanban')}
                  className={`jira-nav-item ${space === 'kanban' ? 'is-active' : ''}`}
                >
                  <span
                    className="jira-space-avatar"
                    style={{ background: SPACE_COLORS.kanban }}
                  >
                    <Kanban size={12} />
                  </span>
                  <span className="truncate">Mi espacio de Kanban</span>
                </button>

                {areas.map((areaName) => {
                  const count = tasks.filter(
                    (t) => t.area === areaName && t.status !== 'done'
                  ).length;
                  return (
                    <button
                      key={areaName}
                      type="button"
                      onClick={() => selectSpace(areaName)}
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

          {/* Sidebar Footer Links matching Jira Screenshot */}
          <div className="mt-auto pt-3 border-t border-[var(--j-border)] space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('list');
                if (typeof window !== 'undefined' && window.innerWidth <= 768) {
                  setSidebarCollapsed(true);
                }
              }}
              className={`jira-nav-item ${activeTab === 'list' ? 'is-active' : ''}`}
            >
              <Filter size={15} className="shrink-0" />
              <span>Filtros</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('reports');
                if (typeof window !== 'undefined' && window.innerWidth <= 768) {
                  setSidebarCollapsed(true);
                }
              }}
              className={`jira-nav-item ${activeTab === 'reports' ? 'is-active' : ''}`}
            >
              <BarChart3 size={15} className="shrink-0" />
              <span>Paneles</span>
            </button>

            <Link href="/integrations" className="jira-nav-item">
              <Plug size={15} className="shrink-0" />
              <span>Integraciones y Bot</span>
            </Link>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="jira-nav-item"
            >
              <SlidersHorizontal size={15} className="shrink-0" />
              <span>Personalizar barra lateral</span>
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
                  <span>Espacio</span>
                </div>
                <div className="jira-space-title">
                  <span
                    className="w-6 h-6 rounded-md text-white text-xs font-bold grid place-items-center shrink-0"
                    style={{ background: currentSpaceColor }}
                  >
                    <Kanban size={14} />
                  </span>
                  <h1 className="text-lg sm:text-xl font-semibold truncate">
                    {currentSpaceTitle}
                  </h1>
                  <button
                    type="button"
                    onClick={() => {
                      setBudgetInput(String(budget));
                      setBudgetOpen(true);
                    }}
                    className="jira-icon-btn is-bordered ml-1"
                    title={`Capacidad hoy: ${plannedMinutes}/${budget} min`}
                  >
                    <Clock size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="jira-icon-btn"
                    title="Opciones del espacio"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              </div>

              {/* Right-side square bordered action buttons matching Jira screenshot */}
              <div className="jira-space-actions">
                <Link
                  href="/integrations"
                  className="jira-icon-btn is-bordered"
                  title="Conectar Telegram o API"
                >
                  <Share2 size={15} />
                </Link>

                <button
                  type="button"
                  onClick={openPlanner}
                  className="jira-icon-btn is-bordered"
                  title="Auto-planificar Top 3 del día"
                >
                  <Zap size={15} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextTask =
                      top.find((t) => t.status !== 'done') ||
                      tasks.find((t) => t.status !== 'done');
                    setFocusTaskId(nextTask?.id);
                    setFocusOpen(true);
                  }}
                  className="jira-icon-btn is-bordered"
                  title="Abrir Temporizador Pomodoro"
                >
                  <Timer size={15} />
                </button>

                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="jira-icon-btn is-bordered"
                  title={sidebarCollapsed ? 'Salir de pantalla completa' : 'Expandir lienzo'}
                >
                  {sidebarCollapsed ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
              </div>
            </div>

            {/* Horizontal Jira View Switcher Tabs */}
            <nav className="jira-tabs" aria-label="Vistas del espacio">
              <button
                type="button"
                onClick={() => setActiveTab('summary')}
                className={`jira-tab ${activeTab === 'summary' ? 'is-active' : ''}`}
              >
                <Globe size={14} />
                <span>Resumen</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className={`jira-tab ${activeTab === 'list' ? 'is-active' : ''}`}
              >
                <ListTodo size={14} />
                <span>Lista</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('board')}
                className={`jira-tab ${activeTab === 'board' ? 'is-active' : ''}`}
              >
                <Kanban size={14} />
                <span>Tablero</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`jira-tab ${activeTab === 'timeline' ? 'is-active' : ''}`}
              >
                <CalendarDays size={14} />
                <span>Cronograma</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('reports')}
                className={`jira-tab ${activeTab === 'reports' ? 'is-active' : ''}`}
              >
                <BarChart3 size={14} />
                <span>Informes</span>
              </button>

              <button
                type="button"
                onClick={() => startTask()}
                className="jira-tab px-2!"
                title="Crear nuevo elemento"
              >
                <Plus size={15} />
              </button>
            </nav>
          </div>

          {/* Board / List Sub-Toolbar (matches Jira screenshot: Search board, Avatars, Filtro, Grupo, right icons) */}
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

                {/* Filtro Dropdown */}
                <div className="relative inline-flex items-center">
                  <select
                    aria-label="Filtrar tareas"
                    value={quickFilter}
                    onChange={(e) => setQuickFilter(e.target.value as QuickFilter)}
                    className={`jira-btn-subtle cursor-pointer pr-3 ${
                      quickFilter !== 'all' ? 'is-active' : ''
                    }`}
                  >
                    <option value="all">≡ Filtro</option>
                    <option value="today">📅 Planificados hoy</option>
                    <option value="top">⭐ Favoritos (Top 3)</option>
                    <option value="attention">⚠️ Requiere atención</option>
                    <option value="p3">⏫ Prioridad Alta</option>
                    <option value="p2">🟰 Prioridad Media</option>
                    <option value="p1">⏬ Prioridad Baja</option>
                  </select>
                </div>

                {/* Grupo (Swimlanes) Dropdown */}
                {activeTab === 'board' && (
                  <div className="relative inline-flex items-center">
                    <select
                      aria-label="Agrupar tablero por"
                      value={groupBy}
                      onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                      className={`jira-btn-subtle cursor-pointer pr-3 ${
                        groupBy !== 'none' ? 'is-active' : ''
                      }`}
                    >
                      <option value="none">▤ Grupo</option>
                      <option value="area">▤ Grupo: Área</option>
                      <option value="priority">▤ Grupo: Prioridad</option>
                      <option value="project">▤ Grupo: Proyecto</option>
                    </select>
                  </div>
                )}

                {(onlyMyDay || quickFilter !== 'all' || query || groupBy !== 'none') && (
                  <button
                    type="button"
                    onClick={() => {
                      setOnlyMyDay(false);
                      setQuickFilter('all');
                      setQuery('');
                      setGroupBy('none');
                    }}
                    className="text-xs text-[#579dff] hover:underline font-medium px-1.5"
                  >
                    Restablecer
                  </button>
                )}
              </div>

              <div className="jira-subtoolbar-right">
                {activeTab === 'board' && (
                  <button
                    type="button"
                    onClick={() => setShowInboxColumn(!showInboxColumn)}
                    className={`jira-btn-subtle ${showInboxColumn ? 'is-active' : ''}`}
                    title="Separar u ocultar la columna Backlog (Bandeja de entrada)"
                  >
                    <Inbox size={14} />
                    <span>Backlog ({inboxCount})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveTab('reports')}
                  className="jira-icon-btn is-bordered"
                  title="Ver estadísticas e informes"
                >
                  <BarChart3 size={15} />
                </button>

                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="jira-icon-btn is-bordered"
                  title="Configuración de vista"
                >
                  <SlidersHorizontal size={15} />
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
                <Skeleton className="h-80 rounded-lg bg-[var(--j-bg-sunken)]" />
                <Skeleton className="h-80 rounded-lg bg-[var(--j-bg-sunken)]" />
                <Skeleton className="h-80 rounded-lg bg-[var(--j-bg-sunken)]" />
                <Skeleton className="h-80 rounded-lg bg-[var(--j-bg-sunken)]" />
              </div>
            ) : activeTab === 'board' ? (
              /* ==============================================================
                 TAB 3: TABLERO KANBAN (WITH DRAG & DROP + SWIMLANES)
                 ============================================================== */
              <div className="space-y-6">
                {/* Top 3 Banner when inside "Para ti (Mi día)" or "Favoritos" */}
                {(space === 'today' || space === 'starred') && (
                  <div className="jira-panel-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Star size={16} className="text-[#f5cd47] fill-[#f5cd47]" />
                        <h2 className="text-sm font-bold">
                          Tus 3 Prioridades del Día ({top.length}/3)
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={openPlanner}
                        className="text-xs font-semibold text-[#579dff] hover:underline flex items-center gap-1"
                      >
                        <Sparkles size={13} /> Proponer mi día ({plannedMinutes}/{budget}m)
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
                            className="border border-dashed border-[var(--j-border-input)] rounded-md p-4 flex flex-col items-center justify-center text-center hover:bg-[var(--j-bg-surface-hover)] transition-colors min-h-[86px]"
                          >
                            <Plus size={16} className="jira-text-subtle mb-1" />
                            <span className="text-xs font-semibold">
                              Prioridad 0{i + 1} disponible
                            </span>
                            <span className="text-[11px] jira-text-subtle">
                              Clic para elegir foco de hoy
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Mobile Column Quick-Switcher Pills (iOS Chrome / Mobile) */}
                <div className="jira-mobile-col-pills" role="tablist" aria-label="Filtrar columna en móvil">
                  <button
                    type="button"
                    onClick={() => setMobileCol('all')}
                    className={`jira-mobile-col-pill ${mobileCol === 'all' ? 'is-active' : ''}`}
                  >
                    <span>Todas</span>
                    <span className="opacity-75">({sortedTasks.length})</span>
                  </button>
                  {boardColumns.map((col) => {
                    const count = sortedTasks.filter((t) => {
                      if (col.status === 'todo' && !showInboxColumn && space !== 'inbox') {
                        return t.status === 'todo' || t.status === 'inbox';
                      }
                      return t.status === col.status;
                    }).length;
                    return (
                      <button
                        key={col.status}
                        type="button"
                        onClick={() => setMobileCol(col.status)}
                        className={`jira-mobile-col-pill ${
                          mobileCol === col.status ? 'is-active' : ''
                        }`}
                      >
                        <span>{col.label}</span>
                        <span className="opacity-75">({count})</span>
                      </button>
                    );
                  })}
                </div>

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
                          className="flex items-center gap-2 w-full py-1.5 px-3 rounded bg-[var(--j-bg-sunken)] border border-[var(--j-border)] hover:bg-[var(--j-bg-surface-hover)] text-xs font-bold uppercase tracking-wider"
                        >
                          {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                          <span>{lane.title}</span>
                          <span className="px-2 py-0.5 rounded-full bg-[var(--j-bg-surface)] jira-text-subtle text-[11px]">
                            {lane.tasks.length}
                          </span>
                        </button>
                      )}

                      {!isCollapsed && (
                        <div className="jira-board">
                          {boardColumns.map((col) => {
                            // CRITICAL LOGIC: When Backlog column is hidden (default 4-column board),
                            // 'To Do' column displays both 'todo' and 'inbox' tasks so nothing is ever hidden!
                            const colTasks = lane.tasks.filter((t) => {
                              if (
                                col.status === 'todo' &&
                                !showInboxColumn &&
                                space !== 'inbox'
                              ) {
                                return t.status === 'todo' || t.status === 'inbox';
                              }
                              return t.status === col.status;
                            });
                            const dropKey = `${lane.id}-${col.status}`;
                            const isWipExceeded =
                              col.status === 'doing' && colTasks.length > 3;
                            const hiddenOnMobile =
                              mobileCol !== 'all' && mobileCol !== col.status;

                            return (
                              <section
                                key={col.status}
                                onDragOver={(e) => handleColumnDragOver(e, dropKey)}
                                onDragLeave={() => setDragOverColumn(null)}
                                onDrop={(e) =>
                                  void handleColumnDrop(e, col.status, lane.overrides)
                                }
                                className={`jira-column ${
                                  hiddenOnMobile ? 'hidden md:flex' : ''
                                } ${
                                  mobileCol === col.status ? 'min-w-full! max-w-full!' : ''
                                } ${
                                  dragOverColumn === dropKey ? 'is-drag-over' : ''
                                } ${isWipExceeded ? 'ring-1 ring-amber-500/70' : ''}`}
                              >
                                <header className="jira-column-header">
                                  <div className="flex items-center min-w-0">
                                    <span className="truncate">{col.label}</span>
                                    <span className="jira-column-count">{colTasks.length}</span>
                                    {isWipExceeded && (
                                      <span
                                        className="ml-2 text-[10px] bg-amber-500/20 text-[#f5cd47] px-1.5 py-0.5 rounded font-bold"
                                        title="Límite WIP sugerido: máx 3 tareas en curso"
                                      >
                                        WIP
                                      </span>
                                    )}
                                  </div>
                                </header>

                                <div className="jira-column-body">
                                  {colTasks.map(renderJiraCard)}

                                  {/* Inline Column Quick Create Card */}
                                  {inlineCreateCol === col.status && groupBy === 'none' ? (
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        void handleInlineColumnCreate(col.status);
                                      }}
                                      className="jira-panel-card p-2.5 border-2! border-[var(--j-primary)]! space-y-2"
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
                                        className="w-full text-sm bg-transparent border-0 outline-none resize-none"
                                      />
                                      <div className="flex items-center justify-between pt-1">
                                        <span className="text-[11px] jira-text-subtle">
                                          Enter para crear
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => setInlineCreateCol(null)}
                                            className="px-2 py-1 text-xs jira-text-subtle hover:bg-[var(--j-bg-sunken)] rounded"
                                          >
                                            Cancelar
                                          </button>
                                          <button
                                            type="submit"
                                            className="jira-create-btn h-7! px-2.5! text-xs!"
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
                                      className="jira-column-create-btn"
                                      title={`Añadir elemento en ${col.label}`}
                                    >
                                      <Plus size={15} />
                                    </button>
                                  )}
                                </div>
                              </section>
                            );
                          })}

                          {/* Column Settings Gear Button on the right of columns (matching Jira screenshot) */}
                          <button
                            type="button"
                            onClick={() => setShowInboxColumn(!showInboxColumn)}
                            className="jira-icon-btn is-bordered shrink-0 mt-1"
                            title={
                              showInboxColumn
                                ? 'Ocultar columna Backlog'
                                : 'Mostrar columna Backlog separada'
                            }
                          >
                            <Settings size={15} />
                          </button>
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
                            className="inline-flex items-center gap-1 font-bold jira-text-subtle hover:text-[var(--j-text)]"
                          >
                            <span>Clave</span>
                            <ArrowUpDown size={12} />
                          </button>
                        </th>
                        <th>
                          <button
                            type="button"
                            onClick={() => toggleSort('title')}
                            className="inline-flex items-center gap-1 font-bold jira-text-subtle hover:text-[var(--j-text)]"
                          >
                            <span>Resumen</span>
                            <ArrowUpDown size={12} />
                          </button>
                        </th>
                        <th>
                          <button
                            type="button"
                            onClick={() => toggleSort('status')}
                            className="inline-flex items-center gap-1 font-bold jira-text-subtle hover:text-[var(--j-text)]"
                          >
                            <span>Estado</span>
                            <ArrowUpDown size={12} />
                          </button>
                        </th>
                        <th>Espacio / Área</th>
                        <th>Proyecto</th>
                        <th>
                          <button
                            type="button"
                            onClick={() => toggleSort('priority')}
                            className="inline-flex items-center gap-1 font-bold jira-text-subtle hover:text-[var(--j-text)]"
                          >
                            <span>Prioridad</span>
                            <ArrowUpDown size={12} />
                          </button>
                        </th>
                        <th>
                          <button
                            type="button"
                            onClick={() => toggleSort('minutes')}
                            className="inline-flex items-center gap-1 font-bold jira-text-subtle hover:text-[var(--j-text)]"
                          >
                            <span>Estimación</span>
                            <ArrowUpDown size={12} />
                          </button>
                        </th>
                        <th>
                          <button
                            type="button"
                            onClick={() => toggleSort('deadline')}
                            className="inline-flex items-center gap-1 font-bold jira-text-subtle hover:text-[var(--j-text)]"
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
                          <td colSpan={10} className="text-center py-12 jira-text-subtle">
                            No hay elementos que coincidan con los filtros actuales.
                          </td>
                        </tr>
                      ) : (
                        sortedTasks.map((t) => {
                          const key = taskKey(t, tasks);
                          const isStarred = Boolean(t.top);
                          const isOverdue =
                            Boolean(t.deadline && t.deadline < date && t.status !== 'done');
                          const checklist = parseChecklist(t.notes);

                          return (
                            <tr key={t.id} className={t.status === 'done' ? 'opacity-60' : ''}>
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
                                  <span
                                    className="jira-type-checkbox"
                                    style={{
                                      background:
                                        t.status === 'done'
                                          ? '#4bce97'
                                          : t.priority === 3
                                          ? '#e2483d'
                                          : '#4bade8',
                                    }}
                                  >
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
                                    className={`font-medium text-left hover:text-[#579dff] truncate ${
                                      t.status === 'done' ? 'line-through jira-text-subtle' : ''
                                    }`}
                                  >
                                    {t.title}
                                  </button>
                                  {checklist.total > 0 && (
                                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--j-bg-sunken)] jira-text-subtle shrink-0">
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
                                  className="text-xs font-medium bg-[var(--j-bg-sunken)] rounded px-2 py-1 border border-[var(--j-border)] cursor-pointer"
                                >
                                  {areas.map((a) => (
                                    <option key={a} value={a}>
                                      {a}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <span className="text-xs jira-text-subtle">
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
                                  className="text-xs font-medium bg-transparent border border-transparent hover:border-[var(--j-border)] rounded px-1.5 py-0.5 cursor-pointer"
                                >
                                  <option value="3">⏫ Alta</option>
                                  <option value="2">🟰 Media</option>
                                  <option value="1">⏬ Baja</option>
                                </select>
                              </td>
                              <td>
                                <span className="font-mono text-xs jira-text-subtle">
                                  {t.minutes} min
                                </span>
                              </td>
                              <td>
                                <div className="flex flex-col text-xs">
                                  {t.deadline && (
                                    <span
                                      className={
                                        isOverdue
                                          ? 'text-[#f87462] font-semibold'
                                          : 'jira-text-subtle'
                                      }
                                    >
                                      Vence: {dayLabel(t.deadline)}
                                    </span>
                                  )}
                                  {t.planDate && (
                                    <span className="jira-text-subtle">
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
                                      className="text-left text-[11px] text-[#579dff] hover:underline"
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
                                      className="p-1.5 rounded hover:bg-[var(--j-bg-sunken)] jira-text-subtle"
                                      title="Iniciar bloque Pomodoro"
                                    >
                                      <Timer size={14} />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => toggleTop(t)}
                                    className={`p-1.5 rounded hover:bg-[var(--j-bg-sunken)] ${
                                      isStarred ? 'text-[#f5cd47]' : 'jira-text-subtle'
                                    }`}
                                    title="Alternar Favorito / Top 3"
                                  >
                                    <Star size={14} fill={isStarred ? 'currentColor' : 'none'} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleting(t)}
                                    className="p-1.5 rounded hover:bg-[#f87462]/15 jira-text-subtle hover:text-[#f87462]"
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
                    className="flex items-center gap-3 px-4 py-2.5 bg-[var(--j-bg-sunken)] border-t border-[var(--j-border)]"
                  >
                    <Plus size={16} className="jira-text-subtle" />
                    <input
                      value={listQuickTitle}
                      onChange={(e) => setListQuickTitle(e.target.value)}
                      placeholder="Crear nuevo elemento en esta lista… (presioná Enter)"
                      className="flex-1 bg-transparent border-0 outline-none text-sm"
                    />
                    <button
                      type="submit"
                      disabled={!listQuickTitle.trim()}
                      className="jira-create-btn h-7! px-3! text-xs! disabled:opacity-40"
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
                  <div className="jira-panel-card p-4 flex items-center gap-3.5">
                    <span className="w-10 h-10 rounded-full bg-[#4bce97]/20 text-[#4bce97] grid place-items-center shrink-0">
                      <CheckCheck size={20} />
                    </span>
                    <div>
                      <div className="text-xl font-bold">
                        {spaceTasks.filter((t) => t.status === 'done').length} completadas
                      </div>
                      <div className="text-xs jira-text-subtle">en este espacio</div>
                    </div>
                  </div>

                  <div className="jira-panel-card p-4 flex items-center gap-3.5">
                    <span className="w-10 h-10 rounded-full bg-[#579dff]/20 text-[#579dff] grid place-items-center shrink-0">
                      <Play size={18} />
                    </span>
                    <div>
                      <div className="text-xl font-bold">
                        {spaceTasks.filter((t) => t.status === 'doing').length} en curso
                      </div>
                      <div className="text-xs jira-text-subtle">trabajando activamente</div>
                    </div>
                  </div>

                  <div className="jira-panel-card p-4 flex items-center gap-3.5">
                    <span className="w-10 h-10 rounded-full bg-[var(--j-bg-sunken)] jira-text-subtle grid place-items-center shrink-0">
                      <Inbox size={19} />
                    </span>
                    <div>
                      <div className="text-xl font-bold">
                        {
                          spaceTasks.filter(
                            (t) => t.status === 'todo' || t.status === 'inbox'
                          ).length
                        }{' '}
                        por hacer
                      </div>
                      <div className="text-xs jira-text-subtle">en cola y backlog</div>
                    </div>
                  </div>

                  <div className="jira-panel-card p-4 flex items-center gap-3.5">
                    <span className="w-10 h-10 rounded-full bg-[#f87462]/20 text-[#f87462] grid place-items-center shrink-0">
                      <AlertTriangle size={19} />
                    </span>
                    <div>
                      <div className="text-xl font-bold">
                        {spaceTasks.filter((t) => attention(t, date)).length} requieren atención
                      </div>
                      <div className="text-xs jira-text-subtle">vencidas o seguimiento</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Status Overview Card */}
                  <div className="jira-panel-card p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold">Resumen de estado</h3>
                        <p className="text-xs jira-text-subtle">
                          Instantánea del estado de tus elementos de trabajo.
                        </p>
                      </div>
                      <span className="text-xs font-bold jira-text-subtle">
                        {spaceTasks.length} totales
                      </span>
                    </div>

                    <div className="space-y-3">
                      {(
                        [
                          ['inbox', 'Backlog / Sin organizar', 'bg-slate-400'],
                          ['todo', 'To Do (Por hacer)', 'bg-[#8590a2]'],
                          ['doing', 'In Progress (En curso)', 'bg-[#579dff]'],
                          ['waiting', 'In Review (En revisión)', 'bg-[#f5cd47]'],
                          ['done', 'Done (Completado)', 'bg-[#4bce97]'],
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
                              <span className="font-medium">{label}</span>
                              <span className="jira-text-subtle">
                                {count} ({pct}%)
                              </span>
                            </div>
                            <div className="h-2 jira-track-bar rounded-full overflow-hidden">
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
                  <div className="jira-panel-card p-5 flex flex-col justify-between space-y-5">
                    <div>
                      <h3 className="text-sm font-bold mb-1">
                        Desglose de prioridad (Pendientes activos)
                      </h3>
                      <p className="text-xs jira-text-subtle mb-4">
                        Distribución de prioridades en este espacio.
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { p: 3, color: 'border-[#f87462]/30 bg-[#f87462]/10' },
                          { p: 2, color: 'border-[#fea362]/30 bg-[#fea362]/10' },
                          { p: 1, color: 'border-[#579dff]/30 bg-[#579dff]/10' },
                        ].map(({ p, color }) => {
                          const count = spaceTasks.filter(
                            (t) => t.status !== 'done' && t.priority === p
                          ).length;
                          return (
                            <div
                              key={p}
                              className={`border rounded-lg p-3 text-center ${color}`}
                            >
                              <PriorityIcon priority={p} showLabel />
                              <div className="text-2xl font-bold mt-1">
                                {count}
                              </div>
                              <div className="text-[11px] jira-text-subtle">pendientes</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[var(--j-border)]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold">
                          Presupuesto de Capacidad de Hoy ({dayLabel(date)})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setBudgetInput(String(budget));
                            setBudgetOpen(true);
                          }}
                          className="text-xs text-[#579dff] hover:underline font-semibold"
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
                      <p className="text-xs jira-text-subtle mt-1.5">
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
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[var(--j-border)]">
                  <div>
                    <h2 className="text-sm font-bold">
                      Cronograma y Planificación Temporal
                    </h2>
                    <p className="text-xs jira-text-subtle">
                      Arrastrá tareas entre los próximos 7 días o visualizá tus bloques de hoy por hora.
                    </p>
                  </div>
                  <div className="inline-flex bg-[var(--j-bg-sunken)] p-0.5 rounded-md border border-[var(--j-border)]">
                    <button
                      type="button"
                      onClick={() => setTimelineMode('week')}
                      className={`px-3 py-1 text-xs font-semibold rounded ${
                        timelineMode === 'week'
                          ? 'bg-[var(--j-bg-surface)] text-[#579dff] shadow-2xs'
                          : 'jira-text-subtle'
                      }`}
                    >
                      Semana (7 días)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimelineMode('timeboxing')}
                      className={`px-3 py-1 text-xs font-semibold rounded ${
                        timelineMode === 'timeboxing'
                          ? 'bg-[var(--j-bg-surface)] text-[#579dff] shadow-2xs'
                          : 'jira-text-subtle'
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
                              <span className={offset === 0 ? 'text-[#579dff]' : ''}>
                                {offset === 0
                                  ? 'Hoy'
                                  : offset === 1
                                  ? 'Mañana'
                                  : dayLabel(dStr)}
                              </span>
                              <span className="jira-column-count">{dayItems.length}</span>
                            </div>
                            <span className="text-[11px] font-normal jira-text-subtle">
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
                              className="jira-column-create-btn"
                              title={`Planificar el ${dayLabel(dStr)}`}
                            >
                              <Plus size={14} />
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
          4.5. MOBILE FIXED BOTTOM BAR (iOS Chrome & Mobile PWA)
         ==================================================================== */}
      <nav className="jira-mobile-nav" aria-label="Navegación móvil inferior">
        <button
          type="button"
          onClick={() => {
            setActiveTab('board');
            setSidebarCollapsed(true);
          }}
          className={`jira-mobile-nav-item ${
            activeTab === 'board' && space !== 'today' && sidebarCollapsed ? 'is-active' : ''
          }`}
        >
          <Kanban size={18} />
          <span>Tablero</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('list');
            setSidebarCollapsed(true);
          }}
          className={`jira-mobile-nav-item ${
            activeTab === 'list' && sidebarCollapsed ? 'is-active' : ''
          }`}
        >
          <ListTodo size={18} />
          <span>Lista</span>
        </button>

        <button
          type="button"
          onClick={() => startTask()}
          disabled={loading || auth}
          className="jira-mobile-nav-fab"
          aria-label="Crear nuevo pendiente"
        >
          <Plus size={20} className="stroke-[2.5]" />
        </button>

        <button
          type="button"
          onClick={() => {
            setSpace('today');
            setActiveTab('board');
            setSidebarCollapsed(true);
          }}
          className={`jira-mobile-nav-item ${
            space === 'today' && sidebarCollapsed ? 'is-active' : ''
          }`}
        >
          <UserCheck size={18} />
          <span>Para ti</span>
        </button>

        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={`jira-mobile-nav-item ${!sidebarCollapsed ? 'is-active' : ''}`}
        >
          <Layers size={18} />
          <span>Espacios</span>
        </button>
      </nav>

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
          className="max-w-4xl! w-[95vw]! max-h-[92dvh] overflow-y-auto p-0! jira-modal rounded-xl"
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
              <div className="flex items-center justify-between gap-2 px-6 py-3.5 border-b border-[var(--j-border)] bg-[var(--j-bg-sunken)]">
                <div className="flex items-center gap-2 text-xs font-semibold jira-text-subtle">
                  <span className="jira-type-checkbox">
                    <Check size={10} />
                  </span>
                  <span className="font-mono">{taskKey(edit, tasks)}</span>
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
                      <Timer size={13} className="text-[#579dff]" />
                      <span>Iniciar Pomodoro</span>
                    </button>
                  )}

                  {tasks.some((t) => t.id === edit.id) && (
                    <button
                      type="button"
                      onClick={() => setDeleting(edit)}
                      className="jira-btn-subtle text-[#f87462]! hover:bg-[#f87462]/15!"
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
                    ? `Editar ${taskKey(edit, tasks)}`
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
                      className="block text-xs font-bold uppercase jira-text-subtle mb-1.5"
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
                      className="jira-input w-full text-lg font-semibold px-3 py-2"
                    />
                  </div>

                  {/* Interactive Subtasks / Checklist Section */}
                  {(() => {
                    const cl = parseChecklist(edit.notes);
                    return (
                      <div className="border border-[var(--j-border)] rounded-lg p-3.5 bg-[var(--j-bg-sunken)] space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase jira-text-subtle flex items-center gap-1.5">
                            <CheckSquare size={14} className="text-[#579dff]" />
                            Subtareas / Checklist ({cl.done}/{cl.total})
                          </span>
                          {cl.total > 0 && (
                            <span className="text-xs font-semibold text-[#579dff]">
                              {Math.round((cl.done / cl.total) * 100)}%
                            </span>
                          )}
                        </div>

                        {cl.total > 0 && (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {cl.items.map((item) => (
                              <label
                                key={item.index}
                                className="flex items-center gap-2 text-xs bg-[var(--j-bg-surface)] p-2 rounded border border-[var(--j-border)] cursor-pointer hover:bg-[var(--j-bg-surface-hover)]"
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
                                  className="rounded"
                                />
                                <span
                                  className={
                                    item.checked ? 'line-through jira-text-subtle' : ''
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
                            className="jira-input flex-1 text-xs px-2.5 py-1.5"
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
                            className="jira-btn-subtle text-xs"
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
                      className="block text-xs font-bold uppercase jira-text-subtle mb-1.5"
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
                      className="jira-input w-full text-sm p-2.5"
                    />
                  </div>

                  {/* Gemini AI Smart Breakdown */}
                  <div className="p-3.5 bg-[#579dff]/10 border border-[#579dff]/30 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#579dff]">
                        <Sparkles size={15} />
                        <span>Asistente Gemini AI · Desglosar trabajo</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAiBreakdown}
                        disabled={aiBreakdownLoading || !edit.title.trim()}
                        className="jira-btn-subtle text-xs border-[#579dff]/40! text-[#579dff]! disabled:opacity-50"
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
                      <div className="space-y-2 pt-2 border-t border-[#579dff]/25">
                        <div className="space-y-1 max-h-36 overflow-y-auto">
                          {aiSubtasks.map((st, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs bg-[var(--j-bg-surface)] p-2 rounded border border-[var(--j-border)]"
                            >
                              <span className="font-medium truncate flex-1">
                                {idx + 1}. {st.title}
                              </span>
                              <span className="text-[11px] jira-text-subtle font-mono ml-2">
                                {st.minutes}m
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={appendSubtasksToNotes}
                            className="jira-create-btn flex-1 justify-center text-xs!"
                          >
                            Añadir al Checklist de esta tarea
                          </button>
                          <button
                            type="button"
                            onClick={applyAiSubtasks}
                            className="jira-btn-subtle text-xs"
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
                  <div className="border border-[var(--j-border)] rounded-lg p-4 bg-[var(--j-bg-sunken)] space-y-3.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider jira-text-subtle border-b border-[var(--j-border)] pb-2">
                      Detalles del elemento
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="task-status"
                          className="block text-xs font-semibold jira-text-subtle mb-1"
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
                          className="block text-xs font-semibold jira-text-subtle mb-1"
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
                          className="block text-xs font-semibold jira-text-subtle mb-1"
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
                          className="block text-xs font-semibold jira-text-subtle mb-1"
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
                          className="jira-input w-full h-[38px] px-3 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="task-project"
                        className="block text-xs font-semibold jira-text-subtle mb-1"
                      >
                        Proyecto / Épica (opcional)
                      </label>
                      <input
                        id="task-project"
                        maxLength={120}
                        value={edit.project ?? ''}
                        placeholder="Ej.: VentasRF, DevOps…"
                        onChange={(e) => setEdit({ ...edit, project: e.target.value })}
                        className="jira-input w-full h-[38px] px-3 text-xs"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="task-plan-date"
                          className="text-xs font-semibold jira-text-subtle"
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
                            className="text-[#579dff] hover:underline font-medium"
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
                            className="text-[#579dff] hover:underline font-medium"
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
                        className="jira-input w-full h-[38px] px-3 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="task-deadline"
                          className="block text-xs font-semibold jira-text-subtle mb-1"
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
                          className="jira-input w-full h-[38px] px-2.5 text-xs"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="task-follow-up"
                          className="block text-xs font-semibold jira-text-subtle mb-1"
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
                          className="jira-input w-full h-[38px] px-2.5 text-xs"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 pt-1 cursor-pointer text-xs font-semibold">
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
                        className="rounded"
                      />
                      <Star size={14} className="text-[#f5cd47]" />
                      <span>Marcar como favorito (Top 3)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-6 py-3.5 border-t border-[var(--j-border)] bg-[var(--j-bg-sunken)]">
                <span className="text-xs jira-text-subtle">
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
        <DialogContent className="plan-dialog jira-modal">
          <DialogHeader>
            <DialogTitle>Armemos un día posible</DialogTitle>
            <DialogDescription className="jira-text-subtle">
              Priorizamos vencimientos, tareas en curso y prioridad. Elegí hasta{' '}
              {Math.max(0, 3 - top.length)} más para tu Top 3.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between p-3 rounded-lg bg-[#579dff]/15 text-[#579dff] text-sm font-medium">
            <span>
              {plannedMinutes + addedMinutes} / {budget} min del día
            </span>
            <b>
              {selected.length + top.length} / 3 prioridades
            </b>
          </div>

          {plannedMinutes + addedMinutes > budget && (
            <p className="text-xs text-[#f87462] font-medium">
              La selección supera tu tiempo disponible. Quitá tareas o ajustá tu capacidad.
            </p>
          )}

          <div className="candidate-list divide-y divide-[var(--j-border)]">
            {candidates.length ? (
              candidates.map((t) => (
                <label key={t.id} className="flex items-center gap-3 py-3 cursor-pointer">
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
                  <span className="min-w-0 flex-1">
                    <b className="text-sm font-medium block truncate">
                      <span className="font-mono text-xs jira-text-subtle mr-1.5">
                        {taskKey(t, tasks)}
                      </span>
                      {t.title}
                    </b>
                    <small className="text-xs jira-text-subtle block mt-0.5">
                      {reason(t, date)} · {t.area} · {t.minutes} min
                    </small>
                  </span>
                </label>
              ))
            ) : (
              <p className="text-xs jira-text-subtle py-4">
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
        <DialogContent className="jira-modal">
          <DialogHeader>
            <DialogTitle>Tu capacidad disponible hoy</DialogTitle>
            <DialogDescription className="jira-text-subtle">
              Definí cuántos minutos reales podés dedicar hoy a tus pendientes.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
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
            <div>
              <label className="block text-xs font-semibold jira-text-subtle mb-1.5">
                Minutos disponibles hoy
              </label>
              <input
                type="number"
                required
                min={0}
                max={1440}
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="jira-input w-full px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[60, 120, 180, 240, 360].map((n) => (
                <button
                  type="button"
                  className="jira-btn-subtle text-xs"
                  key={n}
                  onClick={() => setBudgetInput(String(n))}
                >
                  {n} min ({n / 60}h)
                </button>
              ))}
            </div>
            <button className="jira-create-btn w-full justify-center" disabled={busy}>
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
        <AlertDialogContent className="jira-modal">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este elemento?</AlertDialogTitle>
            <AlertDialogDescription className="jira-text-subtle">
              Se eliminará “{deleting?.title}”. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="jira-btn-subtle" disabled={busy}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#e2483d] hover:bg-[#c9372c] text-white"
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
                  toast.success('Elemento eliminado.');
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

      <Toaster position="bottom-right" theme={theme} richColors closeButton />
    </div>
  );
}
