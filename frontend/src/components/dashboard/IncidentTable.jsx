import StatusBadge, { Badge } from "../common/StatusBadge";
import EmptyState from "../common/EmptyState";
import { categoryLabel, formatDateTime, splitList, typeLabel } from "../../utils/formatters";

const SEVERITY_TONE = { HIGH: "rose", MEDIUM: "amber", LOW: "sky" };

export default function IncidentTable({ incidents }) {
  if (!incidents || incidents.length === 0) {
    return <EmptyState title="No incidents" text="Flagged requests will appear here." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            {["Time", "User", "Where", "Category", "Detected", "Action", "Severity", "Policy"].map((h) => (
              <th key={h} className="border-b border-white/10 px-3 py-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {incidents.map((i) => (
            <tr key={i.id} className="border-b border-white/5 align-top">
              <td className="px-3 py-3 text-xs text-slate-400">{formatDateTime(i.createdAt)}</td>
              <td className="px-3 py-3 text-xs text-slate-400">#{i.userId}</td>
              <td className="px-3 py-3 text-xs text-slate-400">{i.direction ? i.direction.toLowerCase() : "prompt"}</td>
              <td className="px-3 py-3 text-xs text-slate-200">{splitList(i.category).map(categoryLabel).join(", ")}</td>
              <td className="max-w-[260px] px-3 py-3 text-xs text-slate-400" title={i.description}>
                {i.direction === "RETRIEVAL" ? i.description : splitList(i.findingTypes).map(typeLabel).join(", ") || i.description}
              </td>
              <td className="px-3 py-3"><StatusBadge action={i.decision} /></td>
              <td className="px-3 py-3">{i.severity ? <Badge tone={SEVERITY_TONE[i.severity]}>{i.severity}</Badge> : "-"}</td>
              <td className="max-w-[220px] px-3 py-3 text-[11px] text-slate-500">{i.policyName || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
