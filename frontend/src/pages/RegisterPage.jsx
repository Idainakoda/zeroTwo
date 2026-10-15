import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Info } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/brand/Logo";
import { PORTALS } from "../utils/routing";

const COPY = {
  employee: {
    title: "Create your employee account.",
    text: "New accounts start with public-document access. An administrator can add your department and raise your clearance.",
    button: "Create account",
  },
  admin: {
    title: "Request administrator access.",
    text: "For safety, nobody can make themselves an administrator. We create your account with employee access; an existing administrator then grants the administrator role in Users & clearance.",
    button: "Create account and request access",
  },
};

export default function RegisterPage() {
  const { portal = "employee" } = useParams();
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const p = PORTALS[portal];
  if (!p) return <Navigate to="/register/employee" replace />;
  const copy = COPY[portal];
  const Icon = p.icon;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password.length < 8 || password.length > 72) {
      setError("Password must be between 8 and 72 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await register(fullName.trim(), email.trim(), password);
      setSuccess(portal === "admin"
        ? "Account created with employee access. Ask an administrator to grant you the administrator role, then sign in to the administrator workspace."
        : "Account created. You can now sign in.");
      setTimeout(() => navigate(`/login/${portal === "admin" ? "employee" : "employee"}`, { replace: true }),
                 portal === "admin" ? 4500 : 1500);
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "zt-input w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500";

  return (
    <main className="min-h-screen text-ink">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-6 sm:px-8">
        <Link to="/" aria-label="ZeroTwo home"><Logo size={38} /></Link>
        <Link to={`/login/${portal}`} className="inline-flex items-center gap-2 text-sm text-mist hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      </div>

      <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 pb-16 pt-4 sm:px-8 lg:grid-cols-[1fr_480px] lg:pt-10">
        <section>
          <span className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${p.tone} text-white shadow-lg`}>
            <Icon className="h-6 w-6" />
          </span>
          <p className="mt-6 text-sm font-semibold text-[#a5b4fc]">{p.name}</p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-tight text-white sm:text-5xl">{copy.title}</h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-mist">{copy.text}</p>
        </section>

        <section className="zt-glass-strong rounded-3xl p-6 shadow-[0_40px_120px_-40px_rgba(79,124,255,0.5)] sm:p-8">
          <h2 className="font-display text-2xl font-semibold text-white">Your details</h2>
          <p className="mt-1.5 text-sm text-mist">Use your official work email.</p>

          {portal === "admin" && (
            <div className="mt-5 flex gap-3 rounded-xl border border-[#a78bfa]/25 bg-[#7c3aed]/10 p-3 text-sm text-violet-100">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
              Administrator rights are granted by an existing administrator, never by sign-up.
            </div>
          )}
          {error && <div role="alert" className="mt-5 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-100">{error}</div>}
          {success && <div role="status" className="mt-5 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-100">{success}</div>}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="register-name" className="mb-1.5 block text-sm text-slate-300">Full name</label>
              <input id="register-name" type="text" autoComplete="name" maxLength={100} required placeholder="Your full name"
                     value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="register-email" className="mb-1.5 block text-sm text-slate-300">Work email</label>
              <input id="register-email" type="email" autoComplete="email" maxLength={150} required placeholder="you@department.gov.in"
                     value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="register-password" className="mb-1.5 block text-sm text-slate-300">Password</label>
                <input id="register-password" type={showPassword ? "text" : "password"} autoComplete="new-password"
                       minLength={8} maxLength={72} required placeholder="At least 8 characters"
                       value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="register-confirm" className="mb-1.5 block text-sm text-slate-300">Confirm password</label>
                <input id="register-confirm" type={showPassword ? "text" : "password"} autoComplete="new-password" required
                       placeholder="Type it again" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                       className={inputClass} />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-mist">
              <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)}
                     className="h-4 w-4 accent-indigo-500" />
              Show passwords
            </label>
            <button type="submit" disabled={loading || Boolean(success)}
                    className="zt-button flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? "Creating account…" : success ? "Account created" : copy.button}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-mist">
            Already have an account?{" "}
            <Link to={`/login/${portal}`} className="font-medium text-[#a5b4fc] hover:text-white">Sign in</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
