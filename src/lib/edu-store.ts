// Local-first data store (browser localStorage). Mirrors the original app's collections.
export type Course = { id: string; name: string; code?: string; color: string };
export type Task = {
  id: string; title: string; course: string; dueAt: string; estimatedHours: number;
  priority: "low" | "medium" | "high"; status: "todo" | "progress" | "completed";
  description?: string; plannerSlot?: "morning" | "afternoon" | "evening";
};
export type Milestone = { id?: string; title: string; deadline: string; completed?: boolean };
export type Project = { id: string; title: string; course: string; description: string; targetDate: string; type: string; milestones?: Milestone[] };
export type Session = { id: string; startedAt: string; minutes: number; task?: string };
export type Notice = { id: string; title: string; message: string; read?: boolean };
export type Chat = { id: string; role: "user" | "assistant"; content: string };
export type Schedule = { id: string; title: string; time: string; durationMinutes: number; days: number[]; category: string; doneOn?: string[] };
export type Reminder = { id: string; title: string; note?: string; remindAt: string; done?: boolean; notified?: boolean };
export type Preference = { id: string; theme?: string; focusMinutes?: number; shortBreakMinutes?: number; longBreakMinutes?: number };

export type AppData = {
  user: { id: string; name: string; email: string; isDemo?: boolean; weeklyGoalHours?: number; streak?: number };
  courses: Course[]; tasks: Task[]; projects: Project[]; "study-sessions": Session[];
  notifications: Notice[]; preferences: Preference[]; "chat-messages": Chat[];
  schedules: Schedule[]; reminders: Reminder[]; aiConfigured: boolean;
};
export type Collection = Exclude<keyof AppData, "user" | "aiConfigured">;
export type Mutation = { action: "create" | "update" | "delete"; collection: Collection; id?: string; data?: Record<string, unknown> };

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function seed(): AppData {
  const h = (v: number) => new Date(Date.now() + v * 3_600_000).toISOString();
  const courses: Course[] = [
    { id: "c1", name: "Computer Science", code: "CS 301", color: "#6758D9" },
    { id: "c2", name: "Linear Algebra", code: "MATH 240", color: "#0EA5A4" },
    { id: "c3", name: "Technical Writing", code: "ENG 210", color: "#E07A5F" },
  ];
  return {
    user: { id: "local", name: "Alex Morgan", email: "student@eduagent.app", isDemo: true, weeklyGoalHours: 18, streak: 12 },
    courses,
    tasks: [
      { id: uid(), title: "Implement graph traversal", course: "c1", dueAt: h(19), estimatedHours: 3, priority: "high", status: "progress", description: "Complete BFS and DFS, include complexity analysis.", plannerSlot: "morning" },
      { id: uid(), title: "Problem set 6: Eigenvalues", course: "c2", dueAt: h(42), estimatedHours: 2.5, priority: "high", status: "todo", description: "Questions 1–12 and proof review.", plannerSlot: "afternoon" },
      { id: uid(), title: "Revise research proposal", course: "c3", dueAt: h(96), estimatedHours: 2, priority: "medium", status: "todo", description: "Apply peer feedback and tighten the executive summary.", plannerSlot: "evening" },
      { id: uid(), title: "Read chapter 8", course: "c1", dueAt: h(-8), estimatedHours: 1, priority: "medium", status: "todo", description: "Take notes on dynamic programming." },
    ],
    projects: [
      { id: uid(), title: "Campus Navigation Assistant", course: "c1", description: "Design and build a graph-based route planner for accessible campus navigation.", targetDate: h(24 * 36), type: "semester-project", milestones: [
        { title: "Research & requirements", deadline: h(72), completed: true },
        { title: "Graph data model", deadline: h(240), completed: true },
        { title: "Routing prototype", deadline: h(480), completed: false },
        { title: "Testing & presentation", deadline: h(816), completed: false },
      ] },
    ],
    "study-sessions": [5, 4, 6, 3, 7, 2].map((v, i) => ({ id: uid(), startedAt: h(-24 * (6 - i)), minutes: v * 30 })),
    notifications: [{ id: uid(), title: "Deadline risk detected", message: "Graph traversal is due in 19 hours. Start the testing pass next.", read: false }],
    preferences: [{ id: "p1", theme: "light", focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 }],
    "chat-messages": [],
    schedules: [
      { id: uid(), title: "Morning review", time: "07:30", durationMinutes: 30, days: [1, 2, 3, 4, 5], category: "Study" },
      { id: uid(), title: "Linear Algebra lecture", time: "10:00", durationMinutes: 90, days: [1, 3], category: "Class" },
      { id: uid(), title: "Gym", time: "18:00", durationMinutes: 60, days: [2, 4, 6], category: "Health" },
      { id: uid(), title: "Plan tomorrow", time: "21:00", durationMinutes: 15, days: [0, 1, 2, 3, 4, 5, 6], category: "Personal" },
    ],
    reminders: [{ id: uid(), title: "Submit graph traversal", note: "Upload to the course portal", remindAt: h(16) }],
    aiConfigured: true,
  };
}

const LEGACY_KEY = "eduagent-data-v1";
let current: AppData | null = null;
let currentUser: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function normalize(parsed: Partial<AppData>): AppData {
  const base = seed();
  return { ...base, ...parsed, schedules: parsed.schedules ?? base.schedules, reminders: parsed.reminders ?? base.reminders, aiConfigured: true } as AppData;
}

/** Loads the signed-in user's workspace from Lovable Cloud (creating it on first visit). */
export async function initStore(user: { id: string; email: string; name: string }): Promise<AppData> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data: row, error } = await supabase.from("workspaces").select("data").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  let d: AppData;
  if (row && row.data && Object.keys(row.data as object).length) {
    d = normalize(row.data as Partial<AppData>);
  } else {
    let legacy: Partial<AppData> | null = null;
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (raw) legacy = JSON.parse(raw);
    } catch {}
    d = legacy ? normalize(legacy) : seed();
    d["chat-messages"] = d["chat-messages"] ?? [];
  }
  d.user = { ...d.user, id: user.id, email: user.email, name: user.name || d.user.name, isDemo: false };
  current = d;
  currentUser = user.id;
  if (!row) {
    await supabase.from("workspaces").insert({ user_id: user.id, data: JSON.parse(JSON.stringify(d)) });
    localStorage.removeItem(LEGACY_KEY);
  }
  return d;
}

export function loadData(): AppData {
  if (!current) throw new Error("Workspace not loaded");
  return current;
}

export function saveData(d: AppData) {
  current = d;
  const userId = currentUser;
  if (!userId) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.from("workspaces").update({ data: JSON.parse(JSON.stringify(current)), updated_at: new Date().toISOString() }).eq("user_id", userId);
  }, 600);
}

export function clearStore() {
  current = null;
  currentUser = null;
}

export function applyMutation(d: AppData, m: Mutation): AppData {
  const list = d[m.collection] as Array<{ id: string }>;
  let next: Array<{ id: string }>;
  if (m.action === "create") next = [{ ...(m.data ?? {}), id: uid() } as { id: string }, ...list];
  else if (m.action === "update") next = list.map((x) => (x.id === m.id ? { ...x, ...(m.data ?? {}) } : x));
  else next = list.filter((x) => x.id !== m.id);
  return { ...d, [m.collection]: next };
}
