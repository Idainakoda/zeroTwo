import { useEffect, useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getMyDocuments } from "../services/promptService";
import { Card, ErrorBox, PageHeader } from "../components/common/Card";
import { ClassificationBadge } from "../components/common/StatusBadge";
import LoadingSpinner from "../components/common/LoadingSpinner";

const LEVELS = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "SECRET"];

export default function DocumentsPage() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyDocuments(token).then(setData).catch((e) => setError(e.message));
  }, [token]);

  return (
    <div>
      <PageHeader eyebrow="Knowledge base" title="Department documents"
        text="The assistant can only search documents at or below your clearance (and, for department-restricted documents, only your department). Restricted documents are filtered out before the search runs, so their text never reaches the AI." />
      <ErrorBox message={error} />
      {!data ? <LoadingSpinner /> : (
        <>
          <Card className="mb-6">
            <p className="text-xs font-medium text-mist">Your access</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {LEVELS.map((l) => (
                <span key={l} className={LEVELS.indexOf(l) <= LEVELS.indexOf(data.clearance) ? "" : "opacity-30"}>
                  <ClassificationBadge level={l} />
                </span>
              ))}
              <span className="ml-2 text-sm text-slate-400">Department: <span className="text-white">{data.department || "General"}</span></span>
            </div>
          </Card>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.documents.map((d) => (
              <Card key={d.id} className={d.accessible ? "" : "opacity-70"}>
                <div className="flex items-start justify-between gap-3">
                  <ClassificationBadge level={d.classification} />
                  {d.accessible
                    ? <span className="inline-flex items-center gap-1 text-xs text-emerald-300"><LockOpen className="h-3.5 w-3.5" /> Accessible</span>
                    : <span className="inline-flex items-center gap-1 text-xs text-rose-300"><Lock className="h-3.5 w-3.5" /> Restricted</span>}
                </div>
                <p className="mt-3 text-sm font-medium text-white">{d.accessible ? d.title : "Restricted document"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {d.id} · {d.chunks} section(s)
                  {d.departments?.length ? ` · ${d.departments.join(", ")} only` : ""}
                </p>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
