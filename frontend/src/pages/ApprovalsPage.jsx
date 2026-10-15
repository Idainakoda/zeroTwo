import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { approveRequest, getApprovals, rejectRequest } from "../services/adminService";
import { Button, Card, ErrorBox, PageHeader } from "../components/common/Card";
import StatusBadge from "../components/common/StatusBadge";
import EmptyState from "../components/common/EmptyState";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { formatDateTime, splitList, typeLabel } from "../utils/formatters";

const TABS = ["PENDING", "APPROVED", "REJECTED"];

export default function ApprovalsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState(null);
  const [tab, setTab] = useState("PENDING");
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let alive = true;
    getApprovals(token)
      .then((data) => alive && setItems(data))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [token, reloadKey]);

  async function decide(id, approve) {
    setBusy(id);
    setError("");
    try {
      if (approve) await approveRequest(token, id, notes[id] || "");
      else await rejectRequest(token, id, notes[id] || "");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  const shown = (items || []).filter((a) => a.status === tab);

  return (
    <div>
      <PageHeader eyebrow="Require approval" title="Approval queue"
        text="Requests held by a REQUIRE_APPROVAL policy. Only the masked prompt is stored. Approving sends it to the AI model and returns the answer to the employee." />
      <ErrorBox message={error} />
      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-sm transition ${tab === t ? "zt-button" : "border border-white/10 text-slate-400 hover:text-white"}`}>
            {t.charAt(0) + t.slice(1).toLowerCase()} ({(items || []).filter((a) => a.status === t).length})
          </button>
        ))}
      </div>
      {!items ? <LoadingSpinner /> : shown.length === 0 ? (
        <EmptyState title={`No ${tab.toLowerCase()} requests`} />
      ) : (
        <div className="space-y-4">
          {shown.map((a) => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">#{a.id} · {a.userName}</p>
                    <StatusBadge action={a.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{a.department || "General"} · {formatDateTime(a.createdAt)} · risk {a.riskScore}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {splitList(a.findingTypes).map((t) => (
                    <span key={t} className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">{typeLabel(t)}</span>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-xs text-amber-200/80">{a.reason}</p>
              <p className="mt-1 text-[11px] text-slate-500">{a.policyName}</p>
              <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-white/5 bg-black/30 p-3 text-xs leading-5 text-slate-300">
                {a.maskedPrompt}
              </pre>
              {a.status === "PENDING" ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <input value={notes[a.id] || ""} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })}
                    placeholder="Note for the record (optional)"
                    className="min-w-[220px] flex-1 rounded-lg zt-input px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-400/40" />
                  <Button variant="danger" disabled={busy === a.id} onClick={() => decide(a.id, false)}><X className="h-4 w-4" /> Reject</Button>
                  <Button variant="success" disabled={busy === a.id} onClick={() => decide(a.id, true)}>
                    <Check className="h-4 w-4" /> {busy === a.id ? "Sending to AI..." : "Approve & send"}
                  </Button>
                </div>
              ) : (
                <div className="mt-3 text-xs text-slate-400">
                  Decided {formatDateTime(a.decidedAt)}{a.reviewerNote ? ` · "${a.reviewerNote}"` : ""}
                  {a.answer && (
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-white/5 bg-black/30 p-3 leading-5 text-slate-300">{a.answer}</pre>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
