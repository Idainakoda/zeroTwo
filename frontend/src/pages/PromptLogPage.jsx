import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getPromptLog } from "../services/adminService";
import { Card, ErrorBox, PageHeader } from "../components/common/Card";
import StatusBadge from "../components/common/StatusBadge";
import LoadingSpinner from "../components/common/LoadingSpinner";
import EmptyState from "../components/common/EmptyState";
import { formatDateTime, formatMs, splitList, typeLabel } from "../utils/formatters";

/** Splits stored text so placeholders like <AADHAAR_1> stand out. */
function MaskedText({ text }) {
  if (!text) return <span className="text-slate-600">Not stored</span>;
  return String(text).split(/(<[A-Z_]+_\d+>)/g).map((part, i) =>
    /^<[A-Z_]+_\d+>$/.test(part)
      ? <mark key={i} className="rounded bg-cyan-400/15 px-1 text-cyan-200">{part}</mark>
      : <span key={i}>{part}</span>
  );
}

export default function PromptLogPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("ALL");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    getPromptLog(token)
      .then((data) => alive && setRows(data))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [token, reloadKey]);

  const shown = useMemo(() => (rows || []).filter((r) =>
    (action === "ALL" || r.action === action)
    && (!query || `${r.promptText} ${r.userName} ${r.findingTypes}`.toLowerCase().includes(query.toLowerCase()))
  ), [rows, query, action]);

  return (
    <div>
      <PageHeader
        eyebrow="Prompt log"
        title="Prompts sent through the gateway"
        text="Every prompt is stored as the gateway saw it after masking: personal data and secrets are replaced by placeholders such as <AADHAAR_1>, so this log can never leak them."
        right={
          <button onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      />
      <ErrorBox message={error} />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action"
            className="rounded-lg border border-white/10 bg-[#0a1120] px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-300/40">
            {["ALL", "ALLOW", "WARN", "MASK", "REDACT", "REQUIRE_APPROVAL", "BLOCK"].map((a) => (
              <option key={a} value={a}>{a === "ALL" ? "All actions" : a.replace("_", " ").toLowerCase()}</option>
            ))}
          </select>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search prompt, user or type"
            className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-[#0a1120] px-3 py-1.5 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-300/40" />
          <span className="text-xs text-slate-500">{shown.length} of {rows?.length || 0}</span>
        </div>
        {!rows ? <LoadingSpinner /> : shown.length === 0 ? (
          <EmptyState title="No prompts yet" text="Prompts appear here as soon as anyone uses the Secure Assistant." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  {["Time", "User", "Prompt (masked)", "Detected", "Action", "Answer", "Time taken"].map((h) => (
                    <th key={h} className="border-b border-white/10 px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 align-top">
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-400">{formatDateTime(r.createdAt)}</td>
                    <td className="px-3 py-3 text-xs text-slate-300">{r.userName}<div className="text-slate-600">{r.department}</div></td>
                    <td className="max-w-[420px] px-3 py-3 text-xs leading-5 text-slate-200">
                      <p className="line-clamp-4 whitespace-pre-wrap break-words"><MaskedText text={r.promptText} /></p>
                      {r.unauthorisedRetrieval && <p className="mt-1 text-[11px] text-rose-300">Restricted document requested</p>}
                    </td>
                    <td className="max-w-[200px] px-3 py-3 text-xs text-slate-400">
                      {splitList(r.findingTypes).map(typeLabel).join(", ") || <span className="text-slate-600">-</span>}
                    </td>
                    <td className="px-3 py-3"><StatusBadge action={r.action} /></td>
                    <td className="px-3 py-3">{r.responseDecision ? <StatusBadge action={r.responseDecision} /> : <span className="text-xs text-slate-600">-</span>}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-slate-400">{formatMs(r.totalMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
