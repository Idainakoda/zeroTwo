import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, ClipboardCheck, EyeOff, FileLock2, RefreshCw, ShieldAlert, ShieldX, Timer,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { getDashboardStats, getIncidents } from "../services/adminService";
import { Card, CardTitle, ErrorBox, PageHeader } from "../components/common/Card";
import StatCard from "../components/dashboard/StatCard";
import IncidentTable from "../components/dashboard/IncidentTable";
import LoadingSpinner from "../components/common/LoadingSpinner";
import StatusBadge from "../components/common/StatusBadge";
import { ACTION_META, categoryLabel, formatMs, TONE_HEX, typeLabel } from "../utils/formatters";

// Validated categorical palette for the glass surface (#0e1432): fixed order, never cycled.
const SERIES = [
  { key: "requests", name: "Requests", color: "#4f7cff" },
  { key: "protected", name: "Masked / held", color: "#0d9488" },
  { key: "blocked", name: "Blocked", color: "#d97706" },
];
const AXIS = { stroke: "#334155", tick: { fill: "#94a3b8", fontSize: 11 } };
const TOOLTIP = {
  contentStyle: { background: "#0c1236", border: "1px solid rgba(148,163,255,.25)", borderRadius: 12, fontSize: 12 },
  labelStyle: { color: "#e2e8f0" },
  itemStyle: { color: "#cbd5e1" },
  cursor: { stroke: "rgba(148,163,184,.3)" },
};

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  function load() {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  useEffect(() => {
    let alive = true;
    Promise.all([getDashboardStats(token, 7), getIncidents(token)])
      .then(([s, i]) => {
        if (!alive) return;
        setStats(s);
        setIncidents(i);
        setError("");
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [token, reloadKey]);

  // Auto-refresh every 20 seconds.
  useEffect(() => {
    const id = setInterval(() => setReloadKey((k) => k + 1), 20000);
    return () => clearInterval(id);
  }, []);

  if (!stats) {
    return <div>{error ? <ErrorBox message={error} /> : <LoadingSpinner />}</div>;
  }

  const t = stats.totals;
  const trend = stats.trend.map((d) => ({ ...d, day: d.date.slice(5) }));
  const categories = Object.entries(stats.byCategory)
    .map(([k, v]) => ({ name: categoryLabel(k), count: v }))
    .sort((a, b) => b.count - a.count);
  const totalActions = Object.values(stats.byAction).reduce((a, b) => a + b, 0) || 1;

  return (
    <div>
      <PageHeader
        eyebrow="Security overview"
        title="AI gateway dashboard"
        text="Every request to the AI model, what was detected and what the policy did. Updates every 20 seconds."
        right={
          <button onClick={load} disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        }
      />
      <ErrorBox message={error} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Requests inspected" value={t.requests} detail="All time" icon={Activity} tone="indigo" />
        <StatCard label="Incidents" value={t.incidents} detail="Flagged requests" icon={ShieldAlert} tone="amber" />
        <StatCard label="Blocked" value={t.blocked} detail={`${t.responseBlocked} answers withheld`} icon={ShieldX} tone="rose" />
        <StatCard label="Masked / redacted" value={t.masked} detail={`${t.responseRedacted} answers redacted`} icon={EyeOff} tone="violet" />
        <StatCard label="Restricted retrievals" value={t.retrievalDenied} detail={`${t.documentsUsed} used documents`} icon={FileLock2} tone="sky" />
        <StatCard label="Pending approvals" value={t.pendingApprovals} detail={<Link to="/admin/approvals" className="text-indigo-300 hover:underline">Review queue →</Link>} icon={ClipboardCheck} tone="emerald" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardTitle title="Requests over the last 7 days" subtitle="Inspected, protected (masked or held) and blocked" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 5, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,.08)" vertical={false} />
                <XAxis dataKey="day" {...AXIS} tickLine={false} />
                <YAxis allowDecimals={false} {...AXIS} tickLine={false} axisLine={false} />
                <Tooltip {...TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#cbd5e1" }} iconType="plainline" />
                {SERIES.map((s) => (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2}
                        dot={{ r: 4, strokeWidth: 2, stroke: "#0d1424" }} activeDot={{ r: 5 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitle title="Actions taken" subtitle="Share of all requests" />
          <ul className="space-y-3">
            {Object.entries(stats.byAction).map(([action, count]) => (
              <li key={action}>
                <div className="flex items-center justify-between text-xs">
                  <StatusBadge action={action} />
                  <span className="tabular-nums text-slate-300">{count}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full" style={{
                    width: `${(count / totalActions) * 100}%`,
                    background: TONE_HEX[ACTION_META[action]?.tone] || "#94a3b8",
                  }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card>
          <CardTitle title="Data categories" subtitle="Requests containing each category" />
          {categories.length === 0 ? <p className="text-sm text-slate-500">No detections yet.</p> : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categories} layout="vertical" margin={{ top: 0, right: 16, left: 10, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,.08)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} {...AXIS} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={118} {...AXIS} tickLine={false} axisLine={false} />
                  <Tooltip {...TOOLTIP} cursor={{ fill: "rgba(148,163,184,.06)" }} />
                  <Bar dataKey="count" name="Requests" fill="#4f7cff" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle title="Most detected types" />
          {stats.topTypes.length === 0 ? <p className="text-sm text-slate-500">No detections yet.</p> : (
            <ol className="space-y-2">
              {stats.topTypes.map((x, i) => (
                <li key={x.type} className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2 text-sm">
                  <span className="text-slate-300"><span className="mr-2 text-xs text-slate-600">{i + 1}</span>{typeLabel(x.type)}</span>
                  <span className="tabular-nums text-slate-400">{x.count}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          <CardTitle title="Added delay" subtitle="Security checks vs. the whole request" />
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Engine p50", stats.latency.engineP50],
              ["Engine p95", stats.latency.engineP95],
              ["End-to-end p50", stats.latency.totalP50],
              ["End-to-end p95", stats.latency.totalP95],
            ].map(([label, v]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="flex items-center gap-1 text-[11px] text-slate-500"><Timer className="h-3 w-3" />{label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-white">{formatMs(v)}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            End-to-end time includes the AI model&apos;s own answer time. Active policies: {t.activePolicies}.
          </p>
        </Card>
      </div>

      <Card className="mt-6">
        <CardTitle title="Recent incidents" right={<Link to="/admin/incidents" className="text-xs text-indigo-300 hover:underline">All incidents →</Link>} />
        <IncidentTable incidents={incidents.slice(0, 8)} />
      </Card>
    </div>
  );
}
