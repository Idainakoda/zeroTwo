import { NavLink } from "react-router-dom";
import {
  BarChart3,
  ClipboardCheck,
  FileLock2,
  FlaskConical,
  History,
  LogOut,
  MessageSquareLock,
  ScrollText,
  ShieldAlert,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const EMPLOYEE_LINKS = [
  { to: "/assistant", label: "Secure Assistant", icon: MessageSquareLock },
  { to: "/activity", label: "My Activity", icon: History },
  { to: "/documents", label: "Documents", icon: FileLock2 },
];

const MONITOR_LINKS = [
  { to: "/admin", label: "Overview", icon: BarChart3, end: true },
  { to: "/admin/incidents", label: "Incidents", icon: ShieldAlert },
  { to: "/admin/approvals", label: "Approvals", icon: ClipboardCheck },
  { to: "/admin/audit", label: "Audit Log", icon: ScrollText },
  { to: "/admin/policies", label: "Policies", icon: SlidersHorizontal },
  { to: "/admin/evaluation", label: "Evaluation Lab", icon: FlaskConical },
];

const ADMIN_ONLY = [{ to: "/admin/users", label: "Users & Clearance", icon: Users }];

function Item({ to, label, icon: Icon, end, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
          isActive
            ? "bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-300/20"
            : "text-slate-400 hover:bg-white/5 hover:text-white"
        }`
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </NavLink>
  );
}

export default function Sidebar({ onNavigate }) {
  const { user, isAdmin, isMonitor, logout } = useAuth();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-white/10 bg-[#070c18] px-4 py-5">
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3Z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold tracking-[0.18em] text-white">
            CYBER<span className="text-cyan-300">CUP</span>
          </p>
          <p className="text-[11px] text-slate-500">AI Security Gateway</p>
        </div>
      </div>

      <nav className="mt-7 flex-1 space-y-6 overflow-y-auto">
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">Workspace</p>
          {EMPLOYEE_LINKS.map((l) => <Item key={l.to} {...l} onNavigate={onNavigate} />)}
        </div>
        {isMonitor && (
          <div className="space-y-1">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">Security</p>
            {MONITOR_LINKS.map((l) => <Item key={l.to} {...l} onNavigate={onNavigate} />)}
            {isAdmin && ADMIN_ONLY.map((l) => <Item key={l.to} {...l} onNavigate={onNavigate} />)}
          </div>
        )}
      </nav>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <p className="truncate text-sm font-medium text-white">{user?.fullName}</p>
        <p className="truncate text-xs text-slate-500">{user?.email}</p>
        <button
          onClick={logout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 py-1.5 text-xs text-slate-300 hover:bg-white/5"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </aside>
  );
}
