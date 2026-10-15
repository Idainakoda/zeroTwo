import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/brand/Logo";
import { homeFor, PORTALS } from "../utils/routing";

// Seeded demo accounts (local prototype). Hide with VITE_SHOW_DEMO_ACCOUNTS=false.
const DEMO_ACCOUNTS = {
  employee: [
    { label: "Asha, Revenue, Internal clearance", email: "asha@cybercup.demo", password: "Asha@2026" },
    { label: "Meera, Finance, Confidential clearance", email: "meera@cybercup.demo", password: "Meera@2026" },
  ],
  admin: [
    { label: "Security administrator", email: "admin@cybercup.demo", password: "Admin@2026" },
    { label: "Security analyst", email: "analyst@cybercup.demo", password: "Analyst@2026" },
  ],
};
const SHOW_DEMO = import.meta.env.VITE_SHOW_DEMO_ACCOUNTS !== "false";

export default function LoginPage() {
  const { portal = "employee" } = useParams();
  const { login, logout } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const p = PORTALS[portal];
  if (!p) return <Navigate to="/login/employee" replace />;
  const Icon = p.icon;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(email.trim(), password);
      const roles = data.roles || [];
      // Role-based access: the administrator workspace only admits administrators and analysts.
      if (p.allowed && !p.allowed.some((r) => roles.includes(r))) {
        logout();
        setError("This account does not have administrator access. Use the employee workspace, or ask an administrator to grant the role.");
        return;
      }
      navigate(portal === "admin" ? homeFor(roles) : "/assistant", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen text-ink">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-6 sm:px-8">
        <Link to="/" aria-label="ZeroTwo home"><Logo size={38} /></Link>
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-mist hover:text-white">
          <ArrowLeft className="h-4 w-4" /> All workspaces
        </Link>
      </div>

      <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 pb-16 pt-4 sm:px-8 lg:grid-cols-[1fr_440px] lg:pt-12">
        <section>
          <span className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${p.tone} text-white shadow-lg`}>
            <Icon className="h-6 w-6" />
          </span>
          <p className="mt-6 text-sm font-semibold text-[#a5b4fc]">{p.name}</p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-tight text-white sm:text-5xl">{p.title}</h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-mist">{p.text}</p>
          <Link to={`/login/${portal === "admin" ? "employee" : "admin"}`}
                className="mt-6 inline-flex items-center gap-2 text-sm text-[#a5b4fc] hover:text-white">
            {portal === "admin" ? "Looking for the employee workspace?" : "Are you an administrator?"} <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <section className="zt-glass-strong rounded-3xl p-6 shadow-[0_40px_120px_-40px_rgba(79,124,255,0.5)] sm:p-8">
          <h2 className="font-display text-2xl font-semibold text-white">Welcome back</h2>
          <p className="mt-1.5 text-sm text-mist">Sign in with your work email.</p>

          {error && (
            <div role="alert" className="mt-5 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-100">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-sm text-slate-300">Work email</label>
              <input id="login-email" type="email" autoComplete="email" required placeholder="you@department.gov.in"
                     value={email} onChange={(e) => setEmail(e.target.value)}
                     className="zt-input w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500" />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-sm text-slate-300">Password</label>
              <div className="relative">
                <input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required
                       placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)}
                       className="zt-input w-full rounded-xl px-4 py-3 pr-12 text-sm text-white outline-none transition placeholder:text-slate-500" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-mist hover:text-white">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
                    className="zt-button flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? "Signing in…" : p.button}
            </button>
          </form>

          {SHOW_DEMO && (
            <div className="mt-6 rounded-2xl border border-[var(--zt-line)] bg-white/[0.02] p-3">
              <p className="px-2 pb-1 text-xs font-medium text-mist">Demo accounts for this workspace</p>
              {DEMO_ACCOUNTS[portal].map((a) => (
                <button key={a.email} type="button" aria-label={`Use demo account: ${a.label}`}
                        onClick={() => { setEmail(a.email); setPassword(a.password); setError(""); }}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm text-slate-200 transition hover:bg-white/[0.05]">
                  <span>{a.label}</span>
                  <span className="truncate text-xs text-mist">{a.email}</span>
                </button>
              ))}
            </div>
          )}

          <p className="mt-6 text-center text-sm text-mist">
            New here?{" "}
            <Link to={`/register/${portal}`} className="font-medium text-[#a5b4fc] hover:text-white">
              {portal === "admin" ? "Request administrator access" : "Create an account"}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
