import { Link } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, Bot, FileLock2, ListChecks, MessageSquareText, ScanSearch, ShieldCheck, UserRound,
} from "lucide-react";
import Logo, { LogoMark } from "../components/brand/Logo";

const STEPS = [
  { icon: MessageSquareText, title: "You write a prompt", text: "In the secure assistant, with or without department documents." },
  { icon: ScanSearch, title: "ZeroTwo inspects it", text: "Aadhaar, PAN, phone numbers, passwords, API keys, classified content and injection attempts." },
  { icon: ListChecks, title: "Your policy decides", text: "Allow, warn, mask, redact, ask a supervisor or block, as your administrators configured." },
  { icon: Bot, title: "The AI answers", text: "It only sees masked text and documents you are cleared to read." },
  { icon: BadgeCheck, title: "The answer is checked", text: "Leaks and restricted content are caught before you see the reply." },
];

const WORKSPACES = [
  {
    key: "employee",
    icon: UserRound,
    tone: "from-[#3b82f6] to-[#4f7cff]",
    ring: "hover:border-[#4f7cff]/50",
    label: "Employee workspace",
    title: "Use AI safely.",
    text: "Ask the department's AI assistant. Personal data and secrets are masked before the AI sees them.",
    points: ["Secure assistant with live checks", "Your history and held requests", "Documents you are cleared to use"],
    signIn: "Employee sign in",
    create: "Create account",
  },
  {
    key: "admin",
    icon: ShieldCheck,
    tone: "from-[#7c3aed] to-[#a855f7]",
    ring: "hover:border-[#a855f7]/50",
    label: "Administrator workspace",
    title: "Run security.",
    text: "Watch incidents as they happen, review held requests, and decide what the gateway does.",
    points: ["Dashboard, incidents and prompt log", "Policies, approvals and user clearance", "Audit trail and detection metrics"],
    signIn: "Administrator sign in",
    create: "Request access",
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen text-ink">
      <header className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-6 sm:px-8">
        <Logo size={40} />
        <nav className="flex items-center gap-2 text-sm" aria-label="Page">
          <a href="#how" onClick={(e) => { e.preventDefault(); document.getElementById("how")?.scrollIntoView({ behavior: "smooth" }); }}
             className="hidden rounded-lg px-3 py-2 text-mist transition hover:text-white sm:inline-block">How it works</a>
          <a href="#workspaces" onClick={(e) => { e.preventDefault(); document.getElementById("workspaces")?.scrollIntoView({ behavior: "smooth" }); }}
             className="zt-glass rounded-xl px-4 py-2 font-medium text-white transition hover:border-[var(--zt-line-strong)]">Sign in</a>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-[1240px] items-center gap-12 px-5 pb-20 pt-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:pt-16">
        <div>
          <p className="zt-glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-[#c7d2fe]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> AI security gateway for government teams
          </p>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.04] text-white sm:text-6xl xl:text-[4.15rem]">
            Use AI at work.
            <span className="zt-gradient-text block pb-1">Keep data private.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-mist sm:text-lg">
            ZeroTwo checks every prompt before it reaches the AI model. Aadhaar numbers and passwords are masked,
            prompt-injection attacks are stopped, and documents are only shared with people cleared to see them.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#workspaces" onClick={(e) => { e.preventDefault(); document.getElementById("workspaces")?.scrollIntoView({ behavior: "smooth" }); }}
               className="zt-button inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold">
              Choose your workspace <ArrowRight className="h-4 w-4" />
            </a>
            <a href="#how" onClick={(e) => { e.preventDefault(); document.getElementById("how")?.scrollIntoView({ behavior: "smooth" }); }}
               className="zt-glass inline-flex items-center rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:border-[var(--zt-line-strong)]">
              See how it works
            </a>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-mist">
            {["Masks personal data", "Blocks prompt injection", "Clearance-based documents"].map((t) => (
              <li key={t} className="inline-flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-[#8ea8ff]" />{t}</li>
            ))}
          </ul>
        </div>

        {/* Illustrative inspection card */}
        <figure className="zt-glass-strong relative rounded-3xl p-6 shadow-[0_40px_120px_-40px_rgba(79,124,255,0.55)] sm:p-7">
          <div className="flex items-center gap-3">
            <LogoMark size={36} />
            <div>
              <p className="font-display text-base font-semibold text-white">Prompt inspection</p>
              <p className="text-xs text-mist">What the AI model actually receives</p>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-sm">
            <div className="rounded-2xl border border-[var(--zt-line)] bg-white/[0.03] p-4">
              <p className="text-xs text-mist">You type</p>
              <p className="mt-1.5 leading-6 text-slate-200">
                Draft a reminder to <mark className="rounded bg-[#4f7cff]/25 px-1 text-[#dbe4ff]">Ramesh Kumar</mark>,
                Aadhaar <mark className="rounded bg-[#4f7cff]/25 px-1 text-[#dbe4ff]">2345 6789 0124</mark>, about his EMI.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-emerald-200/80">The AI receives</p>
                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">Masked</span>
              </div>
              <p className="mt-1.5 leading-6 text-slate-200">
                Draft a reminder to <code className="rounded bg-black/30 px-1 text-[#a5b4fc]">&lt;PERSON_1&gt;</code>,
                Aadhaar <code className="rounded bg-black/30 px-1 text-[#a5b4fc]">&lt;AADHAAR_1&gt;</code>, about his EMI.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3">
              <p className="truncate text-slate-300">"Ignore all previous instructions and…"</p>
              <span className="ml-3 shrink-0 rounded-full bg-rose-400/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300">Blocked</span>
            </div>
          </div>
          <figcaption className="mt-5 text-center text-[11px] text-mist/70">Illustrative example of a real ZeroTwo check</figcaption>
        </figure>
      </section>

      {/* How it works: a real sequence, so the steps are numbered */}
      <section id="how" className="mx-auto max-w-[1240px] scroll-mt-8 px-5 py-20 sm:px-8">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">Every prompt passes through the gateway.</h2>
          <p className="mt-4 text-base leading-7 text-mist">
            ZeroTwo sits between your team and the AI model. Nothing reaches the model, and nothing comes back, without being checked.
          </p>
        </div>
        <ol className="relative mt-12 grid gap-6 lg:grid-cols-5">
          <div aria-hidden="true" className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-[#7c8cff]/50 to-transparent lg:block" />
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative flex gap-4 lg:block">
              <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--zt-line-strong)] bg-abyss text-[#b4c2ff]">
                <s.icon className="h-5 w-5" />
              </span>
              <div className="lg:mt-5">
                <p className="text-xs font-semibold text-[#8ea8ff]">Step {i + 1}</p>
                <h3 className="mt-1 font-display text-base font-semibold text-white">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-mist">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Role-based entry */}
      <section id="workspaces" className="mx-auto max-w-[1240px] scroll-mt-8 px-5 pb-24 pt-12 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">Choose your workspace.</h2>
          <p className="mt-4 text-base leading-7 text-mist">
            What you can see and do depends on your role. Sign in to the workspace that matches it.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {WORKSPACES.map((w) => (
            <article key={w.key} className={`zt-glass-strong group relative overflow-hidden rounded-3xl p-7 transition ${w.ring} sm:p-8`}>
              <div aria-hidden="true" className={`absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br ${w.tone} opacity-[0.12] blur-2xl`} />
              <span className={`relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${w.tone} text-white shadow-lg`}>
                <w.icon className="h-6 w-6" />
              </span>
              <p className="relative mt-6 text-sm font-semibold text-[#a5b4fc]">{w.label}</p>
              <h3 className="relative mt-1 font-display text-3xl font-bold text-white">{w.title}</h3>
              <p className="relative mt-3 max-w-md text-sm leading-6 text-mist">{w.text}</p>
              <ul className="relative mt-5 space-y-2 text-sm text-slate-300">
                {w.points.map((p) => (
                  <li key={p} className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 shrink-0 text-[#8ea8ff]" />{p}</li>
                ))}
              </ul>
              <div className="relative mt-7 flex flex-wrap gap-3">
                <Link to={`/login/${w.key}`} className={`inline-flex items-center gap-2 rounded-xl bg-gradient-to-r ${w.tone} px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110`}>
                  {w.signIn} <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to={`/register/${w.key}`} className="zt-glass inline-flex items-center rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:border-[var(--zt-line-strong)]">
                  {w.create}
                </Link>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-mist">
          <FileLock2 className="h-3.5 w-3.5" /> Administrator access is granted by an existing administrator, never by self-registration.
        </p>
      </section>

      <footer className="border-t border-[var(--zt-line)] py-8 text-center text-xs text-mist">
        ZeroTwo, an AI security gateway prototype for CyberCup 2026.
      </footer>
    </div>
  );
}
