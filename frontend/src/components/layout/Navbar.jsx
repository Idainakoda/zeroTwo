import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getGatewayStatus } from "../../services/promptService";
import { ClassificationBadge } from "../common/StatusBadge";

function Dot({ ok, warn, label, title }) {
  const color = ok ? "bg-emerald-400" : warn ? "bg-amber-400" : "bg-rose-400";
  return (
    <span title={title} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

export default function Navbar({ onMenu }) {
  const { token, user } = useAuth();
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const s = await getGatewayStatus(token);
        if (alive) setStatus(s);
      } catch {
        if (alive) setStatus({ engine: { status: "unreachable" } });
      }
    }
    load();
    const id = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [token]);

  const engine = status?.engine || {};
  // "degraded" only lists optional layers that are missing (e.g. the local model): the engine is up.
  const engineOk = engine.status === "ok" || engine.status === "degraded";
  const missingCore = (engine.missing_layers || []).filter((l) => l !== "local_llm");
  const mlOk = engine.ml_injection?.semantic && engine.ml_injection?.classifier && missingCore.length === 0;
  const gemini = status?.gemini;
  const local = engine.local_llm?.reachable;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/10 bg-[#050816]/85 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onMenu} className="rounded-lg border border-white/10 p-2 text-slate-300 lg:hidden" aria-label="Open menu">
          <Menu className="h-4 w-4" />
        </button>
        <div className="hidden flex-wrap gap-2 sm:flex">
          <Dot ok={engineOk && mlOk} warn={engineOk && !mlOk} label="Security engine"
               title={engineOk ? (mlOk ? "Rules, ML and RAG layers loaded" : "Running with rules only") : "Engine unreachable: requests are blocked (fail-closed)"} />
          <Dot ok={gemini?.configured} warn={!gemini?.configured} label={gemini?.configured ? `Gemini` : "Gemini off"}
               title={gemini?.configured ? gemini.model : "No external AI key configured"} />
          <Dot ok={local} warn={!local} label={local ? "Local model" : "Local model off"}
               title="Ollama: used for SECRET documents and grey-zone checks" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-xs text-slate-400">{user?.department || "General"}</p>
          <p className="text-[11px] text-slate-600">{(user?.roles || []).join(", ")}</p>
        </div>
        <ClassificationBadge level={user?.clearance || "INTERNAL"} />
      </div>
    </header>
  );
}
