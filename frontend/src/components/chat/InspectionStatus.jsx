import { CheckCircle2, CircleDashed, Lock, ShieldCheck, ShieldX, XCircle } from "lucide-react";
import StatusBadge from "../common/StatusBadge";
import FindingList from "../security/FindingList";
import PolicyActionBadge from "../security/PolicyActionBadge";
import { ACTION_META, formatMs } from "../../utils/formatters";

function Step({ state, title, detail, time }) {
  const icon = {
    done: <CheckCircle2 className="h-4 w-4 text-emerald-300" />,
    stop: <XCircle className="h-4 w-4 text-rose-300" />,
    skip: <CircleDashed className="h-4 w-4 text-slate-600" />,
  }[state];
  return (
    <li className="flex gap-3">
      <div className="pt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm ${state === "skip" ? "text-slate-500" : "text-slate-200"}`}>{title}</p>
          {time !== undefined && <span className="text-[11px] tabular-nums text-slate-500">{formatMs(time)}</span>}
        </div>
        {detail && <p className="text-xs leading-5 text-slate-500">{detail}</p>}
      </div>
    </li>
  );
}

function LayerBar({ label, value }) {
  const off = value === null || value === undefined;
  const pct = off ? 0 : Math.round(value * 100);
  const color = pct >= 70 ? "bg-rose-400" : pct >= 30 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div>
      <div className="flex justify-between text-[11px] text-slate-400">
        <span>{label}</span>
        <span className="tabular-nums">{off ? "off" : `${pct}%`}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Right-hand "security inspector" for one gateway result. */
export default function InspectionStatus({ result }) {
  if (!result) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <ShieldCheck className="h-4 w-4 text-cyan-300" /> Security inspector
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Send a message to see how the gateway checks it: personal data, secrets, prompt injection,
          document access and the AI&apos;s answer.
        </p>
      </div>
    );
  }

  const t = result.timing || {};
  const action = result.action;
  const blocked = action === "BLOCK";
  const held = action === "REQUIRE_APPROVAL";
  const retrieval = result.retrieval || {};
  const layers = result.layerScores || {};
  const answered = result.answer !== undefined && result.answer !== null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Gateway decision</p>
            <div className="mt-2 flex items-center gap-2">
              {blocked ? <ShieldX className="h-5 w-5 text-rose-300" /> : <ShieldCheck className="h-5 w-5 text-emerald-300" />}
              <StatusBadge action={action} className="text-xs" />
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">{ACTION_META[action]?.text}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-slate-500">Risk</p>
            <p className={`text-2xl font-semibold tabular-nums ${result.riskScore >= 60 ? "text-rose-300" : result.riskScore >= 25 ? "text-amber-300" : "text-emerald-300"}`}>
              {result.riskScore ?? 0}
            </p>
          </div>
        </div>

        <ol className="mt-5 space-y-3 border-t border-white/5 pt-4">
          <Step state="done" title="Prompt inspection" time={t.engineMs}
                detail={`${(result.findings || []).length} finding(s) · personal data, secrets, confidential content, injection`} />
          {result.attachment && (
            <Step state={result.attachment.quarantined ? "stop" : "done"} title="Attached document scan" time={t.attachmentMs}
                  detail={`${result.attachment.quarantined} of ${result.attachment.sections} section(s) quarantined`} />
          )}
          <Step state={blocked ? "stop" : "done"} title="Policy enforcement"
                detail={(result.policies || []).length ? `${result.policies.length} policy rule(s) applied` : "No policy triggered"} />
          <Step state={!retrieval.used ? "skip" : retrieval.unauthorisedAttempt ? "stop" : "done"} title="Document access control"
                time={t.retrievalMs}
                detail={!retrieval.used ? "Not used for this message"
                  : retrieval.unauthorisedAttempt ? "Matched documents above your clearance: denied and logged"
                  : `${(retrieval.sources || []).length} permitted source(s)`} />
          <Step state={answered || result.provider ? "done" : "skip"} title="AI model" time={t.llmMs}
                detail={result.provider ? result.provider : blocked ? "Not called (blocked)" : held ? "Waiting for approval" : "Not called"} />
          <Step state={!result.answerDecision ? "skip" : result.answerDecision === "BLOCK" ? "stop" : "done"} title="Response inspection"
                time={t.responseCheckMs}
                detail={result.answerDecision ? `Answer ${{ ALLOW: "clean", SANITIZE: "redacted", BLOCK: "withheld" }[result.answerDecision] || result.answerDecision}${(result.answerFindings || []).length ? ` · ${(result.answerFindings || []).length} finding(s)` : ""}` : "-"} />
        </ol>
        <p className="mt-4 border-t border-white/5 pt-3 text-[11px] text-slate-500">
          Total {formatMs(t.totalMs)} · security checks {formatMs((t.engineMs || 0) + (t.attachmentMs || 0) + (t.retrievalMs || 0) + (t.responseCheckMs || 0))}
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-5">
        <p className="mb-3 text-sm font-semibold text-white">Prompt-injection layers</p>
        <div className="space-y-3">
          <LayerBar label="Rules (English, Hinglish, Hindi)" value={layers.rules} />
          <LayerBar label="Semantic similarity" value={layers.semantic} />
          <LayerBar label="ML classifier" value={layers.classifier} />
          <LayerBar label="Combined score" value={layers.fused ?? result.injectionScore} />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-5">
        <p className="mb-3 text-sm font-semibold text-white">Findings</p>
        <FindingList findings={result.findings} />
        {(result.answerFindings || []).length > 0 && (
          <>
            <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">In the AI&apos;s answer</p>
            <FindingList findings={result.answerFindings} compact />
          </>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-5">
        <p className="mb-3 text-sm font-semibold text-white">Policies applied</p>
        <PolicyActionBadge policies={result.policies} />
        <p className="mt-4 flex items-start gap-2 border-t border-white/5 pt-3 text-[11px] leading-4 text-slate-500">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" />
          The audit log keeps types, counts and hashes for request {String(result.requestId).slice(0, 8)}…, never the values.
        </p>
      </div>
    </div>
  );
}
