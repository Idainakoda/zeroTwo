
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
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
      const result = await register(fullName.trim(), email.trim(), password);
      setSuccess(result?.message || "Account created. You can now sign in.");
      setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07111f] px-4 py-8 text-slate-900 sm:px-8 sm:py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-cyan-400/20 blur-[130px]" />
        <div className="absolute -bottom-40 -left-20 h-[30rem] w-[30rem] rounded-full bg-blue-600/20 blur-[140px]" />
        <div className="absolute inset-0 opacity-[0.045] [background-image:radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-[0.15em] text-white">
              CYBER<span className="text-cyan-300">CUP</span>
            </span>
          </Link>
          <p className="hidden text-sm text-slate-400 sm:block">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-cyan-300 hover:text-cyan-200">
              Sign in
            </Link>
          </p>
        </header>

        <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          {/* Registration intro */}
          <section className="text-white">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-xs tracking-widest text-cyan-200">
              <span className="h-2 w-2 rounded-full bg-cyan-300" />
              GET STARTED
            </div>

            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
              Build a safer
              <br />
              <span className="text-cyan-300">AI workflow.</span>
            </h1>

            <p className="mt-5 max-w-md text-base leading-7 text-slate-400">
              Create your CyberCup account and get access to a workspace
              designed to help protect sensitive information in AI interactions.
            </p>

            <div className="mt-9 space-y-4">
              {[
                ["01", "Create your account", "Register securely with your work details."],
                ["02", "Access your workspace", "Sign in to your assigned CyberCup role."],
                ["03", "Use AI more safely", "Submit prompts through the security gateway."],
              ].map(([number, title, description]) => (
                <div key={number} className="flex gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 backdrop-blur-xl">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-sm font-semibold text-cyan-200">
                    {number}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{title}</h3>
                    <p className="mt-1 text-sm leading-5 text-slate-400">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Separate light registration form */}
          <section className="rounded-[2rem] border border-white/40 bg-white p-6 shadow-[0_35px_100px_rgba(0,0,0,0.35)] sm:p-9 lg:p-10">
            <div className="mb-7">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800">
                  STEP 01 / 01
                </span>
                <span className="text-xs font-medium text-slate-400">Account details</span>
              </div>

              <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" />
              </div>

              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Create your account
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Enter your details to register as a CyberCup employee.
              </p>
            </div>

            {error && (
              <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="register-name" className="mb-2 block text-sm font-semibold text-slate-700">
                  Full name
                </label>
                <input
                  id="register-name"
                  type="text"
                  autoComplete="name"
                  maxLength={100}
                  required
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="register-email" className="mb-2 block text-sm font-semibold text-slate-700">
                  Work email
                </label>
                <input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  maxLength={150}
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="register-password" className="mb-2 block text-sm font-semibold text-slate-700">
                    Password
                  </label>
                  <input
                    id="register-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={72}
                    required
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="register-confirm" className="mb-2 block text-sm font-semibold text-slate-700">
                    Confirm password
                  </label>
                  <input
                    id="register-confirm"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="h-4 w-4 accent-cyan-600"
                />
                Show passwords
              </label>

              <button
                type="submit"
                disabled={loading || Boolean(success)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#07111f] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Creating account..." : success ? "Account created" : "Create account"}
                {!loading && !success && <span className="text-cyan-300">→</span>}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500 sm:hidden">
              Already registered?{" "}
              <Link to="/login" className="font-semibold text-cyan-700">
                Sign in
              </Link>
            </p>

            <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-xs text-slate-400">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-cyan-600" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="5" y="10" width="14" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              Your account is protected by CyberCup authentication.
            </div>
          </section>
        </div>

        <footer className="mt-10 text-center text-xs text-slate-500">
          CYBERCUP · Protected by design. Built for safer AI.
        </footer>
      </div>
    </main>
  );
}
