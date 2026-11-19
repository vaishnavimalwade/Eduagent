import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyMutation, loadData, saveData, initStore, clearStore,
  type AppData, type Course, type Task, type Project, type Session, type Chat, type Mutation,
} from "@/lib/edu-store";
import { askCoach } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { StudyView } from "./StudyView";
import { ScheduleView, RemindersView, FocusMode, useReminderAlerts } from "./NewViews";

export const nav = [
  ["dashboard", "Dashboard", "D"],
  ["tasks", "Smart Tasks", "T"],
  ["schedule", "Daily Schedule", "S"],
  ["planner", "Daily Planner", "P"],
  ["calendar", "Calendar", "C"],
  ["reminders", "Reminders", "!"],
  ["focus", "Focus Mode", "F"],
  ["study", "Flashcards & Quizzes", "Q"],
  ["projects", "Project Tracker (PBL)", "R"],
  ["coach", "AI Study Coach", "AI"],
  ["analytics", "Academic Analytics", "A"],
  ["settings", "Account Settings", "⚙"],
] as const;
export const sections = nav.map((n) => n[0]) as string[];

const courseOf = (task: { course: Course | string }, courses: Course[]) =>
  typeof task.course === 'object'
    ? task.course
    : courses.find((course) => course.id === task.course)

const timeLeft = (iso: string) => {
  const hours = Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000)
  if (hours < 0) return `${Math.abs(hours)}h overdue`
  if (hours < 48) return `${hours}h left`
  return `${Math.ceil(hours / 24)}d left`
}

