import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EduAgent — AI Academic Assistant" },
      { name: "description", content: "Plan tasks, daily schedules, reminders, focus sessions and projects with an AI study coach." },
      { property: "og:title", content: "EduAgent — AI Academic Assistant" },
      { property: "og:description", content: "Plan tasks, daily schedules, reminders, focus sessions and projects with an AI study coach." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const features = ["Smart tasks", "Daily schedule", "Calendar & reminders", "Focus mode", "PBL project tracker", "AI study coach"];
  return (
    <main className="min-h-screen bg-[#18251f] px-6 py-10 text-white">
      <div className="mx-auto flex max-w-5xl flex-col">
        <div className="flex items-center gap-3 font-bold">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#c8f169] text-[#17241e]">E</span>
          EduAgent
        </div>
        <section className="py-24">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#c8f169]">Your academic assistant</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-[-.04em] sm:text-6xl">Plan the semester. Own the day. Stay in focus.</h1>
          <p className="mt-6 max-w-xl text-lg text-white/60">Tasks, routines, reminders, deep-focus sessions and project milestones — with an AI coach that turns big work into small steps.</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/auth" className="inline-block rounded-xl bg-[#c8f169] px-6 py-3.5 font-bold text-[#17241e] hover:opacity-90">
              Sign up free →
            </Link>
            <Link to="/auth" className="inline-block rounded-xl border border-white/20 px-6 py-3.5 font-bold hover:bg-white/5">
              Log in
            </Link>
          </div>
        </section>
        <div className="grid gap-3 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm font-semibold">{f}</div>
          ))}
        </div>
      </div>
    </main>
  );
}
