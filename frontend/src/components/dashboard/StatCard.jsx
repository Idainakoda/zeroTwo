import { TONE_CLASSES } from "../../utils/formatters";

export default function StatCard({ label, value, detail, icon: Icon, tone = "indigo" }) {
  return (
    <div className="rounded-2xl zt-glass p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        {Icon && (
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${TONE_CLASSES[tone]}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}
