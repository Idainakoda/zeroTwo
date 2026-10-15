import { Fragment, useEffect, useState } from "react";
import { Link2, ShieldCheck, ShieldX } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getAuditLogs, verifyAuditChain } from "../services/adminService";
import { Button, Card, ErrorBox, PageHeader } from "../components/common/Card";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { formatDateTime } from "../utils/formatters";

function prettyJson(s) {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

export default function AuditLogsPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState(null);
  const [verify, setVerify] = useState(null);
  const [checking, setChecking] = useState(false);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAuditLogs(token).then(setLogs).catch((e) => setError(e.message));
  }, [token]);

  async function runVerify() {
    setChecking(true);
    try {
      setVerify(await verifyAuditChain(token));
    } catch (e) {
      setError(e.message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Privacy-aware audit log" title="Audit trail"
        text="Each entry records what was flagged, which policy fired and the action taken: types, counts and keyed hashes only, never the sensitive content. Entries are hash-chained, so editing or deleting any row is detectable."
        right={<Button onClick={runVerify} disabled={checking}><Link2 className="h-4 w-4" /> {checking ? "Verifying..." : "Verify chain integrity"}</Button>}
      />
      <ErrorBox message={error} />
      {verify && (
        <div className={`mb-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${verify.valid ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-rose-400/25 bg-rose-400/10 text-rose-200"}`}>
          {verify.valid ? <ShieldCheck className="h-5 w-5" /> : <ShieldX className="h-5 w-5" />}
          {verify.valid
            ? `Chain intact: ${verify.checked} entries verified. Latest hash ${String(verify.latestHash).slice(0, 16)}…`
            : `Chain broken at entry #${verify.brokenAtId} (after ${verify.checked} valid entries).`}
        </div>
      )}
      <Card>
        {!logs ? <LoadingSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  {["#", "Time", "User", "Action", "Details", "Hash"].map((h) => (
                    <th key={h} className="border-b border-white/10 px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <Fragment key={l.id}>
                    <tr className="cursor-pointer border-b border-white/5 align-top hover:bg-white/[0.02]" onClick={() => setOpen(open === l.id ? null : l.id)}>
                      <td className="px-3 py-3 text-xs text-slate-500">{l.id}</td>
                      <td className="px-3 py-3 text-xs text-slate-400">{formatDateTime(l.createdAt)}</td>
                      <td className="px-3 py-3 text-xs text-slate-400">#{l.userId}</td>
                      <td className="px-3 py-3 text-xs font-medium text-slate-200">{l.action}</td>
                      <td className="max-w-[420px] px-3 py-3 text-xs text-slate-400">{l.details}</td>
                      <td className="px-3 py-3 font-mono text-[11px] text-slate-500">{l.hash ? `${l.hash.slice(0, 10)}…` : "-"}</td>
                    </tr>
                    {open === l.id && (
                      <tr className="border-b border-white/5">
                        <td colSpan={6} className="px-3 pb-4">
                          <p className="mb-1 font-mono text-[11px] text-slate-500">prev {l.prevHash} → hash {l.hash}</p>
                          {l.metadata ? (
                            <pre className="max-h-72 overflow-auto rounded-lg border border-white/5 bg-black/30 p-3 text-[11px] leading-4 text-slate-400">{prettyJson(l.metadata)}</pre>
                          ) : <p className="text-xs text-slate-600">No engine metadata for this entry.</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
