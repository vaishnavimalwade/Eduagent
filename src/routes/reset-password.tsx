import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password · EduAgent" },
      { name: "description", content: "Choose a new password for your EduAgent account." },
      { property: "og:title", content: "Reset password · EduAgent" },
      { property: "og:description", content: "Choose a new password for your EduAgent account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="grid min-h-screen place-items-center bg-[#18251f] px-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const { error } = await supabase.auth.updateUser({ password });
          setBusy(false);
          if (error) return setMsg(error.message);
          navigate({ to: "/app/$section", params: { section: "dashboard" }, replace: true });
        }}
        className="w-full max-w-md space-y-4 rounded-3xl bg-white p-8"
      >
        <h1 className="text-2xl font-semibold text-[#1c2721]">Set a new password</h1>
        <label className="form-label">New password<input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="form-input" autoComplete="new-password" /></label>
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        <button disabled={busy} className="primary-button w-full py-3">{busy ? "Saving…" : "Save password"}</button>
      </form>
    </main>
  );
}
