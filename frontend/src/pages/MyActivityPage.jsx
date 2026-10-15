import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getMyApprovals, getMyHistory } from "../services/promptService";
import { Card, CardTitle, ErrorBox, PageHeader } from "../components/common/Card";
import StatusBadge from "../components/common/StatusBadge";
import EmptyState from "../components/common/EmptyState";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { formatDateTime, formatMs, splitList, typeLabel } from "../utils/formatters";

export default function MyActivityPage() {
  const { token } = useAuth();
  const [history, setHistory] = useState(null);
  const [approvals, setApprovals] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    Promise.all([getMyHistory(token), getMyApprovals(token)])
      .then(([h, a]) => {
        setHistory(h);
        setApprovals(a);
      })
      .catch((e) => setError(e.message));
  }, [token]);

  return (
    <div>
      <PageHeader eyebrow="My activity" title="Your requests"
        text="What the gateway did with each of your messages. Prompts are stored only in masked form: personal data and secrets are replaced by placeholders before anything is saved." />
      <ErrorBox message={error} />

      <Card className="mb-6">
        <CardTitle title="My requests needing approval" subtitle="Held by a policy and reviewed by a supervisor" />
        {!approvals ? <LoadingSpinner /> : approvals.length === 0 ? (
          <EmptyState title="No held requests" text="Requests with classified content or bulk personal data appear here." />
        ) : (
          <ul className="space-y-3">
            {approvals.map((a) => (
              <li key={a.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">Request #{a.id}</span>
                    <StatusBadge action={a.status} />
                  </div>
                  <span className="text-xs text-slate-500">{formatDateTime(a.createdAt)}</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">{a.reason}</p>
                {a.reviewerNote && <p className="mt-1 text-xs text-slate-500">Reviewer note: {a.reviewerNote}</p>}
                {a.status === "APPROVED" && (
                  <button onClick={() => setOpen(open === a.id ? null : a.id)} className="mt-2 text-xs text-indigo-300 hover:text-indigo-200">
                    {open === a.id ? "Hide answer" : "Show answer"}
                  </button>
                )}
                {open === a.id && (
                  <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-white/5 bg-black/30 p-3 text-xs leading-5 text-slate-300">
                    {a.answer}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle title="History" subtitle="Most recent first" />
        {!history ? <LoadingSpinner /> : history.length === 0 ? (
          <EmptyState title="No requests yet" text="Use the Secure Assistant to send your first message." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  {["Time", "Prompt (as stored)", "Decision", "Detected", "Documents", "Answer", "Time taken"].map((h) => (
                    <th key={h} className="border-b border-white/10 px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((e) => (
                  <tr key={e.id} className="border-b border-white/5">
                    <td className="px-3 py-3 text-xs text-slate-400">{formatDateTime(e.createdAt)}</td>
                    <td className="max-w-[320px] px-3 py-3 text-xs text-slate-300">
                      <p className="line-clamp-3 whitespace-pre-wrap break-words">{e.promptText || <span className="text-slate-600">Not stored</span>}</p>
                    </td>
                    <td className="px-3 py-3"><StatusBadge action={e.action} /></td>
                    <td className="px-3 py-3 text-xs text-slate-300">
                      {splitList(e.findingTypes).map(typeLabel).join(", ") || <span className="text-slate-600">Nothing sensitive</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">
                      {e.unauthorisedRetrieval ? <span className="text-rose-300">Access denied</span> : e.documentsUsed ? splitList(e.sources).length + " source(s)" : "-"}
                    </td>
                    <td className="px-3 py-3">{e.responseDecision ? <StatusBadge action={e.responseDecision} /> : <span className="text-xs text-slate-600">-</span>}</td>
                    <td className="px-3 py-3 text-xs tabular-nums text-slate-400">{formatMs(e.totalMs)}</td>
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
