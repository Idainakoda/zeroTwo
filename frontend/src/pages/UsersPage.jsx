import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getUsers, updateUser } from "../services/adminService";
import { Card, ErrorBox, PageHeader } from "../components/common/Card";
import LoadingSpinner from "../components/common/LoadingSpinner";

const CLEARANCES = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "SECRET"];
const ROLES = ["EMPLOYEE", "SECURITY_ANALYST", "ADMIN"];
const selectClass = "rounded-lg zt-input px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-400/40";

export default function UsersPage() {
  const { token, user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let alive = true;
    getUsers(token)
      .then((data) => alive && setUsers(data))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [token, reloadKey]);

  async function change(u, changes) {
    setError("");
    try {
      await updateUser(token, u.id, changes);
      setSaved(`Updated ${u.fullName}. Document access changes from their next request.`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Access control" title="Users & clearance"
        text="Clearance and department decide which documents the assistant may retrieve for each user." />
      <ErrorBox message={error} />
      {saved && <p className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">{saved}</p>}
      <Card>
        {!users ? <LoadingSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  {["User", "Department", "Clearance", "Role"].map((h) => (
                    <th key={h} className="border-b border-white/10 px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-white/5">
                    <td className="px-3 py-3">
                      <p className="text-sm text-slate-200">{u.fullName}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    <td className="px-3 py-3">
                      <input defaultValue={u.department} aria-label={`Department of ${u.fullName}`}
                        onBlur={(e) => e.target.value !== u.department && change(u, { department: e.target.value })}
                        className="w-36 rounded-lg zt-input px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-400/40" />
                    </td>
                    <td className="px-3 py-3">
                      <select value={u.clearance} onChange={(e) => change(u, { clearance: e.target.value })} className={selectClass}
                        aria-label={`Clearance of ${u.fullName}`}>
                        {CLEARANCES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <select value={u.roles[0]} disabled={u.id === me?.userId} onChange={(e) => change(u, { role: e.target.value })}
                        className={selectClass} aria-label={`Role of ${u.fullName}`}>
                        {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                      </select>
                    </td>
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
