import { useEffect, useMemo, useRef, useState } from "react";
import type { AppData, Schedule } from "@/lib/edu-store";

type Mutate = (body: object) => Promise<void>;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const todayKey = () => new Date().toISOString().slice(0, 10);
const toMin = (t: string) => {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
};
const fmt = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function Head({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#76847b]">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#758078]">{copy}</p>
      </div>
      {action}
    </div>
  );
}

/* ---------------- Daily schedule ---------------- */
export function ScheduleView({ data, mutate }: { data: AppData; mutate: Mutate }) {
  const [day, setDay] = useState(new Date().getDay());
  const [editing, setEditing] = useState<Schedule | "new" | null>(null);
  const isToday = day === new Date().getDay();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const items = data.schedules.filter((s) => s.days.includes(day)).sort((a, b) => a.time.localeCompare(b.time));
  const doneCount = items.filter((s) => s.doneOn?.includes(todayKey())).length;

  const toggleDone = (s: Schedule) => {
    const k = todayKey();
    const doneOn = s.doneOn?.includes(k) ? s.doneOn.filter((d) => d !== k) : [...(s.doneOn ?? []), k];
    return mutate({ action: "update", collection: "schedules", id: s.id, data: { doneOn } });
  };

  return (
    <>
      <Head
        eyebrow="Daily schedule"
        title="Your day, block by block."
        copy="Build a repeating routine of classes, study blocks and habits. Tick blocks off as you finish them."
        action={<button onClick={() => setEditing("new")} className="primary-button">+ Add schedule block</button>}
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {DAYS.map((d, i) => (
          <button
            key={d}
            onClick={() => setDay(i)}
            className={`rounded-xl px-4 py-2 text-xs font-bold ${day === i ? "bg-[#1c2922] text-white" : "border border-[#d9ded7] bg-white dark:border-white/10 dark:bg-white/5"}`}
          >
            {d}
            {i === new Date().getDay() ? " · today" : ""}
          </button>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <section className="card p-5">
          {items.length === 0 && <p className="p-6 text-center text-sm text-[#879089]">Nothing scheduled for {DAYS[day]}. Add a block to get started.</p>}
          <ol className="relative space-y-3 border-l-2 border-[#e4e8e1] pl-5 dark:border-white/10">
            {items.map((s) => {
              const start = toMin(s.time);
              const end = start + s.durationMinutes;
              const live = isToday && nowMin >= start && nowMin < end;
              const done = isToday && s.doneOn?.includes(todayKey());
              return (
                <li key={s.id} className={`relative rounded-xl border p-4 ${live ? "border-[#91b74c] bg-[#eef5dd] dark:bg-[#c8f169]/10" : "border-[#e7eae5] dark:border-white/7"}`}>
                  <span className={`absolute -left-[27px] top-5 h-3 w-3 rounded-full ${live ? "bg-[#91b74c]" : "bg-[#c4ccc6]"}`} />
                  <div className="flex items-center gap-3">
                    {isToday && (
                      <button
                        onClick={() => toggleDone(s)}
                        aria-label="Mark done"
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border text-xs ${done ? "border-[#75933e] bg-[#91b74c] text-white" : "border-[#b7c0ba]"}`}
                      >
                        {done ? "✓" : ""}
                      </button>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold ${done ? "text-[#8d9690] line-through" : ""}`}>{s.title}</p>
                      <p className="text-xs text-[#879089]">
                        {s.time} – {fmt(end)} · {s.durationMinutes} min · {s.category}
                        {live ? " · happening now" : ""}
                      </p>
                    </div>
                    <button onClick={() => setEditing(s)} className="text-xs font-bold text-[#526b5d]">Edit</button>
                    <button onClick={() => mutate({ action: "delete", collection: "schedules", id: s.id })} className="text-xs text-[#a0a9a3] hover:text-red-600" aria-label="Delete">×</button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
        <aside className="card h-fit p-5">
          <p className="card-label">{isToday ? "Today's progress" : `${DAYS[day]} overview`}</p>
          <p className="mt-3 text-4xl font-semibold">{isToday ? `${doneCount}/${items.length}` : items.length}</p>
          <p className="text-xs text-[#879089]">{isToday ? "blocks completed" : "blocks planned"}</p>
          <p className="mt-4 text-xs text-[#879089]">
            {Math.round(items.reduce((a, s) => a + s.durationMinutes, 0) / 6) / 10}h scheduled
          </p>
          {isToday && items.length > 0 && (
            <div className="mt-3 h-2 rounded-full bg-[#e7eae5] dark:bg-white/10">
              <div className="h-full rounded-full bg-[#91b74c]" style={{ width: `${(doneCount / items.length) * 100}%` }} />
            </div>
          )}
        </aside>
      </div>
      {editing && (
        <ScheduleDialog
          initial={editing === "new" ? null : editing}
          defaultDay={day}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            if (editing === "new") await mutate({ action: "create", collection: "schedules", data: values });
            else await mutate({ action: "update", collection: "schedules", id: editing.id, data: values });
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function ScheduleDialog({ initial, defaultDay, onClose, onSave }: { initial: Schedule | null; defaultDay: number; onClose: () => void; onSave: (v: Omit<Schedule, "id" | "doneOn">) => Promise<void> }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [time, setTime] = useState(initial?.time ?? "09:00");
  const [duration, setDuration] = useState(initial?.durationMinutes ?? 60);
  const [category, setCategory] = useState(initial?.category ?? "Study");
  const [days, setDays] = useState<number[]>(initial?.days ?? [defaultDay]);
  const [err, setErr] = useState("");
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return setErr("Add a title.");
          if (!days.length) return setErr("Pick at least one day.");
          void onSave({ title: title.trim(), time, durationMinutes: Math.max(5, duration), category, days });
        }}
        className="card w-full max-w-md space-y-4 p-6"
      >
        <h2 className="text-xl font-semibold">{initial ? "Edit block" : "New schedule block"}</h2>
        <label className="form-label">Title<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="form-input" placeholder="e.g. Physics revision" /></label>
        <div className="grid grid-cols-3 gap-3">
          <label className="form-label">Start<input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="form-input" /></label>
          <label className="form-label">Minutes<input type="number" min={5} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="form-input" /></label>
          <label className="form-label">Category
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="form-input">
              {["Study", "Class", "Assignment", "Health", "Personal", "Break"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <div>
          <p className="form-label">Repeat on</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => (
              <button
                type="button"
                key={d}
                onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${days.includes(i) ? "bg-[#1c2922] text-white" : "bg-[#eef0ec] dark:bg-white/5"}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="secondary-button">Cancel</button>
          <button className="primary-button">Save</button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- Reminders ---------------- */
export function useReminderAlerts(data: AppData | null, mutate: Mutate) {
  const ref = useRef({ data, mutate });
  ref.current = { data, mutate };
  useEffect(() => {
    const check = () => {
      const { data, mutate } = ref.current;
      if (!data) return;
      for (const r of data.reminders) {
        if (r.done || r.notified || +new Date(r.remindAt) > Date.now()) continue;
        if ("Notification" in window && Notification.permission === "granted") {
          try { new Notification("EduAgent reminder", { body: r.title }); } catch {}
        }
        void mutate({ action: "update", collection: "reminders", id: r.id, data: { notified: true } });
        void mutate({ action: "create", collection: "notifications", data: { title: "Reminder", message: r.title, read: false } });
      }
    };
    check();
    const t = setInterval(check, 20_000);
    return () => clearInterval(t);
  }, []);
}

export function RemindersView({ data, mutate }: { data: AppData; mutate: Mutate }) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [when, setWhen] = useState(() => {
    const d = new Date(Date.now() + 3_600_000);
    d.setMinutes(0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [perm, setPerm] = useState<string>("default");
  useEffect(() => { if ("Notification" in window) setPerm(Notification.permission); }, []);

  const sorted = [...data.reminders].sort((a, b) => +new Date(a.remindAt) - +new Date(b.remindAt));
  const upcoming = sorted.filter((r) => !r.done && +new Date(r.remindAt) >= Date.now());
  const overdue = sorted.filter((r) => !r.done && +new Date(r.remindAt) < Date.now());
  const done = sorted.filter((r) => r.done);
  const dueTasks = data.tasks.filter((t) => t.status !== "completed").sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)).slice(0, 5);

  const add = async (t = title, at = when, n = note) => {
    if (!t.trim() || !at) return;
    await mutate({ action: "create", collection: "reminders", data: { title: t.trim(), note: n.trim(), remindAt: new Date(at).toISOString(), done: false } });
    setTitle(""); setNote("");
  };

  const Row = ({ r }: { r: AppData["reminders"][number] }) => (
    <div className="flex items-center gap-3 rounded-xl border border-[#e7eae5] p-3 dark:border-white/7">
      <button
        onClick={() => mutate({ action: "update", collection: "reminders", id: r.id, data: { done: !r.done } })}
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${r.done ? "border-[#75933e] bg-[#91b74c] text-white" : "border-[#b7c0ba]"}`}
        aria-label="Done"
      >{r.done ? "✓" : ""}</button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${r.done ? "text-[#8d9690] line-through" : ""}`}>{r.title}</p>
        <p className="text-xs text-[#879089]">
          {new Date(r.remindAt).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          {r.note ? ` · ${r.note}` : ""}
        </p>
      </div>
      {!r.done && (
        <button
          onClick={() => mutate({ action: "update", collection: "reminders", id: r.id, data: { remindAt: new Date(Math.max(Date.now(), +new Date(r.remindAt)) + 3_600_000).toISOString(), notified: false } })}
          className="text-xs font-bold text-[#526b5d]"
        >Snooze 1h</button>
      )}
      <button onClick={() => mutate({ action: "delete", collection: "reminders", id: r.id })} className="text-xs text-[#a0a9a3] hover:text-red-600" aria-label="Delete">×</button>
    </div>
  );

  return (
    <>
      <Head eyebrow="Reminders" title="Never miss what matters." copy="Set reminders for deadlines, exams and to-dos. You'll get an alert when they're due while EduAgent is open." />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <section className="space-y-5">
          <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="card grid gap-3 p-5 sm:grid-cols-[1fr_200px_auto]">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Remind me to…" className="form-input mt-0" />
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="form-input mt-0" />
            <button className="primary-button">Add reminder</button>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="form-input mt-0 sm:col-span-3" />
          </form>
          {overdue.length > 0 && (
            <div className="card p-5"><p className="card-label text-red-600">Overdue</p><div className="mt-3 space-y-2">{overdue.map((r) => <Row key={r.id} r={r} />)}</div></div>
          )}
          <div className="card p-5">
            <p className="card-label">Upcoming</p>
            <div className="mt-3 space-y-2">
              {upcoming.length ? upcoming.map((r) => <Row key={r.id} r={r} />) : <p className="text-sm text-[#879089]">No upcoming reminders.</p>}
            </div>
          </div>
          {done.length > 0 && (
            <div className="card p-5"><p className="card-label">Done</p><div className="mt-3 space-y-2">{done.map((r) => <Row key={r.id} r={r} />)}</div></div>
          )}
        </section>
        <aside className="space-y-5">
          <section className="card p-5">
            <p className="card-label">Alerts</p>
            {perm === "granted" ? (
              <p className="mt-3 text-sm text-[#4d672f]">Desktop alerts are on.</p>
            ) : (
              <>
                <p className="mt-3 text-sm text-[#78827c]">Turn on desktop alerts to get a pop-up when a reminder is due.</p>
                <button
                  onClick={async () => { if ("Notification" in window) setPerm(await Notification.requestPermission()); }}
                  className="secondary-button mt-3 w-full"
                >Enable alerts</button>
              </>
            )}
          </section>
          <section className="card p-5">
            <p className="card-label">Tasks to be done</p>
            <div className="mt-3 space-y-3">
              {dueTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{t.title}</p>
                    <p className="text-xs text-[#879089]">Due {new Date(t.dueAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <button
                    onClick={() => add(`Work on: ${t.title}`, new Date(Math.max(Date.now() + 600_000, +new Date(t.dueAt) - 86_400_000)).toISOString())}
                    className="text-xs font-bold text-[#526b5d]"
                  >Remind me</button>
                </div>
              ))}
              {!dueTasks.length && <p className="text-sm text-[#879089]">All caught up.</p>}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

/* ---------------- Focus mode ---------------- */
export function FocusMode({ data, mutate }: { data: AppData; mutate: Mutate }) {
  const pref = data.preferences[0];
  const presets: number[] = [pref?.focusMinutes ?? 25, 45, 60, 90];
  const pending = useMemo(() => data.tasks.filter((t) => t.status !== "completed"), [data.tasks]);
  const [minutes, setMinutes] = useState<number>(presets[0] ?? 25);
  const [taskId, setTaskId] = useState(pending[0]?.id ?? "");
  const [seconds, setSeconds] = useState((presets[0] ?? 25) * 60);
  const [running, setRunning] = useState(false);
  const [full, setFull] = useState(false);
  const [distractions, setDistractions] = useState(0);
  const [finished, setFinished] = useState(false);
  const task = pending.find((t) => t.id === taskId);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (running && seconds === 0) {
      setRunning(false);
      setFinished(true);
      void mutate({ action: "create", collection: "study-sessions", data: { startedAt: new Date().toISOString(), minutes, task: taskId || undefined } });
      try { if ("Notification" in window && Notification.permission === "granted") new Notification("Focus session complete", { body: `${minutes} minutes done. Take a break!` }); } catch {}
    }
  }, [seconds, running]);

  useEffect(() => {
    const onVis = () => { if (document.hidden && running) setDistractions((d) => d + 1); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [running]);

  useEffect(() => {
    document.title = running ? `${fmtTime(seconds)} · Focus` : "EduAgent · Focus Mode";
  }, [seconds, running]);

  const start = () => {
    setFinished(false);
    if (seconds === 0) setSeconds(minutes * 60);
    setRunning(true);
    setFull(true);
  };
  const stop = () => { setRunning(false); setFull(false); };
  const pick = (m: number) => { setMinutes(m); setSeconds(m * 60); setRunning(false); setFinished(false); };
  const pct = 1 - seconds / (minutes * 60);
  const todayMin = data["study-sessions"].filter((s) => new Date(s.startedAt).toDateString() === new Date().toDateString()).reduce((a, s) => a + s.minutes, 0);

  const Timer = (
    <div className="relative mx-auto h-72 w-72">
      <svg viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="3" className="opacity-15" />
        <circle cx="50" cy="50" r="45" fill="none" stroke="#c8f169" strokeWidth="3" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - pct * 100} className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-6xl font-semibold tabular-nums">{fmtTime(seconds)}</p>
          <p className="mt-2 text-xs font-bold uppercase tracking-wider opacity-60">{running ? "Deep focus" : finished ? "Session complete" : "Ready"}</p>
        </div>
      </div>
    </div>
  );

  if (full) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#101713] px-6 text-[#edf2ee]">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#c8f169]">Focus mode</p>
        <h2 className="mt-3 max-w-xl text-center text-2xl font-semibold">{task?.title ?? "Free focus"}</h2>
        <div className="mt-10">{Timer}</div>
        <p className="mt-6 text-xs opacity-60">Distractions (left this tab): {distractions}</p>
        <div className="mt-8 flex gap-3">
          <button onClick={() => setRunning(!running)} className="rounded-xl bg-[#c8f169] px-6 py-3 text-sm font-bold text-[#17241e]">{running ? "Pause" : seconds === 0 ? "Restart" : "Resume"}</button>
          <button onClick={stop} className="rounded-xl border border-white/20 px-6 py-3 text-sm font-bold">Exit focus</button>
        </div>
        {finished && task && (
          <button
            onClick={() => { void mutate({ action: "update", collection: "tasks", id: task.id, data: { status: "completed" } }); stop(); }}
            className="mt-4 text-sm font-bold text-[#c8f169] underline"
          >Mark “{task.title}” as complete</button>
        )}
      </div>
    );
  }

  return (
    <>
      <Head eyebrow="Focus mode" title="One thing. Full attention." copy="Pick a task, set a length, and go distraction-free. Completed sessions count toward your weekly goal." />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <section className="card p-8">
          {Timer}
          <div className="mx-auto mt-8 max-w-md space-y-4">
            <label className="form-label">Focus on
              <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className="form-input">
                <option value="">Free focus (no task)</option>
                {pending.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </label>
            <div className="flex gap-2">
              {presets.map((m) => (
                <button key={m} onClick={() => pick(m)} className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold ${minutes === m ? "bg-[#1c2922] text-white" : "bg-[#eef0ec] dark:bg-white/5"}`}>{m} min</button>
              ))}
            </div>
            <button onClick={start} className="primary-button w-full py-3">Enter focus mode</button>
          </div>
        </section>
        <aside className="space-y-5">
          <section className="card p-5">
            <p className="card-label">Today</p>
            <p className="mt-3 text-4xl font-semibold">{todayMin} min</p>
            <p className="text-xs text-[#879089]">focused today</p>
          </section>
          <section className="card p-5">
            <p className="card-label">Focus tips</p>
            <ul className="mt-3 space-y-2 text-sm text-[#78827c]">
              <li>• Put your phone in another room.</li>
              <li>• Close unrelated tabs — leaving this tab counts as a distraction.</li>
              <li>• Write down stray thoughts and come back to them later.</li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}

function fmtTime(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
