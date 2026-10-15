import { useRef, useState } from "react";
import { FileText, IdCard, Loader2, Paperclip, ScanText, SendHorizontal, Sparkles, X } from "lucide-react";
import { SCENARIOS } from "./scenarios";
import { useAuth } from "../../context/AuthContext";
import { extractAttachment } from "../../services/promptService";

// Documents, pictures and plain text. Configuration and credential files (.env, keys) are not accepted.
const EXTENSIONS = [".pdf", ".docx", ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff",
  ".txt", ".md", ".csv", ".json", ".log"];
const ACCEPT = EXTENSIONS.join(",");
const MAX_BYTES = 10 * 1024 * 1024;

const WARNINGS = {
  "page-limit": "Only the first 30 pages were read.",
  "ocr-limit": "Only the first 25 pictures were read.",
  "ocr-unavailable": "Pictures could not be read (OCR is not available on the engine).",
};

// "an Aadhaar card", "a PAN card", "a bank statement"
function withArticle(label) {
  const word = /^[A-Z][a-z]/.test(label) && !label.startsWith("Aadhaar") ? label[0].toLowerCase() + label.slice(1) : label;
  return `${/^[AEIOU]/i.test(word) ? "an" : "a"} ${word}`;
}

export default function PromptInput({ onSend, busy }) {
  const { token } = useAuth();
  const [text, setText] = useState("");
  const [useDocuments, setUseDocuments] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [fileError, setFileError] = useState("");
  const [reading, setReading] = useState("");
  const fileRef = useRef(null);

  function submit(e) {
    e?.preventDefault();
    if (!text.trim() || busy || reading) return;
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
    const name = file.name.toLowerCase();
    if (!EXTENSIONS.some((ext) => name.endsWith(ext)) || name.startsWith(".env") || name.endsWith(".env")) {
      setFileError("This file type is not supported. Attach a PDF, Word (.docx), picture (PNG, JPG) or text file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileError("The file is larger than 10 MB.");
      return;
    }
    setAttachment(null);
    setReading(file.name);
    try {
      const r = await extractAttachment(token, file);
      if (!r.text || !r.text.trim()) {
        setFileError("No readable text was found in this file.");
        return;
      }
      setAttachment({
        name: r.name || file.name,
        text: r.text,
        kind: r.kind,
        pages: r.pages,
        ocrImages: r.ocrImages,
        documents: r.documentTypes || [],
        notes: [r.truncated ? "Only the first 60,000 characters will be checked and sent." : null,
          ...(r.warnings || []).map((w) => WARNINGS[w])].filter(Boolean),
      });
    } catch (err) {
      setFileError(err.message || "This file could not be read.");
    } finally {
      setReading("");
    }
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
        {reading && (
          <p className="mt-2 inline-flex items-center gap-2 text-xs text-mist" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading {reading}. Pictures are read with OCR, which can take a few seconds.
          </p>
        )}
        {attachment && (
          <div className="mt-2 space-y-2">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-300">
              <Paperclip className="h-3 w-3" /> {attachment.name}
              <span className="text-slate-500">
                {attachment.text.length.toLocaleString()} characters
                {attachment.pages > 1 ? `, ${attachment.pages} pages` : ""}
              </span>
              {attachment.ocrImages > 0 && (
                <span className="inline-flex items-center gap-1 text-[#a5b4fc]">
                  <ScanText className="h-3 w-3" /> text read from {attachment.ocrImages} picture{attachment.ocrImages > 1 ? "s" : ""}
                </span>
              )}
              <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment">
                <X className="h-3 w-3 text-slate-400 hover:text-white" />
              </button>
            </div>
            {(attachment.documents || []).length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                <IdCard className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  This looks like {attachment.documents.map((d) => withArticle(d.label)).join(" and ")}. Its numbers are masked before
                  the AI sees anything, and your organisation's {attachment.documents.some((d) => d.group === "IDENTITY")
                    ? "identity-document" : "financial-data"} policy applies. It may need supervisor approval.
                </p>
              </div>
            )}
            {(attachment.notes || []).map((n) => <p key={n} className="text-xs text-amber-200">{n}</p>)}
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
              disabled={Boolean(reading)}
              title="PDF, Word, pictures (PNG, JPG) or text, up to 10 MB"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-50"
            >
              <Paperclip className="h-3.5 w-3.5" /> Attach file
            </button>
            <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={onFile} />
            <span className="text-[11px] text-slate-600">{text.length.toLocaleString()}/20,000 · Ctrl+Enter to send</span>
          </div>
          <button
            type="submit"
            disabled={busy || Boolean(reading) || !text.trim()}
            className="inline-flex items-center gap-2 rounded-xl zt-button px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-40"
          >
            {busy ? "Checking..." : "Send securely"} <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
