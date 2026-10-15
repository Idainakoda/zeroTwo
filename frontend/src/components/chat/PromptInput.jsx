import { useRef, useState } from "react";
import { FileText, Paperclip, SendHorizontal, Sparkles, X } from "lucide-react";
import { SCENARIOS } from "./scenarios";

const ACCEPT = ".txt,.md,.csv,.json,.log";
const MAX_ATTACHMENT = 60000;

export default function PromptInput({ onSend, busy }) {
  const [text, setText] = useState("");
  const [useDocuments, setUseDocuments] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [fileError, setFileError] = useState("");
  const fileRef = useRef(null);

  function submit(e) {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    onSend({ prompt: text.trim(), useDocuments, attachment });
    setText("");
    setAttachment(null);
  }

  function applyScenario(s) {
    setText(s.prompt);
    setUseDocuments(Boolean(s.useDocuments));
    setAttachment(s.attachment || null);
    setFileError("");
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setFileError("");
    if (!file) return;
    const content = await file.text();
    if (content.length > MAX_ATTACHMENT) {
      setFileError("File is too large (max 60,000 characters).");
      return;
    }
    setAttachment({ name: file.name, text: content });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-mist">
          <Sparkles className="h-3 w-3" /> Try a scenario
        </span>
        {SCENARIOS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => applyScenario(s)}
            aria-label={`${s.group}: ${s.label}`}
            title={s.group}
            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300 transition hover:border-indigo-400/40 hover:text-indigo-200"
          >
            {s.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="rounded-2xl zt-input p-3 focus-within:border-indigo-400/40">
        <label htmlFor="prompt" className="sr-only">Message</label>
        <textarea
          id="prompt"
          rows={3}
          value={text}
          maxLength={20000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(e);
          }}
          placeholder="Ask anything. Sensitive data is masked and attacks are blocked before the AI sees your message."
          className="w-full resize-y bg-transparent px-1 text-sm leading-6 text-white outline-none placeholder:text-slate-600"
        />
        {attachment && (
          <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-300">
            <Paperclip className="h-3 w-3" /> {attachment.name}
            <span className="text-slate-500">({attachment.text.length.toLocaleString()} chars)</span>
            <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment">
              <X className="h-3 w-3 text-slate-400 hover:text-white" />
            </button>
          </div>
        )}
        {fileError && <p className="mt-2 text-xs text-rose-300">{fileError}</p>}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setUseDocuments(!useDocuments)}
              aria-pressed={useDocuments}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                useDocuments ? "border-indigo-400/40 bg-indigo-400/10 text-indigo-200" : "border-white/10 text-slate-400 hover:text-white"
              }`}
            >
              <FileText className="h-3.5 w-3.5" /> Use department documents
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white"
            >
              <Paperclip className="h-3.5 w-3.5" /> Attach text file
            </button>
            <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={onFile} />
            <span className="text-[11px] text-slate-600">{text.length.toLocaleString()}/20,000 · Ctrl+Enter to send</span>
          </div>
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="inline-flex items-center gap-2 rounded-xl zt-button px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-40"
          >
            {busy ? "Checking..." : "Send securely"} <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
