import { NavLink } from "react-router-dom";
import {
  BarChart3,
  BookOpenCheck,
  ClipboardCheck,
  FileLock2,
  FlaskConical,
  History,
  MessagesSquare,
  MessageSquareLock,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Logo from "../brand/Logo";

const EMPLOYEE_LINKS = [
  { to: "/assistant", label: "Secure assistant", icon: MessageSquareLock },
  { to: "/activity", label: "My activity", icon: History },
  { to: "/documents", label: "Documents", icon: FileLock2 },
  { to: "/guidelines", label: "Guidelines", icon: BookOpenCheck },
];

const MONITOR_LINKS = [
  { to: "/admin", label: "Overview", icon: BarChart3, end: true },
  { to: "/admin/prompts", label: "Prompt log", icon: MessagesSquare },
  { to: "/admin/incidents", label: "Incidents", icon: ShieldAlert },
  { to: "/admin/approvals", label: "Approvals", icon: ClipboardCheck },
  { to: "/admin/audit", label: "Audit log", icon: ScrollText },
  { to: "/admin/policies", label: "Policies", icon: SlidersHorizontal },
  { to: "/admin/evaluation", label: "Evaluation lab", icon: FlaskConical },
];

const ADMIN_ONLY = [{ to: "/admin/users", label: "Users & clearance", icon: Users }];

function Item({ to, label, icon: Icon, end, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
          isActive
            ? "bg-gradient-to-r from-[#4f7cff]/35 to-[#8b5cf6]/20 font-medium text-white ring-1 ring-indigo-300/35 shadow-[inset_3px_0_0_#8ea8ff]"
            : "text-mist hover:bg-white/[0.05] hover:text-white"
        }`
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {label}
    </NavLink>
  );
}

export default function Sidebar({ onNavigate }) {
  const { isAdmin, isMonitor } = useAuth();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-[var(--zt-line)] bg-[#070b1d]/80 px-4 py-5 backdrop-blur-xl">
      <div className="px-2">
        <Logo size={38} />
      </div>

      <nav className="mt-8 flex-1 space-y-6 overflow-y-auto" aria-label="Main">
        <div className="space-y-1">
          <p className="px-3 pb-1 text-xs font-medium text-mist/70">Workspace</p>
          {EMPLOYEE_LINKS.map((l) => <Item key={l.to} {...l} onNavigate={onNavigate} />)}
        </div>
        {isMonitor && (
          <div className="space-y-1">
            <p className="px-3 pb-1 text-xs font-medium text-mist/70">Security</p>
            {MONITOR_LINKS.map((l) => <Item key={l.to} {...l} onNavigate={onNavigate} />)}
            {isAdmin && ADMIN_ONLY.map((l) => <Item key={l.to} {...l} onNavigate={onNavigate} />)}
          </div>
        )}
      </nav>

      <div className="zt-glass mt-4 rounded-2xl p-4">
        <ShieldCheck className="h-6 w-6 text-[#a5b4fc]" />
        <p className="mt-3 font-display text-sm font-semibold text-white">Keep data safe.</p>
        <p className="mt-1 text-xs leading-5 text-mist">Every prompt is checked before the AI sees it.</p>
      </div>
    </aside>
  );
}
