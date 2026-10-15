import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getIncidents } from "../services/adminService";
import { Card, ErrorBox, PageHeader } from "../components/common/Card";
import IncidentTable from "../components/dashboard/IncidentTable";
import LoadingSpinner from "../components/common/LoadingSpinner";

const FILTERS = {
  decision: ["ALL", "BLOCK", "REQUIRE_APPROVAL", "REDACT", "MASK", "WARN", "SANITIZE"],
  direction: ["ALL", "PROMPT", "RESPONSE", "RETRIEVAL"],
  severity: ["ALL", "HIGH", "MEDIUM", "LOW"],
};

function Select({ label, value, options, onChange }) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-400">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded-lg zt-input px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-400/40">
        {options.map((o) => <option key={o} value={o}>{o === "ALL" ? "All" : o.replace("_", " ").toLowerCase()}</option>)}
      </select>
    </label>
  );
}

export default function IncidentsPage() {
  const { token } = useAuth();
  const [incidents, setIncidents] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState({ decision: "ALL", direction: "ALL", severity: "ALL", q: "" });

  useEffect(() => {
    getIncidents(token).then(setIncidents).catch((e) => setError(e.message));
  }, [token]);

  const shown = useMemo(() => (incidents || []).filter((i) =>
    (filter.decision === "ALL" || i.decision === filter.decision)
    && (filter.direction === "ALL" || (i.direction || "PROMPT") === filter.direction)
    && (filter.severity === "ALL" || i.severity === filter.severity)
    && (!filter.q || `${i.findingTypes} ${i.category} ${i.description}`.toLowerCase().includes(filter.q.toLowerCase()))
  ), [incidents, filter]);

  return (
    <div>
      <PageHeader eyebrow="Incidents" title="Flagged requests"
        text="What was flagged, which policy fired and the action taken. No prompt text or detected values are stored." />
      <ErrorBox message={error} />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <Select label="Action" value={filter.decision} options={FILTERS.decision} onChange={(v) => setFilter({ ...filter, decision: v })} />
          <Select label="Where" value={filter.direction} options={FILTERS.direction} onChange={(v) => setFilter({ ...filter, direction: v })} />
          <Select label="Severity" value={filter.severity} options={FILTERS.severity} onChange={(v) => setFilter({ ...filter, severity: v })} />
          <input value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} placeholder="Search type or category"
            className="min-w-[200px] flex-1 rounded-lg zt-input px-3 py-1.5 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-400/40" />
          <span className="text-xs text-slate-500">{shown.length} of {incidents?.length || 0}</span>
        </div>
        {!incidents ? <LoadingSpinner /> : <IncidentTable incidents={shown} />}
      </Card>
    </div>
  );
}
