import { AlertTriangle, Info, ShieldX } from "lucide-react";

const STYLES = {
  warn: { box: "border-amber-400/25 bg-amber-400/[0.07] text-amber-100", icon: AlertTriangle, iconColor: "text-amber-300" },
  block: { box: "border-rose-400/25 bg-rose-400/[0.07] text-rose-100", icon: ShieldX, iconColor: "text-rose-300" },
  info: { box: "border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-100", icon: Info, iconColor: "text-cyan-300" },
};

export default function SecurityAlert({ kind = "info", title, items = [], children }) {
  const style = STYLES[kind] || STYLES.info;
  const Icon = style.icon;
  if (!title && items.length === 0 && !children) return null;
  return (
    <div className={`flex gap-3 rounded-xl border px-3 py-2.5 text-sm ${style.box}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.iconColor}`} />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-medium">{title}</p>}
        {items.map((t, i) => (
          <p key={i} className="text-xs leading-5 opacity-90">{t}</p>
        ))}
        {children}
      </div>
    </div>
  );
}