export default function Workspace({ initialSection }: { initialSection: string }) {
  const navigate = useNavigate()
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState('')
  const [sidebar, setSidebar] = useState(false)
  const [dark, setDark] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [taskDue, setTaskDue] = useState('')
  const [coachContext, setCoachContext] = useState('')

  const load = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser()
      const u = auth.user
      if (!u) return
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', u.id).maybeSingle()
      const next = await initStore({ id: u.id, email: u.email ?? '', name: profile?.display_name ?? (u.user_metadata?.['full_name'] as string | undefined) ?? u.email?.split('@')[0] ?? 'Student' })
      setData(next)
      const theme = next.preferences?.[0]?.theme
      setDark(theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches))
    } catch {
      setError("We couldn't load your workspace. Please retry.")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const mutate = async (body: object) => {
    const current = loadData()
    const next = applyMutation(current, body as Mutation)
    saveData(next)
    setData(next)
  }
  useReminderAlerts(data, mutate)

  const openCoach = (task: Task) => {
    setCoachContext(
      `Assignment: ${task.title}\nDue: ${new Date(task.dueAt).toLocaleString()}\nEstimated effort: ${task.estimatedHours} hours\nBrief: ${task.description || 'No brief provided.'}`,
    )
    navigate({ to: '/app/$section', params: { section: 'coach' } })
  }

  const signOut = async () => {
    clearStore()
    await supabase.auth.signOut()
    navigate({ to: '/auth', replace: true })
  }

  const openTask = (due = '') => {
    setTaskDue(due)
    setTaskOpen(true)
  }

  if (!data) return <LoadingState error={error} retry={load} />

  const toggleTheme = async () => {
    const next = !dark
    setDark(next)
    const preference = data.preferences[0]
    if (preference)
      await mutate({
        action: 'update',
        collection: 'preferences',
        id: preference.id,
        data: { theme: next ? 'dark' : 'light' },
      })
  }

  const pending = data.tasks.filter((task) => task.status !== 'completed')
  const highRisk = pending.filter(
    (task) => new Date(task.dueAt).getTime() - Date.now() < 48 * 3_600_000,
  )
  const unread = data.notifications.filter((notice) => !notice.read)

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen bg-[#f4f5f1] text-[#1c2721] transition-colors dark:bg-[#101713] dark:text-[#edf2ee]">
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[278px] flex-col bg-[#18251f] px-4 py-5 text-white transition-transform lg:translate-x-0 ${sidebar ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="flex items-center justify-between px-2">
            <Link to="/app/$section" params={{ section: 'dashboard' }} className="flex items-center gap-3 font-bold">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#c8f169] text-[#17241e]">
                E
              </span>
              <span>EduAgent</span>
            </Link>
            <button
              onClick={() => setSidebar(false)}
              className="rounded-lg p-2 text-white/60 lg:hidden"
              aria-label="Close navigation"
            >
              ×
            </button>
          </div>
          <nav className="mt-8 space-y-1" aria-label="Primary navigation">
            {nav.map(([slug, label, icon]) => (
              <Link
                key={slug}
                to="/app/$section" params={{ section: slug }}
                onClick={() => setSidebar(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${initialSection === slug ? 'bg-white/12 font-semibold text-white' : 'text-white/58 hover:bg-white/7 hover:text-white'}`}
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-lg text-[11px] font-bold ${initialSection === slug ? 'bg-[#c8f169] text-[#17241e]' : 'bg-white/7 text-white/70'}`}
                >
                  {icon}
                </span>
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-bold text-[#c8f169]">Weekly focus</p>
            <div className="mt-2 flex items-end justify-between">
              <strong className="text-xl">{studyHours(data['study-sessions'])}h</strong>
              <span className="text-xs text-white/45">of {data.user.weeklyGoalHours ?? 18}h</span>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#c8f169] transition-all duration-700"
                style={{
                  width: `${Math.min(100, (studyHours(data['study-sessions']) / (data.user.weeklyGoalHours ?? 18)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </aside>

        <div className="lg:pl-[278px]">
          <header className="sticky top-0 z-30 flex h-[74px] items-center justify-between border-b border-[#dfe3dc] bg-[#f4f5f1]/90 px-4 backdrop-blur-xl dark:border-white/8 dark:bg-[#101713]/90 sm:px-7">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebar(true)}
                className="rounded-xl border border-[#d8ddd6] bg-white px-3 py-2 lg:hidden dark:border-white/10 dark:bg-white/5"
                aria-label="Open navigation"
              >
                Menu
              </button>
              <div className="hidden rounded-full bg-[#eaf4d2] px-3 py-1.5 text-xs font-bold text-[#3d5d26] sm:block">
                {data.user.streak ?? 0} day streak
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openTask()}
                className="rounded-xl bg-[#1c2922] px-3.5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#314038] sm:text-sm"
              >
                + <span className="hidden sm:inline">Quick add task</span>
              </button>
              <button
                onClick={() => void toggleTheme()}
                className="grid h-10 w-10 place-items-center rounded-xl border border-[#d8ddd6] bg-white text-xs font-bold dark:border-white/10 dark:bg-white/5"
                aria-label="Toggle color theme"
              >
                {dark ? 'L' : 'D'}
              </button>
              <details className="relative">
                <summary
                  className="relative grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl border border-[#d8ddd6] bg-white text-xs font-bold dark:border-white/10 dark:bg-white/5"
                  aria-label="Notifications"
                >
                  N
                  {unread.length > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#dc5c4d] px-1 text-[10px] text-white">
                      {unread.length}
                    </span>
                  )}
                </summary>
                <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-[#dce1da] bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#1b241f]">
                  <p className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#879089]">
                    Notifications
                  </p>
                  {data.notifications.length ? (
                    data.notifications.slice(0, 5).map((notice) => (
                      <button
                        key={notice.id}
                        onClick={() =>
                          mutate({
                            action: 'update',
                            collection: 'notifications',
                            id: notice.id,
                            data: { read: true },
                          })
                        }
                        className="block w-full rounded-xl px-3 py-3 text-left hover:bg-[#f3f5f1] dark:hover:bg-white/5"
                      >
                        <strong className="block text-sm">{notice.title}</strong>
                        <span className="mt-1 block text-xs text-[#78827c]">{notice.message}</span>
                      </button>
                    ))
                  ) : (
                    <p className="p-4 text-sm text-[#78827c]">You're all caught up.</p>
                  )}
                </div>
              </details>
              <div className="ml-1 hidden items-center gap-2 sm:flex">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#dbcfff] text-xs font-bold text-[#4c3b8f]">
                  {data.user.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)}
                </span>
                <div className="hidden xl:block">
                  <strong className="block text-xs">{data.user.name}</strong>
                  <span className="text-[10px] text-[#7d8881]">
                    {data.user.isDemo ? 'Demo student' : 'Student'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => void signOut()}
                className="rounded-lg px-2 py-2 text-xs font-semibold text-[#78827c] hover:text-red-600"
              >
                Sign out
              </button>
            </div>
          </header>

          <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9">
            {initialSection === 'dashboard' && (
              <Dashboard
                data={data}
                pending={pending}
                highRisk={highRisk}
                onAdd={() => openTask()}
                onCoach={openCoach}
              />
            )}
            {initialSection === 'tasks' && (
              <TasksView data={data} mutate={mutate} onAdd={() => openTask()} onCoach={openCoach} />
            )}
            {initialSection === 'planner' && <Planner data={data} mutate={mutate} />}
            {initialSection === 'schedule' && <ScheduleView data={data} mutate={mutate} />}
            {initialSection === 'reminders' && <RemindersView data={data} mutate={mutate} />}
            {initialSection === 'study' && <StudyView data={data} mutate={mutate} />}
            {initialSection === 'focus' && <FocusMode data={data} mutate={mutate} />}
            {initialSection === 'calendar' && (
              <CalendarView data={data} onAdd={(due) => openTask(due)} mutate={mutate} />
            )}
            {initialSection === 'projects' && (
              <ProjectsView data={data} mutate={mutate} aiConfigured={data.aiConfigured} />
            )}
            {initialSection === 'coach' && (
              <Coach
                data={data}
                context={coachContext}
                setContext={setCoachContext}
                mutate={mutate}
              />
            )}
            {initialSection === 'analytics' && <Analytics data={data} />}
            {initialSection === 'settings' && (
              <Settings data={data} dark={dark} setDark={setDark} mutate={mutate} />
            )}
          </main>
        </div>
        {sidebar && (
          <button
            onClick={() => setSidebar(false)}
            className="fixed inset-0 z-40 bg-black/35 lg:hidden"
            aria-label="Close navigation overlay"
          />
        )}
        {taskOpen && (
          <TaskDialog
            courses={data.courses}
            initialDue={taskDue}
            onClose={() => setTaskOpen(false)}
            onSave={async (task) => {
              await mutate({ action: 'create', collection: 'tasks', data: task })
              setTaskOpen(false)
            }}
          />
        )}
      </div>
    </div>
  )
}

function Heading({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow: string
  title: string
  copy: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#76847b]">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#758078]">{copy}</p>
      </div>
      {action}
    </div>
  )
}

function Dashboard({
  data,
  pending,
  highRisk,
  onAdd,
  onCoach,
}: {
  data: AppData
  pending: Task[]
  highRisk: Task[]
  onAdd: () => void
  onCoach: (task: Task) => void
}) {
  const sessions = data['study-sessions']
  const hours = studyHours(sessions)
  const goal = data.user.weeklyGoalHours ?? 18
  const urgent = [...pending].sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt))[0]
  const milestones = data.projects
    .flatMap((project) => project.milestones ?? [])
    .filter((milestone) => !milestone.completed)
  return (
    <>
      <Heading
        eyebrow="Academic command center"
        title={`Good ${dayPart()}, ${data.user.name.split(' ')[0]}.`}
        copy="Your week is moving well. Resolve the deadline risk below to keep your plan on track."
        action={
          <button
            onClick={onAdd}
            className="rounded-xl border border-[#d7ddd6] bg-white px-4 py-2.5 text-sm font-bold shadow-sm dark:border-white/10 dark:bg-white/5"
          >
            Plan something new
          </button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
        <MetricCard
          className="xl:col-span-3"
          label="Pending tasks"
          value={String(pending.length)}
          note={`${pending.filter((t) => t.priority === 'high').length} high priority`}
          accent="#6758D9"
        />
        <MetricCard
          className="xl:col-span-3"
          label="High-risk deadlines"
          value={String(highRisk.length)}
          note="within the next 48 hours"
          accent="#D85F50"
          warning
        />
        <section className="card p-5 md:col-span-2 xl:col-span-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="card-label">Weekly study goal</p>
              <p className="mt-2 text-3xl font-semibold">
                {hours} <span className="text-base font-normal text-[#8a948e]">/ {goal} hours</span>
              </p>
            </div>
            <div className="grid h-16 w-16 place-items-center rounded-full border-[7px] border-[#ddebba] text-sm font-bold text-[#49652f]">
              {Math.min(100, Math.round((hours / goal) * 100))}%
            </div>
          </div>
          <div className="mt-5 h-2 rounded-full bg-[#e5e8e2] dark:bg-white/10">
            <div
              className="h-full rounded-full bg-[#91b74c] transition-all duration-1000"
              style={{ width: `${Math.min(100, (hours / goal) * 100)}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-[#7a857e]">
            {Math.max(0, goal - hours).toFixed(1)} focused hours to reach this week's target.
          </p>
        </section>
        <section className="card p-5 md:col-span-1 xl:col-span-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="card-label">Active project milestones</p>
              <h2 className="mt-2 text-xl font-semibold">{milestones.length} steps in motion</h2>
            </div>
            <Link to="/app/$section" params={{ section: 'projects' }} className="text-xs font-bold text-[#526b5d]">
              View projects →
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {milestones.slice(0, 3).map((item) => (
              <div key={`${item.title}-${item.deadline}`} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[#9887e8]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-[#879089]">
                    Due {new Date(item.deadline).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="relative overflow-hidden rounded-2xl bg-[#1b2b23] p-6 text-white shadow-sm md:col-span-1 xl:col-span-7">
          <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-[#c8f169]/10 blur-2xl" />
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#c8f169]">
            Next recommended action
          </p>
          {urgent ? (
            <>
              <h2 className="relative mt-4 text-2xl font-semibold">{urgent.title}</h2>
              <p className="relative mt-2 max-w-xl text-sm leading-6 text-white/58">
                {urgent.description ||
                  'This task has the nearest deadline in your active workload.'}
              </p>
              <div className="relative mt-5 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-red-400/15 px-3 py-1.5 text-xs font-bold text-red-200">
                  {timeLeft(urgent.dueAt)}
                </span>
                <button
                  onClick={() => onCoach(urgent)}
                  className="rounded-xl bg-[#c8f169] px-4 py-2.5 text-xs font-bold text-[#17241e]"
                >
                  Ask AI Coach
                </button>
              </div>
            </>
          ) : (
            <p className="mt-4 text-white/65">
              All active work is complete. Add a task to keep planning.
            </p>
          )}
        </section>
      </div>
      <section className="card mt-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="card-label">Today at a glance</p>
            <h2 className="mt-1 text-xl font-semibold">A focused, achievable day</h2>
          </div>
          <Link to="/app/$section" params={{ section: 'planner' }} className="text-xs font-bold">
            Open planner →
          </Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {(['morning', 'afternoon', 'evening'] as const).map((slot) => {
            const task = data.tasks.find(
              (item) => item.plannerSlot === slot && item.status !== 'completed',
            )
            return (
              <div key={slot} className="rounded-xl bg-[#f4f5f1] p-4 dark:bg-white/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8b948e]">
                  {slot}
                </p>
                <p className="mt-2 text-sm font-semibold">{task?.title ?? 'Open focus block'}</p>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}

function MetricCard({
  label,
  value,
  note,
  accent,
  warning,
  className,
}: {
  label: string
  value: string
  note: string
  accent: string
  warning?: boolean
  className?: string
}) {
  return (
    <section className={`card p-5 ${className ?? ''}`}>
      <div className="flex items-start justify-between">
        <span
          className="grid h-10 w-10 place-items-center rounded-xl text-xs font-bold text-white"
          style={{ backgroundColor: accent }}
        >
          {warning ? '!' : '↗'}
        </span>
        <span className="text-xs text-[#89928d]">This week</span>
      </div>
      <p className="mt-6 text-4xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs text-[#89928d]">{note}</p>
    </section>
  )
}

function TasksView({
  data,
  mutate,
  onAdd,
  onCoach,
}: {
  data: AppData
  mutate: (body: object) => Promise<void>
  onAdd: () => void
  onCoach: (task: Task) => void
}) {
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [search, setSearch] = useState('')
  const [course, setCourse] = useState('all')
  const [priority, setPriority] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('due')
  const [editing, setEditing] = useState<Task | null>(null)
  const filtered = useMemo(
    () =>
      data.tasks
        .filter(
          (task) =>
            task.title.toLowerCase().includes(search.toLowerCase()) &&
            (course === 'all' || courseOf(task, data.courses)?.id === course) &&
            (priority === 'all' || task.priority === priority) &&
            (status === 'all' || task.status === status),
        )
        .sort((a, b) =>
          sort === 'due'
            ? +new Date(a.dueAt) - +new Date(b.dueAt)
            : sort === 'priority'
              ? { high: 0, medium: 1, low: 2 }[a.priority] -
                { high: 0, medium: 1, low: 2 }[b.priority]
              : a.title.localeCompare(b.title),
        ),
    [data, search, course, priority, status, sort],
  )
  return (
    <>
      <Heading
        eyebrow="Smart Tasks"
        title="Turn deadlines into momentum."
        copy="Search, filter, and move work through a clear academic workflow."
        action={
          <button onClick={onAdd} className="primary-button">
            + New task
          </button>
        }
      />
      <div className="card mb-5 flex flex-wrap gap-2 p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assignments…"
          className="min-w-[210px] flex-1 rounded-xl bg-[#f3f5f1] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#667b6f]/20 dark:bg-white/5"
        />
        <Select
          value={course}
          onChange={setCourse}
          options={[['all', 'All courses'], ...data.courses.map((item) => [item.id, item.name])]}
        />
        <Select
          value={priority}
          onChange={setPriority}
          options={[
            ['all', 'All priorities'],
            ['high', 'High'],
            ['medium', 'Medium'],
            ['low', 'Low'],
          ]}
        />
        <Select
          value={status}
          onChange={setStatus}
          options={[
            ['all', 'All statuses'],
            ['todo', 'To Do'],
            ['progress', 'In Progress'],
            ['completed', 'Completed'],
          ]}
        />
        <Select
          value={sort}
          onChange={setSort}
          options={[
            ['due', 'Sort: Due date'],
            ['priority', 'Sort: Priority'],
            ['title', 'Sort: Title'],
          ]}
        />
        <div className="flex rounded-xl bg-[#eef0ec] p-1 dark:bg-white/5">
          <button
            onClick={() => setView('kanban')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${view === 'kanban' ? 'bg-white shadow-sm dark:bg-white/10' : 'text-[#879089]'}`}
          >
            Board
          </button>
          <button
            onClick={() => setView('list')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${view === 'list' ? 'bg-white shadow-sm dark:bg-white/10' : 'text-[#879089]'}`}
          >
            List
          </button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <Empty
          title="No tasks match"
          copy="Adjust the filters or create a new assignment."
          action={onAdd}
        />
      ) : view === 'kanban' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {(['todo', 'progress', 'completed'] as const).map((column) => (
            <section key={column} className="rounded-2xl bg-[#e9ece6]/70 p-3 dark:bg-white/[.03]">
              <div className="flex items-center justify-between px-2 py-2">
                <h2 className="text-sm font-bold">
                  {column === 'todo'
                    ? 'To Do'
                    : column === 'progress'
                      ? 'In Progress'
                      : 'Completed'}
                </h2>
                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold dark:bg-white/10">
                  {filtered.filter((task) => task.status === column).length}
                </span>
              </div>
              <div className="mt-1 space-y-3">
                {filtered
                  .filter((task) => task.status === column)
                  .map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      courses={data.courses}
                      mutate={mutate}
                      edit={() => setEditing(task)}
                      coach={() => onCoach(task)}
                    />
                  ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 border-b border-[#e5e8e2] px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-[#879089] md:grid">
            <span>Task</span>
            <span>Course</span>
            <span>Due</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {filtered.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              courses={data.courses}
              mutate={mutate}
              edit={() => setEditing(task)}
              coach={() => onCoach(task)}
            />
          ))}
        </div>
      )}
      {editing && (
        <TaskDialog
          courses={data.courses}
          task={editing}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            await mutate({ action: 'update', collection: 'tasks', id: editing.id, data: values })
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

function TaskCard({
  task,
  courses,
  mutate,
  edit,
  coach,
}: {
  task: Task
  courses: Course[]
  mutate: (body: object) => Promise<void>
  edit: () => void
  coach: () => void
}) {
  const course = courseOf(task, courses)
  const risky = task.status !== 'completed' && +new Date(task.dueAt) - Date.now() < 48 * 3_600_000
  return (
    <article className="rounded-2xl border border-[#e1e5df] bg-white p-4 shadow-sm dark:border-white/8 dark:bg-[#1a231e]">
      <div className="flex items-center justify-between gap-2">
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-bold"
          style={{
            backgroundColor: `${course?.color ?? '#777'}18`,
            color: course?.color ?? '#777',
          }}
        >
          {course?.code || course?.name || 'Course'}
        </span>
        {risky && (
          <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 dark:bg-red-500/10">
            {timeLeft(task.dueAt)}
          </span>
        )}
      </div>
      <h3
        className={`mt-4 font-semibold leading-5 ${task.status === 'completed' ? 'text-[#8b948f] line-through' : ''}`}
      >
        {task.title}
      </h3>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#7d8881]">{task.description}</p>
      <div className="mt-4 flex items-center justify-between text-[11px] text-[#7d8881]">
        <span>
          {new Date(task.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ·{' '}
          {task.estimatedHours}h
        </span>
        <span className="capitalize">{task.priority}</span>
      </div>
      <div className="mt-4 flex gap-2 border-t border-[#edf0eb] pt-3 dark:border-white/7">
        <button
          onClick={coach}
          className="flex-1 rounded-lg bg-[#edf4dc] px-2 py-2 text-[11px] font-bold text-[#4e672f]"
        >
          Ask AI Coach
        </button>
        <button onClick={edit} className="rounded-lg px-2 text-xs font-bold text-[#79847d]">
          Edit
        </button>
        <button
          onClick={() => {
            if (confirm('Delete this task?'))
              void mutate({ action: 'delete', collection: 'tasks', id: task.id })
          }}
          className="rounded-lg px-2 text-xs font-bold text-red-500"
        >
          Delete
        </button>
      </div>
      <select
        aria-label="Change task status"
        value={task.status}
        onChange={(e) =>
          mutate({
            action: 'update',
            collection: 'tasks',
            id: task.id,
            data: { status: e.target.value },
          })
        }
        className="mt-2 w-full rounded-lg bg-[#f4f5f1] px-2 py-2 text-[11px] font-bold dark:bg-white/5"
      >
        <option value="todo">To Do</option>
        <option value="progress">In Progress</option>
        <option value="completed">Completed</option>
      </select>
    </article>
  )
}

function TaskRow({ task, courses, mutate, edit, coach }: Parameters<typeof TaskCard>[0]) {
  const course = courseOf(task, courses)
  return (
    <div className="grid gap-3 border-b border-[#edf0eb] px-5 py-4 last:border-0 md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-center dark:border-white/7">
      <div>
        <strong className="text-sm">{task.title}</strong>
        <p className="mt-1 text-xs text-[#879089]">
          {task.priority} priority · {task.estimatedHours}h
        </p>
      </div>
      <span className="text-xs font-semibold" style={{ color: course?.color }}>
        {course?.name}
      </span>
      <span className="text-xs">{timeLeft(task.dueAt)}</span>
      <select
        value={task.status}
        onChange={(e) =>
          mutate({
            action: 'update',
            collection: 'tasks',
            id: task.id,
            data: { status: e.target.value },
          })
        }
        className="rounded-lg bg-[#f2f4f0] px-2 py-2 text-xs dark:bg-white/5"
      >
        <option value="todo">To Do</option>
        <option value="progress">In Progress</option>
        <option value="completed">Completed</option>
      </select>
      <div className="flex gap-2">
        <button onClick={coach} className="text-xs font-bold text-[#547038]">
          AI
        </button>
        <button onClick={edit} className="text-xs font-bold">
          Edit
        </button>
        <button
          onClick={() => {
            if (confirm('Delete this task?'))
              void mutate({ action: 'delete', collection: 'tasks', id: task.id })
          }}
          className="text-xs font-bold text-red-500"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

function TaskDialog({
  courses,
  task,
  initialDue = '',
  onClose,
  onSave,
}: {
  courses: Course[]
  task?: Task
  initialDue?: string
  onClose: () => void
  onSave: (data: object) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-title"
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          setSaving(true)
          const form = new FormData(event.currentTarget)
          await onSave(Object.fromEntries(form))
          setSaving(false)
        }}
        className="max-h-[92vh] w-full max-w-xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#1a231e]"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="card-label">{task ? 'Edit assignment' : 'Quick add'}</p>
            <h2 id="task-title" className="mt-1 text-2xl font-semibold">
              {task ? 'Refine task details' : 'Create a smart task'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-[#f1f3ef]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <FormField
            name="title"
            label="Task title"
            defaultValue={task?.title}
            required
            className="sm:col-span-2"
          />
          <label className="form-label">
            Course
            <select
              name="course"
              required
              defaultValue={task?.course}
              className="form-input"
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  ● {course.name}
                </option>
              ))}
            </select>
          </label>
          <FormField
            name="dueAt"
            label="Due date & time"
            type="datetime-local"
            defaultValue={
              task?.dueAt
                ? new Date(new Date(task.dueAt).getTime() - new Date().getTimezoneOffset() * 60_000)
                    .toISOString()
                    .slice(0, 16)
                : initialDue
            }
            required
          />
          <FormField
            name="estimatedHours"
            label="Estimated study hours"
            type="number"
            min="0.25"
            step="0.25"
            defaultValue={task?.estimatedHours ?? 1}
            required
          />
          <label className="form-label">
            Priority
            <select
              name="priority"
              defaultValue={task?.priority ?? 'medium'}
              className="form-input"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="form-label">
            Status
            <select name="status" defaultValue={task?.status ?? 'todo'} className="form-input">
              <option value="todo">To Do</option>
              <option value="progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="form-label">
            Planner slot
            <select
              name="plannerSlot"
              defaultValue={task?.plannerSlot ?? ''}
              className="form-input"
            >
              <option value="">Unscheduled</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </select>
          </label>
          <label className="form-label sm:col-span-2">
            Description
            <textarea
              name="description"
              defaultValue={task?.description}
              rows={4}
              className="form-input resize-none"
              placeholder="Brief, rubric notes, or a clear definition of done…"
            />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="secondary-button">
            Cancel
          </button>
          <button disabled={saving} className="primary-button">
            {saving ? 'Saving…' : task ? 'Save changes' : 'Create task'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Planner({ data, mutate }: { data: AppData; mutate: (body: object) => Promise<void> }) {
  const pref = data.preferences[0]
  const [mode, setMode] = useState<'focus' | 'short' | 'long'>('focus')
  const durations = {
    focus: pref?.focusMinutes ?? 25,
    short: pref?.shortBreakMinutes ?? 5,
    long: pref?.longBreakMinutes ?? 15,
  }
  const [seconds, setSeconds] = useState(durations.focus * 60)
  const [running, setRunning] = useState(false)
  useEffect(() => {
    if (!running) return
    const timer = setInterval(
      () =>
        setSeconds((value) => {
          if (value <= 1) {
            clearInterval(timer)
            setRunning(false)
            if (mode === 'focus') {
              void mutate({
                action: 'create',
                collection: 'study-sessions',
                data: { startedAt: new Date().toISOString(), minutes: durations.focus },
              })
              try {
                new Audio(
                  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
                ).play()
              } catch {}
            }
            return 0
          }
          return value - 1
        }),
      1000,
    )
    return () => clearInterval(timer)
  }, [running, mode])
  const changeMode = (next: typeof mode) => {
    setMode(next)
    setSeconds(durations[next] * 60)
    setRunning(false)
  }
  const total = durations[mode] * 60
  return (
    <>
      <Heading
        eyebrow="Daily planner"
        title="Shape a day you can finish."
        copy="Assign tasks to energy-aware time blocks, then protect your attention with focused sessions."
      />
      <div className="grid gap-5 xl:grid-cols-[1.45fr_.75fr]">
        <section className="space-y-4">
          {(['morning', 'afternoon', 'evening'] as const).map((slot, index) => (
            <div key={slot} className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="card-label">
                    {['08:00 – 12:00', '12:00 – 17:00', '17:00 – 21:00'][index]}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold capitalize">{slot}</h2>
                </div>
                <span className="rounded-full bg-[#f0f2ee] px-3 py-1 text-xs font-bold dark:bg-white/5">
                  {
                    data.tasks.filter(
                      (task) => task.plannerSlot === slot && task.status !== 'completed',
                    ).length
                  }{' '}
                  tasks
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {data.tasks
                  .filter((task) => task.plannerSlot === slot && task.status !== 'completed')
                  .map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 rounded-xl border border-[#e7eae5] p-3 dark:border-white/7"
                    >
                      <button
                        onClick={() =>
                          mutate({
                            action: 'update',
                            collection: 'tasks',
                            id: task.id,
                            data: { status: 'completed' },
                          })
                        }
                        className="h-5 w-5 rounded-full border-2 border-[#a9b4ad]"
                        aria-label="Complete task"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{task.title}</p>
                        <p className="text-xs text-[#879089]">
                          {task.estimatedHours}h · {courseOf(task, data.courses)?.name}
                        </p>
                      </div>
                      <select
                        value={task.plannerSlot}
                        onChange={(e) =>
                          mutate({
                            action: 'update',
                            collection: 'tasks',
                            id: task.id,
                            data: { plannerSlot: e.target.value },
                          })
                        }
                        className="rounded-lg bg-[#f2f4f0] px-2 py-1.5 text-xs dark:bg-white/5"
                      >
                        <option value="morning">Morning</option>
                        <option value="afternoon">Afternoon</option>
                        <option value="evening">Evening</option>
                      </select>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </section>
        <aside className="card h-fit p-6 xl:sticky xl:top-24">
          <div className="flex rounded-xl bg-[#eef0ec] p-1 dark:bg-white/5">
            {(['focus', 'short', 'long'] as const).map((item) => (
              <button
                key={item}
                onClick={() => changeMode(item)}
                className={`flex-1 rounded-lg px-2 py-2 text-[10px] font-bold capitalize ${mode === item ? 'bg-white shadow-sm dark:bg-white/10' : 'text-[#849087]'}`}
              >
                {item === 'short' ? 'Short break' : item === 'long' ? 'Long break' : 'Focus'}
              </button>
            ))}
          </div>
          <div className="relative mx-auto mt-8 h-60 w-60">
            <svg viewBox="0 0 100 100" className="-rotate-90">
              <circle
                cx="50"
                cy="50"
                r="43"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-[#e4e8e1] dark:text-white/10"
              />
              <circle
                cx="50"
                cy="50"
                r="43"
                fill="none"
                stroke="#91b74c"
                strokeWidth="4"
                strokeLinecap="round"
                pathLength="100"
                strokeDasharray="100"
                strokeDashoffset={100 - (seconds / total) * 100}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-5xl font-semibold tabular-nums">
                  {String(Math.floor(seconds / 60)).padStart(2, '0')}:
                  {String(seconds % 60).padStart(2, '0')}
                </p>
                <p className="mt-2 text-xs font-bold uppercase tracking-wider text-[#879089]">
                  {running ? 'Stay with it' : mode}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-7 flex justify-center gap-3">
            <button onClick={() => setRunning(!running)} className="primary-button min-w-24">
              {running ? 'Pause' : 'Start'}
            </button>
            <button
              onClick={() => {
                setRunning(false)
                setSeconds(total)
              }}
              className="secondary-button"
            >
              Reset
            </button>
          </div>
          <p className="mt-6 text-center text-xs leading-5 text-[#879089]">
            Completed focus sessions are automatically added to study history, goals, and streak
            analytics.
          </p>
        </aside>
      </div>
    </>
  )
}

function CalendarView({ data, onAdd }: { data: AppData; onAdd: (due: string) => void; mutate?: (body: object) => Promise<void> }) {
  const [mode, setMode] = useState<'month' | 'week'>('month')
  const [selected, setSelected] = useState(new Date())
  const first = new Date(selected.getFullYear(), selected.getMonth(), 1)
  const days = Array.from({ length: mode === 'month' ? 42 : 7 }, (_, index) =>
    mode === 'month'
      ? new Date(first.getFullYear(), first.getMonth(), index - first.getDay() + 1)
      : new Date(
          selected.getFullYear(),
          selected.getMonth(),
          selected.getDate() - selected.getDay() + index,
        ),
  )
  const selectedTasks = data.tasks.filter(
    (task) => new Date(task.dueAt).toDateString() === selected.toDateString(),
  )
  const selectedReminders = data.reminders.filter(
    (r) => new Date(r.remindAt).toDateString() === selected.toDateString(),
  )
  const selectedRoutine = data.schedules
    .filter((s) => s.days.includes(selected.getDay()))
    .sort((a, b) => a.time.localeCompare(b.time))
  return (
    <>
      <Heading
        eyebrow="Calendar & reminders"
        title="See pressure before it builds."
        copy="Assignments, exams, and milestones share one color-coded academic timeline."
        action={
          <button
            onClick={() =>
              onAdd(
                `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}T17:00`,
              )
            }
            className="primary-button"
          >
            + Add on selected date
          </button>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6e9e4] p-5 dark:border-white/7">
            <div>
              <h2 className="text-xl font-semibold">
                {selected.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </h2>
              <p className="mt-1 text-xs text-[#879089]">Select a day to inspect scheduled work</p>
            </div>
            <div className="flex rounded-xl bg-[#eef0ec] p-1 dark:bg-white/5">
              <button
                onClick={() => setMode('month')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === 'month' ? 'bg-white shadow-sm dark:bg-white/10' : ''}`}
              >
                Month
              </button>
              <button
                onClick={() => setMode('week')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === 'week' ? 'bg-white shadow-sm dark:bg-white/10' : ''}`}
              >
                Week
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-[#e6e9e4] text-center text-[10px] font-bold uppercase tracking-wider text-[#879089] dark:border-white/7">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <span key={day} className="py-3">
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const events = data.tasks.filter(
                (task) => new Date(task.dueAt).toDateString() === day.toDateString(),
              )
              const active = day.toDateString() === selected.toDateString()
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelected(day)}
                  className={`min-h-24 border-b border-r border-[#edf0eb] p-2 text-left transition hover:bg-[#f5f6f3] dark:border-white/6 dark:hover:bg-white/5 sm:min-h-28 ${active ? 'bg-[#eef5dd] dark:bg-[#c8f169]/8' : ''}`}
                >
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${day.toDateString() === new Date().toDateString() ? 'bg-[#1c2922] text-white' : ''}`}
                  >
                    {day.getDate()}
                  </span>
                  <div className="mt-2 space-y-1">
                    {data.reminders.filter((r) => !r.done && new Date(r.remindAt).toDateString() === day.toDateString()).slice(0, 1).map((r) => (
                      <div key={r.id} className="truncate rounded bg-[#f3d36b] px-1.5 py-1 text-[9px] font-bold text-[#4a3a05]">
                        ⏰ {r.title}
                      </div>
                    ))}
                    {events.slice(0, 2).map((task) => {
                      const course = courseOf(task, data.courses)
                      return (
                        <div
                          key={task.id}
                          className="truncate rounded px-1.5 py-1 text-[9px] font-bold text-white"
                          style={{ backgroundColor: course?.color }}
                        >
                          {task.title}
                        </div>
                      )
                    })}
                  </div>
                </button>
              )
            })}
          </div>
        </section>
        <aside className="space-y-5">
          <section className="card p-5">
            <p className="card-label">
              {selected.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </p>
            <h2 className="mt-2 text-xl font-semibold">Scheduled work</h2>
            <div className="mt-4 space-y-3">
              {selectedTasks.length ? (
                selectedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="border-l-2 pl-3"
                    style={{ borderColor: courseOf(task, data.courses)?.color }}
                  >
                    <p className="text-sm font-semibold">{task.title}</p>
                    <p className="mt-1 text-xs text-[#879089]">
                      {new Date(task.dueAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-xl bg-[#f4f5f1] p-4 text-sm text-[#879089] dark:bg-white/5">
                  No deadlines. This is a good focus or recovery day.
                </p>
              )}
            </div>
          </section>
          <section className="card p-5">
            <p className="card-label">Reminders & routine</p>
            <div className="mt-4 space-y-3">
              {selectedReminders.map((r) => (
                <div key={r.id} className="border-l-2 border-[#e0b93b] pl-3">
                  <p className={`text-sm font-semibold ${r.done ? 'line-through text-[#879089]' : ''}`}>⏰ {r.title}</p>
                  <p className="mt-1 text-xs text-[#879089]">
                    {new Date(r.remindAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
              {selectedRoutine.map((s) => (
                <div key={s.id} className="flex justify-between text-xs">
                  <span className="font-semibold">{s.title}</span>
                  <span className="text-[#879089]">{s.time}</span>
                </div>
              ))}
              {!selectedReminders.length && !selectedRoutine.length && (
                <p className="text-sm text-[#879089]">Nothing scheduled.</p>
              )}
            </div>
          </section>
          <section className="card p-5">
            <p className="card-label">Upcoming deadlines</p>
            <div className="mt-4 space-y-4">
              {data.tasks
                .filter((task) => task.status !== 'completed' && +new Date(task.dueAt) > Date.now())
                .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt))
                .slice(0, 6)
                .map((task) => (
                  <div key={task.id} className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: courseOf(task, data.courses)?.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{task.title}</p>
                      <p className="text-xs text-[#879089]">{timeLeft(task.dueAt)}</p>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </aside>
      </div>
    </>
  )
}

function ProjectsView({
  data,
  mutate,
  aiConfigured,
}: {
  data: AppData
  mutate: (body: object) => Promise<void>
  aiConfigured: boolean
}) {
  const [busy, setBusy] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [milestoneFor, setMilestoneFor] = useState<string | null>(null)
  const [msTitle, setMsTitle] = useState('')
  const [msDate, setMsDate] = useState('')
  const [notice, setNotice] = useState('')

  const update = (project: Project, patch: Partial<Project>) =>
    mutate({ action: 'update', collection: 'projects', id: project.id, data: patch })

  const toggle = (project: Project, index: number) => {
    const milestones = [...(project.milestones ?? [])]
    const current = milestones[index]
    if (!current) return
    milestones[index] = { ...current, completed: !current.completed }
    return update(project, { milestones })
  }
  const removeMilestone = (project: Project, index: number) =>
    update(project, { milestones: (project.milestones ?? []).filter((_, i) => i !== index) })

  const addMilestone = async (project: Project) => {
    if (!msTitle.trim() || !msDate) return
    const milestones = [
      ...(project.milestones ?? []),
      { title: msTitle.trim(), deadline: new Date(`${msDate}T17:00:00`).toISOString(), completed: false },
    ].sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline))
    await update(project, { milestones })
    setMsTitle('')
    setMsDate('')
    setMilestoneFor(null)
  }

  const breakdown = async (project: Project) => {
    setBusy(project.id)
    setNotice('')
    try {
      const result = await askCoach({
        data: {
          message:
            'Break this project into 5 concise milestones. Return one milestone per line, no numbering, no extra text.',
          context: `${project.title}\n${project.description}`,
        },
      })
      if ('error' in result && result.error) throw new Error(result.error)
      const lines = String((result as { answer: string }).answer)
        .split('\n')
        .map((line) => line.replace(/^[-*#\d.)\s]+/, '').replace(/\*\*/g, '').trim())
        .filter(Boolean)
        .slice(0, 5)
      if (!lines.length) throw new Error('No milestones were suggested. Try again.')
      const span = Math.max(+new Date(project.targetDate) - Date.now(), 86_400_000 * 5) / lines.length
      const milestones = lines.map((title, i) => ({
        title,
        deadline: new Date(Date.now() + span * (i + 1)).toISOString(),
        completed: false,
      }))
      await update(project, { milestones })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'AI breakdown failed')
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <Heading
        eyebrow="Project tracker · PBL"
        title="Make big work feel smaller."
        copy="Track project-based learning work, papers, builds, and capstones through meaningful milestones."
        action={
          <button onClick={() => setCreating(true)} className="primary-button">
            + New project
          </button>
        }
      />
      {notice && (
        <p className="mb-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          {notice}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {data.projects.length ? (
          data.projects.map((project) => {
            const items = project.milestones ?? []
            const complete = items.filter((item) => item.completed).length
            const progress = items.length ? Math.round((complete / items.length) * 100) : 0
            const course = courseOf(project, data.courses)
            const color = course?.color ?? '#91b74c'
            return (
              <article key={project.id} className="card overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="rounded-full px-3 py-1 text-[10px] font-bold"
                      style={{ backgroundColor: `${color}18`, color }}
                    >
                      {course?.name ?? 'General'} · {project.type.replace('-', ' ')}
                    </span>
                    <span className="text-xs text-[#879089]">
                      Target {new Date(project.targetDate).toLocaleDateString()}
                    </span>
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold">{project.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#78837c]">{project.description}</p>
                  <div className="mt-5 flex items-center justify-between text-xs">
                    <span className="font-bold">{progress}% complete</span>
                    <span className="text-[#879089]">
                      {complete}/{items.length} milestones · {timeLeft(project.targetDate)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[#e7eae5] dark:bg-white/10">
                    <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: color }} />
                  </div>
                </div>
                <div className="border-t border-[#e8ebe6] p-4 dark:border-white/7">
                  {items.length === 0 && (
                    <p className="p-2 text-sm text-[#879089]">No milestones yet. Add one or let AI break it down.</p>
                  )}
                  {items.map((item, index) => (
                    <div
                      key={`${item.title}-${index}`}
                      className="group flex w-full items-center gap-3 rounded-xl p-2 hover:bg-[#f4f5f1] dark:hover:bg-white/5"
                    >
                      <button
                        onClick={() => toggle(project, index)}
                        aria-label="Toggle milestone"
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border text-xs ${item.completed ? 'border-[#75933e] bg-[#91b74c] text-white' : 'border-[#b7c0ba]'}`}
                      >
                        {item.completed ? '✓' : ''}
                      </button>
                      <span className={`min-w-0 flex-1 text-sm font-semibold ${item.completed ? 'text-[#8d9690] line-through' : ''}`}>
                        {item.title}
                      </span>
                      <span className="text-[10px] text-[#8d9690]">
                        {new Date(item.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      <button
                        onClick={() => removeMilestone(project, index)}
                        className="text-xs text-[#a0a9a3] opacity-0 hover:text-red-600 group-hover:opacity-100"
                        aria-label="Remove milestone"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {milestoneFor === project.id && (
                    <div className="mt-3 grid gap-2 rounded-xl bg-[#f4f5f1] p-3 sm:grid-cols-[1fr_150px_auto] dark:bg-white/5">
                      <input value={msTitle} onChange={(e) => setMsTitle(e.target.value)} placeholder="Milestone title" className="form-input mt-0" autoFocus />
                      <input type="date" value={msDate} onChange={(e) => setMsDate(e.target.value)} className="form-input mt-0" />
                      <button onClick={() => addMilestone(project)} className="primary-button">Add</button>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setMilestoneFor(milestoneFor === project.id ? null : project.id)
                        setMsDate(new Date(project.targetDate).toISOString().slice(0, 10))
                      }}
                      className="secondary-button flex-1"
                    >
                      + Milestone
                    </button>
                    <button
                      onClick={() => breakdown(project)}
                      disabled={!aiConfigured || busy === project.id}
                      className="primary-button flex-1"
                    >
                      {busy === project.id ? 'Thinking…' : 'AI Breakdown'}
                    </button>
                    <button onClick={() => setEditing(project)} className="secondary-button">Edit</button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${project.title}"?`))
                          void mutate({ action: 'delete', collection: 'projects', id: project.id })
                      }}
                      className="secondary-button text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            )
          })
        ) : (
          <Empty title="No active projects" copy="Create your first project to start tracking milestones." action={() => setCreating(true)} />
        )}
      </div>
      {(creating || editing) && (
        <ProjectDialog
          courses={data.courses}
          initial={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSave={async (values) => {
            if (editing) await update(editing, values)
            else await mutate({ action: 'create', collection: 'projects', data: { ...values, milestones: [] } })
            setCreating(false)
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

function ProjectDialog({
  courses,
  initial,
  onClose,
  onSave,
}: {
  courses: Course[]
  initial: Project | null
  onClose: () => void
  onSave: (values: Omit<Project, 'id' | 'milestones'>) => Promise<void>
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [course, setCourse] = useState(initial?.course ?? courses[0]?.id ?? '')
  const [type, setType] = useState(initial?.type ?? 'semester-project')
  const [date, setDate] = useState(
    (initial ? new Date(initial.targetDate) : new Date(Date.now() + 30 * 86_400_000)).toISOString().slice(0, 10),
  )
  const [err, setErr] = useState('')
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim()) return setErr('Give the project a title.')
          void onSave({ title: title.trim(), description: description.trim(), course, type, targetDate: new Date(`${date}T17:00:00`).toISOString() })
        }}
        className="card w-full max-w-lg space-y-4 p-6"
      >
        <h2 className="text-xl font-semibold">{initial ? 'Edit project' : 'New project'}</h2>
        <label className="form-label">Title<input value={title} onChange={(e) => setTitle(e.target.value)} className="form-input" autoFocus /></label>
        <label className="form-label">Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="form-input" /></label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="form-label">Course
            <select value={course} onChange={(e) => setCourse(e.target.value)} className="form-input">
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="form-label">Type
            <select value={type} onChange={(e) => setType(e.target.value)} className="form-input">
              <option value="semester-project">Semester project</option>
              <option value="pbl">PBL</option>
              <option value="research-paper">Research paper</option>
              <option value="capstone">Capstone</option>
              <option value="group-project">Group project</option>
            </select>
          </label>
          <label className="form-label">Target date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="form-input" /></label>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="secondary-button">Cancel</button>
          <button className="primary-button">{initial ? 'Save' : 'Create project'}</button>
        </div>
      </form>
    </div>
  )
}

function Coach({
  data,
  context,
  setContext,
  mutate,
}: {
  data: AppData
  context: string
  setContext: (value: string) => void
  mutate: (body: object) => Promise<void>
}) {
  const [message, setMessage] = useState(context)
  const [sending, setSending] = useState(false)
  const [local, setLocal] = useState<Chat[]>([])
  const chats = [...[...data['chat-messages']].reverse(), ...local]
  const send = async (prompt?: string) => {
    const content = prompt || message
    if (!content.trim()) return
    setSending(true)
    setLocal((items) => [...items, { id: `local-u-${Date.now()}`, role: 'user', content }])
    setMessage('')
    setContext('')
    try {
      const history = data['chat-messages'].map((c) => ({ role: c.role, content: c.content }))
      const result = await askCoach({ data: { message: content, context, history } })
      if ('error' in result && result.error) throw new Error(result.error)
      await mutate({ action: 'create', collection: 'chat-messages', data: { role: 'user', content } })
      await mutate({ action: 'create', collection: 'chat-messages', data: { role: 'assistant', content: (result as { answer: string }).answer } })
      setLocal([])
    } catch (error) {
      setLocal((items) => [
        ...items,
        {
          id: `local-e-${Date.now()}`,
          role: 'assistant',
          content: error instanceof Error ? error.message : 'The coach is unavailable.',
        },
      ])
    } finally {
      setSending(false)
    }
  }
  return (
    <>
      <Heading
        eyebrow="AI Study Coach"
        title="Think through it, don't just push through it."
        copy="Ask for concept explanations, revision plans, or a realistic breakdown of your next assignment."
      />
      <div className="grid min-h-[680px] gap-5 xl:grid-cols-[290px_1fr]">
        <aside className="card hidden p-5 xl:block">
          <p className="card-label">Quick prompts</p>
          <div className="mt-4 space-y-2">
            {[
              'Explain eigenvalues using a real-world analogy',
              'Create a three-step exam revision plan',
              'Turn my assignment brief into daily tasks',
              'Quiz me on graph traversal',
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => void send(prompt)}
                className="w-full rounded-xl border border-[#e5e9e3] p-3 text-left text-xs font-semibold leading-5 hover:border-[#aebbaa] hover:bg-[#f5f7f2] dark:border-white/8 dark:hover:bg-white/5"
              >
                {prompt}
              </button>
            ))}
          </div>
          <div
            className={`mt-6 rounded-xl p-4 text-xs leading-5 ${data.aiConfigured ? 'bg-[#edf5df] text-[#4d672f]' : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'}`}
          >
            {data.aiConfigured
              ? 'AI coach is active. Chat history is saved on this device.'
              : 'AI coach is offline.'}
          </div>
        </aside>
        <section className="card flex min-h-[680px] flex-col overflow-hidden">
          <div className="border-b border-[#e7eae5] px-5 py-4 dark:border-white/7">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#c8f169] text-xs font-bold text-[#1d2b23]">
                AI
              </span>
              <div>
                <h2 className="text-sm font-bold">EduAgent Coach</h2>
                <p className="text-xs text-[#879089]">Academic planning and concept support</p>
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-4 overflow-auto p-5">
            {chats.length === 0 && (
              <div className="mx-auto mt-20 max-w-md text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#edf5df] text-lg font-bold text-[#4d672f]">
                  AI
                </div>
                <h3 className="mt-5 text-xl font-semibold">What are you working through?</h3>
                <p className="mt-2 text-sm leading-6 text-[#7e8982]">
                  Share a difficult concept, exam date, or assignment brief. I'll help you find a
                  clear next step.
                </p>
              </div>
            )}
            {chats.slice(-20).map((chat) => (
              <div
                key={chat.id}
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${chat.role === 'user' ? 'ml-auto bg-[#1c2922] text-white' : 'bg-[#f0f2ee] text-[#27342d] dark:bg-white/7 dark:text-white'}`}
              >
                <Markdown text={chat.content} />
              </div>
            ))}
            {sending && (
              <div className="w-fit rounded-2xl bg-[#f0f2ee] px-4 py-3 text-sm text-[#7e8982] dark:bg-white/7">
                Thinking through your question…
              </div>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
            className="border-t border-[#e7eae5] p-4 dark:border-white/7"
          >
            <div className="flex gap-2 rounded-2xl border border-[#dce2da] bg-[#f8f9f6] p-2 focus-within:border-[#829489] dark:border-white/10 dark:bg-white/5">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                placeholder="Ask about a concept, exam, or assignment…"
                className="min-h-14 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none"
              />
              <button
                disabled={sending}
                className="self-end rounded-xl bg-[#1c2922] px-4 py-3 text-xs font-bold text-white"
              >
                Send
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  )
}

function Analytics({ data }: { data: AppData }) {
  const sessions = data['study-sessions']
  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    return {
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      value: sessions
        .filter((s) => new Date(s.startedAt).toDateString() === date.toDateString())
        .reduce((sum, s) => sum + s.minutes / 60, 0),
    }
  })
  const total = studyHours(sessions)
  const completed = data.tasks.filter((task) => task.status === 'completed').length
  const rate = data.tasks.length ? Math.round((completed / data.tasks.length) * 100) : 0
  const productive = [...daily].sort((a, b) => b.value - a.value)[0]
  const priorities = ['high', 'medium', 'low'].map((priority) => ({
    priority,
    count: data.tasks.filter((task) => task.status !== 'completed' && task.priority === priority)
      .length,
  }))
  return (
    <>
      <Heading
        eyebrow="Academic analytics"
        title="See the habits behind your outcomes."
        copy="Every chart updates from your completed tasks and logged focus sessions."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total weekly study"
          value={`${total}h`}
          note="from completed focus sessions"
          accent="#6758D9"
        />
        <MetricCard
          label="Most productive day"
          value={productive?.label ?? '—'}
          note={`${productive?.value.toFixed(1) ?? 0} focused hours`}
          accent="#0EA5A4"
        />
        <MetricCard
          label="Assignment completion"
          value={`${rate}%`}
          note={`${completed} of ${data.tasks.length} tasks completed`}
          accent="#91B74C"
        />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_.8fr]">
        <section className="card p-6">
          <p className="card-label">Weekly study hours vs daily target</p>
          <div className="mt-8 flex h-64 items-end justify-between gap-3 border-b border-[#dfe4dc]">
            {daily.map((day) => (
              <div
                key={day.label}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <span className="text-xs font-bold">{day.value.toFixed(1)}h</span>
                <div
                  className="relative w-full max-w-12 rounded-t-lg bg-[#7869d8] transition-all duration-700"
                  style={{
                    height: `${Math.max(4, (day.value / Math.max(4, ...daily.map((item) => item.value))) * 85)}%`,
                  }}
                >
                  <span className="absolute inset-x-0 border-t border-dashed border-[#c8f169]" />
                </div>
                <span className="pb-3 text-[10px] font-bold uppercase text-[#879089]">
                  {day.label}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="card p-6">
          <p className="card-label">Priority workload</p>
          <div className="mt-7 space-y-5">
            {priorities.map((item) => (
              <div key={item.priority}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold capitalize">{item.priority}</span>
                  <span>{item.count} tasks</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-[#e8ebe6] dark:bg-white/10">
                  <div
                    className={`h-full rounded-full ${item.priority === 'high' ? 'bg-[#d85f50]' : item.priority === 'medium' ? 'bg-[#e3aa49]' : 'bg-[#5da88d]'}`}
                    style={{
                      width: `${data.tasks.length ? (item.count / data.tasks.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="card p-6 xl:col-span-2">
          <p className="card-label">Course-wise completion</p>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {data.courses.map((course) => {
              const tasks = data.tasks.filter(
                (task) => courseOf(task, data.courses)?.id === course.id,
              )
              const done = tasks.filter((task) => task.status === 'completed').length
              const percentage = tasks.length ? Math.round((done / tasks.length) * 100) : 0
              return (
                <div key={course.id} className="rounded-xl bg-[#f4f5f1] p-4 dark:bg-white/5">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: course.color }}
                    />
                    <strong className="text-sm">{course.name}</strong>
                  </div>
                  <p className="mt-4 text-3xl font-semibold">{percentage}%</p>
                  <p className="mt-1 text-xs text-[#879089]">
                    {done} of {tasks.length} assignments
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </>
  )
}

function Settings({
  data,
  dark,
  setDark,
  mutate,
}: {
  data: AppData
  dark: boolean
  setDark: (value: boolean) => void
  mutate: (body: object) => Promise<void>
}) {
  const pref = data.preferences[0]
  const updateTheme = async (theme: string) => {
    setDark(theme === 'dark')
    if (pref)
      await mutate({ action: 'update', collection: 'preferences', id: pref.id, data: { theme } })
  }
  return (
    <>
      <Heading
        eyebrow="Account settings"
        title="Make EduAgent work your way."
        copy="Manage appearance, focus timing, and your secure student profile."
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <section className="card p-6">
          <p className="card-label">Profile</p>
          <div className="mt-5 flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#dbcfff] text-lg font-bold text-[#4c3b8f]">
              {data.user.name
                .split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)}
            </span>
            <div>
              <h2 className="text-xl font-semibold">{data.user.name}</h2>
              <p className="text-sm text-[#7e8982]">{data.user.email}</p>
              {data.user.isDemo && (
                <span className="mt-2 inline-block rounded-full bg-[#edf5df] px-2 py-1 text-[10px] font-bold text-[#557037]">
                  Demo workspace
                </span>
              )}
            </div>
          </div>
        </section>
        <section className="card p-6">
          <p className="card-label">Appearance</p>
          <h2 className="mt-2 text-xl font-semibold">Theme preference</h2>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={() => updateTheme('light')}
              className={`rounded-xl border p-4 text-left ${!dark ? 'border-[#6f826f] bg-[#f2f6ed]' : 'border-[#e0e5de] dark:border-white/10'}`}
            >
              <span className="block text-sm font-bold">Light</span>
              <span className="text-xs text-[#879089]">Bright academic canvas</span>
            </button>
            <button
              onClick={() => updateTheme('dark')}
              className={`rounded-xl border p-4 text-left ${dark ? 'border-[#91b74c] bg-white/5' : 'border-[#e0e5de]'}`}
            >
              <span className="block text-sm font-bold">Dark</span>
              <span className="text-xs text-[#879089]">Low-light focus mode</span>
            </button>
          </div>
        </section>
        <section className="card p-6 lg:col-span-2">
          <p className="card-label">Pomodoro durations</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const values = Object.fromEntries(new FormData(e.currentTarget))
              if (pref)
                await mutate({
                  action: 'update',
                  collection: 'preferences',
                  id: pref.id,
                  data: values,
                })
            }}
            className="mt-5 grid gap-4 sm:grid-cols-3"
          >
            <FormField
              label="Focus minutes"
              name="focusMinutes"
              type="number"
              min="1"
              max="120"
              defaultValue={pref?.focusMinutes ?? 25}
            />
            <FormField
              label="Short break"
              name="shortBreakMinutes"
              type="number"
              min="1"
              max="30"
              defaultValue={pref?.shortBreakMinutes ?? 5}
            />
            <FormField
              label="Long break"
              name="longBreakMinutes"
              type="number"
              min="1"
              max="60"
              defaultValue={pref?.longBreakMinutes ?? 15}
            />
            <button className="primary-button sm:col-start-3">Save timer settings</button>
          </form>
        </section>
      </div>
    </>
  )
}

function LoadingState({ error, retry }: { error: string; retry: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f5f1] p-6">
      {error ? (
        <div className="text-center">
          <h1 className="text-xl font-bold">Workspace unavailable</h1>
          <p className="mt-2 text-sm text-[#78827c]">{error}</p>
          <button onClick={retry} className="primary-button mt-5">
            Retry
          </button>
        </div>
      ) : (
        <div className="text-center">
          <span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-[#dce2da] border-t-[#5a705f]" />
          <p className="mt-4 text-sm font-semibold text-[#78827c]">
            Preparing your academic workspace…
          </p>
        </div>
      )}
    </main>
  )
}

function Empty({ title, copy, action }: { title: string; copy: string; action?: () => void }) {
  return (
    <div className="card col-span-full p-12 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-[#879089]">{copy}</p>
      {action && (
        <button onClick={action} className="primary-button mt-5">
          Create a task
        </button>
      )}
    </div>
  )
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: string[][]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl bg-[#f2f4f0] px-3 py-2.5 text-xs font-bold outline-none dark:bg-white/5"
    >
      {options.map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  )
}

function FormField({
  label,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`form-label ${className}`}>
      {label}
      <input {...props} className="form-input" />
    </label>
  )
}

function Markdown({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g)
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('```') ? (
          <pre
            key={index}
            className="my-2 overflow-auto rounded-lg bg-[#111a15] p-3 text-xs text-[#d9eddd]"
          >
            <code>{part.replace(/^```\w*\n?/, '').replace(/```$/, '')}</code>
          </pre>
        ) : (
          <span key={index} className="whitespace-pre-wrap">
            {part.replace(/\*\*(.*?)\*\*/g, '$1')}
          </span>
        ),
      )}
    </>
  )
}

const studyHours = (sessions: Session[]) =>
  Number(
    (
      sessions
        .filter((session) => +new Date(session.startedAt) > Date.now() - 7 * 86_400_000)
        .reduce((sum, session) => sum + session.minutes, 0) / 60
    ).toFixed(1),
  )
const dayPart = () => {
  const hour = new Date().getHours()
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
}
