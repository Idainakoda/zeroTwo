
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login(email.trim(), password);
      const roles = data.roles || [];

      if (roles.includes("ADMIN")) {
        navigate("/admin", { replace: true });
      } else if (roles.includes("SECURITY_ANALYST")) {
        navigate("/security", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      setError(err.message || "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050816] text-white">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-cyan-500/15 blur-[130px]" />
        <div className="absolute bottom-0 right-0 h-[32rem] w-[32rem] rounded-full bg-blue-600/15 blur-[150px]" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(#94a3b8_1px,transparent_1px),linear-gradient(90deg,#94a3b8_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-2">
        {/* Left visual panel */}
        <section className="flex flex-col justify-between px-6 pb-5 pt-7 sm:px-12 lg:px-16 lg:py-10">
          <Link to="/login" className="flex w-fit items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-[0.18em]">
              CYBER<span className="text-cyan-300">CUP</span>
            </span>
          </Link>

          <div className="mx-auto w-full max-w-lg py-12">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-xs tracking-widest text-cyan-200">
              <span className="h-2 w-2 rounded-full bg-cyan-300" />
              AI SECURITY GATEWAY
            </span>

            <h1 className="mt-7 text-4xl font-semibold leading-tight sm:text-5xl xl:text-6xl">
              Your AI.
              <br />
              Your data.
              <br />
              <span className="bg-gradient-to-r from-cyan-200 to-blue-400 bg-clip-text text-transparent">
                Your control.
              </span>
            </h1>

            <p className="mt-5 max-w-md text-base leading-7 text-slate-400">
              Protect sensitive information before it reaches AI models.
              Work smarter with security built into your AI workflow.
            </p>

            <div className="relative mt-8 flex h-56 items-center justify-center sm:h-72">
              <div className="absolute h-52 w-52 rounded-full border border-cyan-300/10 sm:h-64 sm:w-64" />
              <div className="absolute h-40 w-40 rounded-full border border-cyan-300/20 sm:h-48 sm:w-48" />
              <div className="absolute h-32 w-32 rounded-full bg-cyan-400/10 blur-2xl" />
              <svg viewBox="0 0 200 220" className="relative h-48 w-48 drop-shadow-[0_0_35px_rgba(34,211,238,0.22)] sm:h-60 sm:w-60" fill="none">
                <path d="M100 14 170 41v48c0 51-27 87-70 116C57 176 30 140 30 89V41l70-27Z" fill="#22d3ee" fillOpacity=".08" stroke="#67e8f9" strokeWidth="1.5" />
                <path d="M100 32 153 52v37c0 40-20 70-53 93-33-23-53-53-53-93V52l53-20Z" stroke="#38bdf8" strokeOpacity=".65" />
                <path d="m72 105 19 19 39-42" stroke="#a5f3fc" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="100" cy="14" r="4" fill="#67e8f9" />
              </svg>
              <div className="absolute bottom-1 left-0 rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 backdrop-blur-xl">
                <p className="text-xs text-slate-400">Security layer</p>
                <p className="mt-1 text-sm font-medium">Sensitive data protection</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500">CYBERCUP · Built for safer AI</p>
        </section>

        {/* Login card */}
        <section className="flex items-center justify-center px-4 pb-10 sm:px-10 lg:px-14 lg:py-12">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.055] p-6 shadow-[0_30px_100px_rgba(0,0,0,.45)] backdrop-blur-2xl sm:p-9">
            <div className="mb-8">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <rect x="5" y="10" width="14" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Secure access</p>
              <h2 className="mt-2 text-3xl font-semibold">Welcome back</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Sign in to access your CyberCup workspace.
              </p>
            </div>

            {error && (
              <div role="alert" className="mb-5 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="login-email" className="mb-2 block text-sm text-slate-300">Work email</label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#070d19]/80 px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="login-password" className="text-sm text-slate-300">Password</label>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#070d19]/80 px-4 py-3.5 pr-16 text-sm outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-cyan-300 hover:text-cyan-200">
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-sky-400 px-4 py-3.5 text-sm font-bold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? "Signing in..." : "Sign in securely"}
                {!loading && <span>→</span>}
              </button>
            </form>

            <div className="my-7 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] tracking-widest text-slate-500">NEW TO CYBERCUP?</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <Link to="/register" className="block rounded-xl border border-white/10 px-4 py-3.5 text-center text-sm text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/5">
              Create an account <span className="text-cyan-300">→</span>
            </Link>

            <p className="mt-6 text-center text-xs text-slate-500">
              Your credentials are protected by your organization's authentication system.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
