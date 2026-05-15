import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account — SentinelWave AI" }] }),
  component: Signup,
});

function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: name || email.split("@")[0] },
      },
    });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    // Try sign-in immediately (works if email confirmation disabled)
    const { error: signinErr } = await supabase.auth.signInWithPassword({ email, password });
    if (!signinErr) navigate({ to: "/dashboard" });
    else setErr("Check your email to confirm your account, then sign in.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 grid-bg">
      <div className="w-full max-w-md glass-strong rounded-2xl p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold tracking-tight">SentinelWave</h1>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Operator console</p>
          </div>
        </div>
        <h2 className="text-xl font-semibold mb-1">Create account</h2>
        <p className="text-sm text-muted-foreground mb-6">First user becomes admin automatically.</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Display name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Password</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary" />
          </div>
          {err && <div className="text-xs text-destructive">{err}</div>}
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-md text-sm font-medium text-primary-foreground transition disabled:opacity-50"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>
        <div className="mt-5 text-sm text-muted-foreground text-center">
          Already registered? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
