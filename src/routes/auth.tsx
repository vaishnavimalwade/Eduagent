import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";

type Search = { redirect?: string | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s["redirect"] === "string" && s["redirect"].startsWith("/") && !s["redirect"].startsWith("//") ? s["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in · EduAgent" },
      { name: "description", content: "Sign in or create your EduAgent account to plan tasks, schedules and focus sessions." },
      { property: "og:title", content: "Sign in · EduAgent" },
      { property: "og:description", content: "Sign in or create your EduAgent account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const GoogleG = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
);

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const go = () => {
    if (redirect) window.history.replaceState(null, "", redirect);
    navigate({ to: "/app/$section", params: { section: (redirect?.split("/")[2]) || "dashboard" }, replace: true });
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) go(); });
    const { data: sub } = supabase.auth.onAuthStateChange((e, session) => { if (e === "SIGNED_IN" && session) go(); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/auth", data: { display_name: name.trim() } } });
        if (error) throw error;
        if (!data.session) setMsg({ kind: "ok", text: "Check your email to confirm your account, then sign in." });
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
        if (error) throw error;
        setMsg({ kind: "ok", text: "If that email has an account, a reset link is on its way." });
      }
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Something went wrong" });
    } finally { setBusy(false); }
  };

  const social = async (provider: "google" | "lovable") => {
    setMsg(null);
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (r.error) setMsg({ kind: "err", text: r.error instanceof Error ? r.error.message : "Sign-in failed" });
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#18251f] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <div className="flex items-center gap-3 font-bold text-[#17241e]">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#c8f169]">E</span>
          EduAgent
        </div>
        <h1 className="mt-6 text-2xl font-semibold text-[#1c2721]">
          {mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-[#758078]">
          {mode === "signup" ? "Your tasks, schedule and reminders, synced everywhere." : mode === "forgot" ? "We'll email you a reset link." : "Sign in to your workspace."}
        </p>

        {mode !== "forgot" && (
          <div className="mt-6 space-y-2">
            <button type="button" onClick={() => social("google")} className="flex w-full items-center justify-center gap-[10px] rounded-xl border border-[#747775] bg-white px-3 py-2.5 text-sm font-medium text-[#1F1F1F]">
              <GoogleG /> Continue with Google
            </button>
            <button type="button" onClick={() => social("lovable")} className="flex w-full items-center justify-center gap-[10px] rounded-xl border border-[#d9ded7] bg-white px-3 py-2.5 text-sm font-medium text-[#1F1F1F] hover:bg-[#f3f5f1]">
              <LovableMark className="h-[18px] w-[18px]" /> Continue with Lovable
            </button>
            <div className="flex items-center gap-3 py-2 text-xs text-[#a0a9a3]"><span className="h-px flex-1 bg-[#e4e8e1]" />or<span className="h-px flex-1 bg-[#e4e8e1]" /></div>
          </div>
        )}

        <form onSubmit={submit} className={`space-y-3 ${mode === "forgot" ? "mt-6" : ""}`}>
          {mode === "signup" && (
            <label className="form-label">Name<input required value={name} onChange={(e) => setName(e.target.value)} className="form-input" autoComplete="name" /></label>
          )}
          <label className="form-label">Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" autoComplete="email" /></label>
          {mode !== "forgot" && (
            <label className="form-label">Password<input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="form-input" autoComplete={mode === "signup" ? "new-password" : "current-password"} /></label>
          )}
          {msg && <p className={`rounded-xl p-3 text-sm ${msg.kind === "ok" ? "bg-[#edf5df] text-[#4d672f]" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
          <button disabled={busy} className="primary-button w-full py-3">
            {busy ? "Please wait…" : mode === "signup" ? "Sign up" : mode === "forgot" ? "Send reset link" : "Log in"}
          </button>
        </form>

        <div className="mt-5 flex justify-between text-sm">
          {mode === "signin" ? (
            <>
              <button onClick={() => { setMode("signup"); setMsg(null); }} className="font-bold text-[#1c2922]">Create an account</button>
              <button onClick={() => { setMode("forgot"); setMsg(null); }} className="text-[#758078]">Forgot password?</button>
            </>
          ) : (
            <button onClick={() => { setMode("signin"); setMsg(null); }} className="font-bold text-[#1c2922]">← Back to log in</button>
          )}
        </div>
      </div>
    </main>
  );
}
