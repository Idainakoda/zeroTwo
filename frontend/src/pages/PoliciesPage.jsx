import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  createPolicy, getPolicies, POLICY_ACTIONS, POLICY_TYPES, setPolicyEnabled, updatePolicy,
} from "../services/policyService";
import { Button, Card, ErrorBox, PageHeader } from "../components/common/Card";
import StatusBadge from "../components/common/StatusBadge";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { ACTION_META, categoryLabel } from "../utils/formatters";

const selectClass = "rounded-lg border border-white/10 bg-[#0a1120] px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-300/40 disabled:opacity-60";

export default function PoliciesPage() {
  const { token, isAdmin } = useAuth();
  const [policies, setPolicies] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [draft, setDraft] = useState({ name: "", policyType: "PII", action: "MASK", description: "" });

  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let alive = true;
    getPolicies(token)
      .then((data) => alive && setPolicies(data))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [token, reloadKey]);

  async function changeAction(p, action) {
    setError("");
    try {
      await updatePolicy(token, p.id, { ...p, action });
      setSaved(`"${p.name}" now ${ACTION_META[action]?.label.toLowerCase()}. It applies to the next request.`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function toggle(p) {
    try {
      await setPolicyEnabled(token, p.id, !p.enabled);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function add(e) {
    e.preventDefault();
    setError("");
    try {
      await createPolicy(token, draft);
      setDraft({ name: "", policyType: "PII", action: "MASK", description: "" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Configurable actions" title="Policies"
        text="Choose what happens for each kind of finding: allow, warn, mask, redact, require approval or block. When several apply, the strictest wins. Changes take effect on the next request." />
      <ErrorBox message={error} />
      {saved && <p className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">{saved}</p>}

      <div className="mb-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {POLICY_ACTIONS.map((a) => (
          <div key={a} className="rounded-xl border border-white/10 bg-[#0d1424] p-3">
            <StatusBadge action={a} />
            <p className="mt-2 text-[11px] leading-4 text-slate-500">{ACTION_META[a].text}</p>
          </div>
        ))}
      </div>

      <Card>
        {!policies ? <LoadingSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  {["Policy", "Applies to", "Action", "Enabled"].map((h) => (
                    <th key={h} className="border-b border-white/10 px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id} className={`border-b border-white/5 align-top ${p.enabled ? "" : "opacity-50"}`}>
                    <td className="px-3 py-3">
                      <p className="text-sm text-slate-200">{p.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{p.description}</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">{categoryLabel(p.policyType)}</td>
                    <td className="px-3 py-3">
                      <select value={p.action === "SANITIZE" ? "MASK" : p.action} disabled={!isAdmin}
                        onChange={(e) => changeAction(p, e.target.value)} className={selectClass} aria-label={`Action for ${p.name}`}>
                        {POLICY_ACTIONS.map((a) => <option key={a} value={a}>{ACTION_META[a].label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <button disabled={!isAdmin} onClick={() => toggle(p)} role="switch" aria-checked={p.enabled}
                        className={`relative h-5 w-9 rounded-full transition ${p.enabled ? "bg-cyan-400" : "bg-white/10"} disabled:opacity-60`}>
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${p.enabled ? "left-[18px]" : "left-0.5"}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isAdmin && <p className="mt-3 text-xs text-slate-500">Security analysts can view policies; only admins can change them.</p>}
      </Card>

      {isAdmin && (
        <Card className="mt-6">
          <form onSubmit={add} className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs text-slate-400">
              New policy name
              <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="rounded-lg border border-white/10 bg-[#0a1120] px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-300/40" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Applies to
              <select value={draft.policyType} onChange={(e) => setDraft({ ...draft, policyType: e.target.value })} className={selectClass}>
                {POLICY_TYPES.map((t) => <option key={t} value={t}>{categoryLabel(t)}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Action
              <select value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })} className={selectClass}>
                {POLICY_ACTIONS.map((a) => <option key={a} value={a}>{ACTION_META[a].label}</option>)}
              </select>
            </label>
            <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs text-slate-400">
              Description
              <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className="rounded-lg border border-white/10 bg-[#0a1120] px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-300/40" />
            </label>
            <Button type="submit"><Plus className="h-4 w-4" /> Add policy</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
