import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, ChevronDown, LogOut, Menu } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getGatewayStatus } from "../../services/promptService";
import { getDashboardStats } from "../../services/adminService";
import { ClassificationBadge } from "../common/StatusBadge";

function Dot({ ok, warn, label, title }) {
  const color = ok ? "bg-emerald-400" : warn ? "bg-amber-400" : "bg-rose-400";
  return (
    <span title={title} className="zt-glass inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] text-slate-300">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

const ROLE_NAMES = { ADMIN: "Administrator", SECURITY_ANALYST: "Security analyst", EMPLOYEE: "Employee" };

export default function Navbar({ onMenu }) {
  const { token, user, isMonitor, logout } = useAuth();
  const [status, setStatus] = useState(null);
  const [pending, setPending] = useState(0);
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const s = await getGatewayStatus(token);
        if (alive) setStatus(s);
      } catch {
        if (alive) setStatus({ engine: { status: "unreachable" } });
      }
      if (isMonitor) {
        try {
          const stats = await getDashboardStats(token, 1);
          if (alive) setPending(stats.totals.pendingApprovals || 0);
        } catch {
          // the bell simply shows no count
        }
      }
    }
    load();
    const id = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [token, isMonitor]);

  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const engine = status?.engine || {};
  // "degraded" only lists optional layers that are missing (e.g. the local model): the engine is up.
  const engineOk = engine.status === "ok" || engine.status === "degraded";
  const missingCore = (engine.missing_layers || []).filter((l) => l !== "local_llm");
  const mlOk = engine.ml_injection?.semantic && engine.ml_injection?.classifier && missingCore.length === 0;
  const gemini = status?.gemini;
  const local = engine.local_llm?.reachable;
  const roleName = ROLE_NAMES[(user?.roles || [])[0]] || "User";
  const initial = (user?.fullName || "?").trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--zt-line)] bg-[#070b1d]/55 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onMenu} className="zt-glass rounded-lg p-2 text-slate-300 lg:hidden" aria-label="Open menu">
          <Menu className="h-4 w-4" />
        </button>
        <div className="hidden flex-wrap gap-2 sm:flex">
          <Dot ok={engineOk && mlOk} warn={engineOk && !mlOk} label="Security engine"
               title={engineOk ? (mlOk ? "Rules, ML and document layers loaded" : "Running with rules only") : "Engine unreachable: requests are blocked (fail-closed)"} />
          <Dot ok={gemini?.configured} warn={!gemini?.configured} label={gemini?.configured ? "Gemini" : "Gemini off"}
               title={gemini?.configured ? gemini.model : "No external AI key configured"} />
          <Dot ok={local} warn={!local} label={local ? "Local model" : "Local model off"}
               title="Ollama: used for SECRET documents and borderline checks" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isMonitor && (
          <Link to="/admin/approvals" className="relative rounded-full p-2 text-mist transition hover:bg-white/[0.06] hover:text-white"
                aria-label={pending ? `${pending} requests waiting for approval` : "Approvals"}>
            <Bell className="h-5 w-5" />
            {pending > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-signal to-iris px-1 text-[10px] font-semibold text-white">
                {pending}
              </span>
            )}
          </Link>
        )}
        <span className="hidden h-6 w-px bg-[var(--zt-line)] sm:block" />
        <div className="relative" ref={menuRef}>
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu"
                  className="flex items-center gap-3 rounded-xl px-1.5 py-1 transition hover:bg-white/[0.05]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-signal to-iris font-display text-sm font-semibold text-white">
              {initial}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-medium text-white">{user?.fullName}</span>
              <span className="block text-[11px] text-mist">{roleName}{user?.department ? `, ${user.department}` : ""}</span>
            </span>
            <ChevronDown className="h-4 w-4 text-mist" />
          </button>
          {open && (
            <div role="menu" className="zt-glass-strong absolute right-0 mt-2 w-64 rounded-2xl p-3 shadow-2xl">
              <p className="truncate px-2 text-sm text-white">{user?.email}</p>
              <div className="mt-2 flex items-center gap-2 px-2 text-xs text-mist">
                Clearance <ClassificationBadge level={user?.clearance || "INTERNAL"} />
              </div>
              <button type="button" role="menuitem" onClick={logout}
                      className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-200 hover:bg-white/[0.06]">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
