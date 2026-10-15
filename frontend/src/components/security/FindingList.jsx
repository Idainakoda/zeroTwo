import { Badge } from "../common/StatusBadge";
import { categoryLabel, typeLabel } from "../../utils/formatters";

const CATEGORY_TONE = {
  PII: "cyan",
  FINANCIAL: "sky",
  SECRET: "violet",
  CONFIDENTIAL: "amber",
  INJECTION: "rose",
  OUTPUT_LEAK: "rose",
};

function categoryTone(category) {
  return CATEGORY_TONE[category] || "slate";
}

export default function FindingList({ findings, compact = false }) {
  if (!findings || findings.length === 0) {
    return <p className="text-xs text-slate-500">No findings.</p>;
  }
  return (
    <ul className="space-y-2">
      {findings.map((f, i) => (
        <li key={`${f.type}-${i}`} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={categoryTone(f.category)}>{categoryLabel(f.category)}</Badge>
            <span className="text-sm text-slate-200">{typeLabel(f.type)}</span>
            {f.preview && (
              <code className="rounded bg-black/30 px-1.5 py-0.5 text-[11px] text-slate-400">{f.preview}</code>
            )}
          </div>
          {!compact && (
            <div className="mt-2 flex items-center gap-3">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-indigo-400/70"
                  style={{ width: `${Math.round((f.confidence || 0) * 100)}%` }}
                />
              </div>
              <span className="w-10 text-right text-[11px] tabular-nums text-slate-500">
                {Math.round((f.confidence || 0) * 100)}%
              </span>
              <span className="text-[11px] text-slate-600">{f.detector}</span>
            </div>
          )}
          {!compact && f.reason && <p className="mt-1 text-[11px] leading-4 text-slate-500">{f.reason}</p>}
        </li>
      ))}
    </ul>
  );
}
