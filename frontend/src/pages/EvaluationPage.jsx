import { useState } from "react";
import { FlaskConical, Shuffle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { runBlindEvaluation, runEvaluation } from "../services/adminService";
import { Button, Card, CardTitle, ErrorBox, PageHeader } from "../components/common/Card";
import StatCard from "../components/dashboard/StatCard";
import LoadingSpinner from "../components/common/LoadingSpinner";

const pct = (v) => `${(v * 100).toFixed(1)}%`;

function Confusion({ c }) {
  const cell = (label, value, good) => (
    <div className={`rounded-xl border p-4 text-center ${good ? "border-emerald-400/20 bg-emerald-400/[0.06]" : "border-rose-400/20 bg-rose-400/[0.06]"}`}>
      <p className="text-2xl font-semibold tabular-nums text-white">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{label}</p>
    </div>
  );
  return (
    <div>
      <div className="mb-2 grid grid-cols-[90px_1fr_1fr] gap-2 text-center text-[11px] text-slate-500">
        <span />
        <span>Flagged</span>
        <span>Allowed</span>
      </div>
      <div className="grid grid-cols-[90px_1fr_1fr] items-center gap-2">
        <span className="text-right text-[11px] text-slate-500">Adversarial</span>
        {cell("caught (TP)", c.tp, true)}
        {cell("missed (FN)", c.fn, false)}
        <span className="text-right text-[11px] text-slate-500">Legitimate</span>
        {cell("false alarm (FP)", c.fp, false)}
        {cell("correctly allowed (TN)", c.tn, true)}
      </div>
    </div>
  );
}

export default function EvaluationPage() {
  const { token } = useAuth();
  const [report, setReport] = useState(null);
  const [blind, setBlind] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function run(kind) {
    setBusy(kind);
    setError("");
    try {
      if (kind === "main") setReport(await runEvaluation(token));
      else setBlind(await runBlindEvaluation(token));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  const m = report?.metrics;

  return (
    <div>
      <PageHeader eyebrow="Detection metrics" title="Evaluation lab"
        text="Run the labelled test set (legitimate and adversarial prompts, documents and AI answers) through the live engine, and the blind set of reworded attacks the rules were never tuned on."
        right={
          <div className="flex gap-2">
            <Button onClick={() => run("main")} disabled={!!busy}><FlaskConical className="h-4 w-4" /> Run test set</Button>
            <Button variant="ghost" onClick={() => run("blind")} disabled={!!busy}><Shuffle className="h-4 w-4" /> Run blind set</Button>
          </div>
        }
      />
      <ErrorBox message={error} />
      {busy && <LoadingSpinner className="mb-4" label={busy === "main" ? "Running the test set (about a minute)..." : "Running the blind set..."} />}

      {!m && !blind && !busy && (
        <Card><p className="text-sm text-slate-400">Choose a run above. Results are computed live by the security engine.</p></Card>
      )}

      {m && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <StatCard label="Test cases" value={m.total} detail={`${m.legitimate} legitimate · ${m.adversarial} adversarial`} tone="cyan" />
            <StatCard label="Detection accuracy" value={pct(m.detection_accuracy)} tone="emerald" />
            <StatCard label="Precision" value={pct(m.precision)} tone="sky" />
            <StatCard label="Recall" value={pct(m.recall)} tone="violet" />
            <StatCard label="False-positive rate" value={pct(m.false_positive_rate)} detail="On legitimate prompts" tone="amber" />
            <StatCard label="Added delay p95" value={`${Math.round(m.latency_ms.p95)} ms`} detail={`p50 ${Math.round(m.latency_ms.p50)} ms`} tone="slate" />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card>
              <CardTitle title="Confusion matrix" subtitle={`F1 ${pct(m.f1)} · exact decision match ${pct(m.decision_accuracy)}`} />
              <Confusion c={m.confusion} />
            </Card>
            <Card>
              <CardTitle title="By scenario" subtitle="Correct decisions per subset" />
              <ul className="space-y-2">
                {Object.entries(m.by_subset).map(([name, s]) => (
                  <li key={name}>
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>{name.replace(/_/g, " ")}</span>
                      <span className="tabular-nums text-slate-400">{s.correct}/{s.total}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-cyan-500" style={{ width: `${s.accuracy * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          {report.misses?.length > 0 && (
            <Card className="mt-6">
              <CardTitle title="Misses" subtitle="Cases where the decision differed from the label" />
              <ul className="space-y-2 text-xs">
                {report.misses.map((r) => (
                  <li key={r.id} className="rounded-lg bg-white/[0.02] px-3 py-2 text-slate-400">
                    <span className="font-mono text-slate-300">{r.id}</span> · expected {r.expected}, got {r.got} · {(r.reasons || r.types || []).join("; ")}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {blind && (
        <Card className="mt-6">
          <CardTitle title="Robustness to reworded attacks"
            subtitle={`${blind.attacks} unseen attacks and ${blind.legit} legitimate look-alikes · engine p50 ${blind.latency_ms.p50} ms, p95 ${blind.latency_ms.p95} ms`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  {["Layers", "Attacks blocked", "Sent to local model", "Legitimate blocked"].map((h) => (
                    <th key={h} className="border-b border-white/10 px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {blind.table.map((row) => (
                  <tr key={row.layers} className="border-b border-white/5">
                    <td className="px-3 py-3 text-slate-200">{row.layers}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/5">
                          <div className="h-full rounded-full bg-cyan-500" style={{ width: `${(row.attacks_blocked / blind.attacks) * 100}%` }} />
                        </div>
                        <span className="tabular-nums text-slate-300">{row.attacks_blocked}/{blind.attacks}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-slate-400">{row.attacks_to_llm}</td>
                    <td className="px-3 py-3 tabular-nums text-slate-400">{row.legit_blocked}/{blind.legit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {blind.missed?.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Still missed</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-400">
                {blind.missed.map((t) => <li key={t}>• {t}</li>)}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
