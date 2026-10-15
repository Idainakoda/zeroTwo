import { useState } from "react";
import { Bot, ChevronDown, ChevronRight, FileText, Paperclip, User } from "lucide-react";
import StatusBadge, { ClassificationBadge } from "../common/StatusBadge";
import SecurityAlert from "../security/SecurityAlert";
import { typeLabel } from "../../utils/formatters";

const HIGHLIGHT = {
  PII: "bg-cyan-400/20 text-cyan-100 ring-cyan-400/40",
  FINANCIAL: "bg-sky-400/20 text-sky-100 ring-sky-400/40",
  SECRET: "bg-violet-400/25 text-violet-100 ring-violet-400/40",
  CONFIDENTIAL: "bg-amber-400/20 text-amber-100 ring-amber-400/40",
};

/** Marks the spans the engine flagged inside the user's own text (offsets from the engine). */
function HighlightedText({ text, findings }) {
  const spans = (findings || [])
    .filter((f) => f.start >= 0 && f.end > f.start && HIGHLIGHT[f.category])
    .sort((a, b) => a.start - b.start);
  if (spans.length === 0) return <span>{text}</span>;
  const parts = [];
  let cursor = 0;
  spans.forEach((f, i) => {
    if (f.start < cursor) return;
    parts.push(<span key={`t${i}`}>{text.slice(cursor, f.start)}</span>);
    parts.push(
      <mark key={`m${i}`} title={typeLabel(f.type)} className={`rounded px-0.5 ring-1 ${HIGHLIGHT[f.category]}`}>
        {text.slice(f.start, f.end)}
      </mark>
    );
    cursor = f.end;
  });
  parts.push(<span key="end">{text.slice(cursor)}</span>);
  return <>{parts}</>;
}

/** Small markdown subset for AI answers: headings, bullet lists, bold. */
function AnswerText({ text }) {
  const lines = String(text).split("\n");
  const blocks = [];
  let list = [];
  const flush = () => {
    if (list.length) {
      blocks.push(<ul key={`l${blocks.length}`} className="my-1 list-disc space-y-1 pl-5">{list}</ul>);
      list = [];
    }
  };
  const inline = (s) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="text-white">{part.slice(2, -2)}</strong> : part
    );
  lines.forEach((line, i) => {
    const bullet = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
    if (bullet) {
      list.push(<li key={i}>{inline(bullet[1])}</li>);
      return;
    }
    flush();
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (heading) {
      blocks.push(<p key={i} className="mt-2 font-semibold text-white">{inline(heading[1])}</p>);
    } else if (line.trim()) {
      blocks.push(<p key={i}>{inline(line)}</p>);
    } else {
      blocks.push(<div key={i} className="h-2" />);
    }
  });
  flush();
  return <div className="space-y-1 text-sm leading-6 text-slate-200">{blocks}</div>;
}

export function UserBubble({ message }) {
  return (
    <div className="flex justify-end gap-3">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm border border-indigo-400/15 bg-indigo-400/[0.07] px-4 py-3">
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">
          <HighlightedText text={message.text} findings={message.result?.findings} />
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
          {message.useDocuments && <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> Department documents</span>}
          {message.attachmentName && <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" /> {message.attachmentName}</span>}
        </div>
      </div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
        <User className="h-4 w-4 text-slate-400" />
      </div>
    </div>
  );
}

export function GatewayBubble({ message, selected, onSelect }) {
  const [showSent, setShowSent] = useState(false);
  const r = message.result;

  if (message.error) {
    return (
      <div className="flex gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rose-400/30 bg-rose-400/10">
          <Bot className="h-4 w-4 text-rose-300" />
        </div>
        <SecurityAlert kind="block" title="Request not processed" items={[message.error]} />
      </div>
    );
  }

  const blocked = r.action === "BLOCK";
  const held = r.action === "REQUIRE_APPROVAL";
  const sources = r.retrieval?.sources || [];
  const sentDiffers = r.sentPrompt && r.sentPrompt !== message.prompt;

  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-indigo-400/30 bg-indigo-400/10">
        <Bot className="h-4 w-4 text-indigo-300" />
      </div>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) onSelect(); }}
        className={`min-w-0 cursor-pointer max-w-[90%] flex-1 rounded-2xl rounded-tl-sm border zt-glass px-4 py-3 text-left transition ${
          selected ? "border-indigo-400/40 ring-1 ring-indigo-400/20" : "border-white/10 hover:border-white/20"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge action={r.action} />
          {r.answerDecision && r.answerDecision !== "ALLOW" && (
            <span className="text-[11px] text-slate-400">answer <StatusBadge action={r.answerDecision} /></span>
          )}
          <span className="text-[11px] text-slate-500">{r.message}</span>
        </div>

        {blocked && (
          <div className="mt-3">
            <SecurityAlert kind="block" title="Why it was blocked" items={(r.reasons || []).slice(0, 3)} />
          </div>
        )}
        {(r.notes || []).length > 0 && (
          <div className="mt-3">
            <SecurityAlert kind="warn" items={r.notes} />
          </div>
        )}
        {held && (
          <div className="mt-3">
            <SecurityAlert kind="info" title={`Held for approval (request #${r.approvalId})`}
              items={["A supervisor will review the masked version. The answer will appear under My Activity → My requests."]} />
          </div>
        )}

        {sentDiffers && (
          <div className="mt-3">
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setShowSent(!showSent); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setShowSent(!showSent); } }}
              className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200"
            >
              {showSent ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              What the AI model received
            </span>
            {showSent && (
              <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-white/5 bg-black/30 p-3 text-xs leading-5 text-slate-300">
                {r.sentPrompt}
              </pre>
            )}
          </div>
        )}

        {r.answer && (
          <div className="mt-3 border-t border-white/5 pt-3">
            <AnswerText text={r.answer} />
          </div>
        )}

        {sources.length > 0 && !blocked && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/5 pt-3">
            {sources
              .filter((s, i, arr) => arr.findIndex((x) => x.docId === s.docId) === i)
              .map((s) => (
                <span key={s.docId} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-slate-300">
                  <FileText className="h-3 w-3 text-slate-500" /> {s.title} <ClassificationBadge level={s.classification} />
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
