
import { useState } from "react";

const sampleHistory = [
  { id: "REQ-2041", category: "Email address", decision: "SANITIZED", time: "10:42 AM" },
  { id: "REQ-2040", category: "No sensitive data", decision: "ALLOWED", time: "10:31 AM" },
  { id: "REQ-2039", category: "API key", decision: "BLOCKED", time: "10:18 AM" },
];

function ResultBadge({ decision }) {
  const styles = {
    ALLOWED: "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
    SANITIZED: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    BLOCKED: "border-rose-400/20 bg-rose-400/10 text-rose-300",
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${styles[decision] || styles.ALLOWED}`}>
      {decision}
    </span>
  );
}

function inspectLocally(prompt) {
  const findings = [];
  let sanitized = prompt;

  const patterns = [
    {
      category: "API key or secret",
      regex: /\b(?:api[_-]?key|secret[_-]?key)\s*[:=]\s*\S+/gi,
      replacement: "[REDACTED_SECRET]",
    },
    {
      category: "Email address",
      regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      replacement: "[REDACTED_EMAIL]",
    },
    {
      category: "Phone number",
      regex: /\b\d{10}\b/g,
      replacement: "[REDACTED_PHONE]",
    },
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(sanitized)) {
      findings.push(pattern.category);
      pattern.regex.lastIndex = 0;
      sanitized = sanitized.replace(pattern.regex, pattern.replacement);
    }
    pattern.regex.lastIndex = 0;
  }

  const containsSecret = findings.includes("API key or secret");

  return {
    decision: containsSecret
      ? "BLOCKED"
      : findings.length > 0
        ? "SANITIZED"
        : "ALLOWED",
    findings,
    sanitized,
  };
}

export default function EmployeeDashboard() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(sampleHistory);
  const [activeTab, setActiveTab] = useState("Inspect Prompt");
  const [notice, setNotice] = useState("");

  function handleInspect(event) {
    event.preventDefault();
    setNotice("");

    if (!prompt.trim()) {
      setNotice("Enter a prompt before running an inspection.");
      setResult(null);
      return;
    }

    const inspection = inspectLocally(prompt);
    const entry = {
      id: `DEMO-${Date.now().toString().slice(-6)}`,
      category: inspection.findings.join(", ") || "No sensitive data detected",
      decision: inspection.decision,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setResult(inspection);
    setHistory((current) => [entry, ...current].slice(0, 8));
  }

  function clearPrompt() {
    setPrompt("");
    setResult(null);
    setNotice("");
  }

  return (
    <div className="min-h-screen bg-[#080d18] text-slate-200">
      <header className="border-b border-white/10 bg-[#0b1120]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 text-2xl text-cyan-300">
              ⛨
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">CyberCup</h1>
              <p className="text-xs text-slate-500">AI Security Gateway</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-amber-400/20 bg-amber-400/5 px-3 py-1.5 text-xs text-amber-200">
              Demo mode
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 font-semibold text-cyan-200">
              E
            </div>
            <div>
              <p className="text-sm font-medium text-white">Employee</p>
              <p className="text-xs text-slate-500">Standard access</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <div className="mb-8">
          <p className="text-sm font-medium tracking-wide text-cyan-300">
            YOUR AI WORKSPACE
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Work with AI. Protect your data.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
            Inspect prompts for sensitive information before sharing them with an
            external AI service.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Inspections in this session", history.length, "Prompt checks"],
            ["Sensitive data types", "3", "Email, phone, secret patterns"],
            ["Protection", "Enabled*", "Local demo inspection"],
          ].map(([label, value, detail]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-[#101827] p-5">
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-3 text-2xl font-bold text-white">{value}</p>
              <p className="mt-2 text-xs text-slate-500">{detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-2 border-b border-white/10 pb-4">
          {["Inspect Prompt", "My History", "Security Tips"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                activeTab === tab
                  ? "bg-cyan-400 text-slate-950"
                  : "border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {notice && (
          <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">
            {notice}
          </div>
        )}

        {activeTab === "Inspect Prompt" && (
          <div className="mt-6 grid items-start gap-6 xl:grid-cols-[1.4fr_0.8fr]">
            <section className="rounded-2xl border border-white/10 bg-[#101827] p-5 sm:p-7">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-xl text-cyan-300">
                  ◈
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Prompt inspection</h3>
                  <p className="mt-1 text-sm leading-5 text-slate-400">
                    Check a prompt for common sensitive-data patterns.
                  </p>
                </div>
              </div>

              <form onSubmit={handleInspect} className="mt-6">
                <label htmlFor="prompt" className="mb-2 block text-sm font-medium text-slate-300">
                  Your prompt
                </label>
                <textarea
                  id="prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  maxLength={20000}
                  rows={9}
                  placeholder="Paste the prompt you want to check here..."
                  className="w-full resize-y rounded-xl border border-white/10 bg-[#090f1c] p-4 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
                />

                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>Up to 20,000 characters</span>
                  <span>{prompt.length}/20,000</span>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                  >
                    Inspect prompt →
                  </button>
                  <button
                    type="button"
                    onClick={clearPrompt}
                    className="rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 hover:bg-white/5"
                  >
                    Clear
                  </button>
                </div>
              </form>

              {result && (
                <div className="mt-7 rounded-xl border border-white/10 bg-[#090f1c] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="font-semibold text-white">Inspection result</h4>
                    <ResultBadge decision={result.decision} />
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {result.decision === "BLOCKED"
                      ? "A possible secret pattern was detected. Do not send this prompt to an AI service."
                      : result.decision === "SANITIZED"
                        ? "Sensitive patterns were found. Review the redacted version before proceeding."
                        : "No matching patterns were detected by this demo checker. This does not guarantee the prompt is safe."}
                  </p>

                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Detected categories
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {result.findings.length ? result.findings.map((finding) => (
                        <span key={finding} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                          {finding}
                        </span>
                      )) : (
                        <span className="text-sm text-slate-400">None detected</span>
                      )}
                    </div>
                  </div>

                  {result.decision !== "BLOCKED" && (
                    <div className="mt-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {result.decision === "SANITIZED" ? "Redacted preview" : "Prompt preview"}
                      </p>
                      <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-white/5 bg-white/[0.02] p-3 text-sm leading-6 text-slate-300">
                        {result.sanitized}
                      </pre>
                    </div>
                  )}

                  <p className="mt-4 text-xs leading-5 text-amber-300/80">
                    Demo only: this result is generated in your browser. It is not a
                    backend security decision and does not authorize sending the prompt.
                  </p>
                </div>
              )}
            </section>

            <aside className="space-y-5">
              <section className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="text-2xl text-cyan-300">🛡</span>
                  <h3 className="font-semibold text-white">How protection works</h3>
                </div>
                <div className="mt-5 space-y-4">
                  {[
                    ["01", "Inspect", "Look for known sensitive-data patterns."],
                    ["02", "Sanitize", "Redact matching data when applicable."],
                    ["03", "Review", "Review the result before proceeding."],
                  ].map(([number, title, description]) => (
                    <div key={number} className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/20 text-xs font-semibold text-cyan-300">
                        {number}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-white">{title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#101827] p-5 sm:p-6">
                <h3 className="font-semibold text-white">Remember</h3>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-400">
                  <li>• Never paste passwords or access tokens into prompts.</li>
                  <li>• Avoid including customer information unless authorized.</li>
                  <li>• A clean result does not guarantee a prompt is safe.</li>
                  <li>• Follow your organization's AI data policy.</li>
                </ul>
              </section>
            </aside>
          </div>
        )}

        {activeTab === "My History" && (
          <section className="mt-6 rounded-2xl border border-white/10 bg-[#101827] p-5 sm:p-6">
            <h3 className="text-lg font-semibold text-white">My inspection history</h3>
            <p className="mt-1 text-sm text-slate-400">
              Illustrative history plus checks made in this browser session.
            </p>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    {["Request ID", "Category", "Decision", "Time"].map((heading) => (
                      <th key={heading} className="border-b border-white/10 px-3 py-4 font-medium">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id} className="border-b border-white/5">
                      <td className="px-3 py-4 text-cyan-300">{item.id}</td>
                      <td className="px-3 py-4 text-slate-300">{item.category}</td>
                      <td className="px-3 py-4"><ResultBadge decision={item.decision} /></td>
                      <td className="px-3 py-4 text-slate-400">{item.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === "Security Tips" && (
          <section className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              ["Protect credentials", "Never share API keys, passwords, session cookies or access tokens with an AI model."],
              ["Minimize personal data", "Remove names, email addresses, phone numbers and customer identifiers when they are unnecessary."],
              ["Check the destination", "Use only organization-approved AI services for company data."],
              ["Review before sharing", "Read the inspection result and verify that sensitive information has been removed."],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-[#101827] p-5">
                <div className="flex items-center gap-3">
                  <span className="text-xl text-cyan-300">◇</span>
                  <h3 className="font-semibold text-white">{title}</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{detail}</p>
              </div>
            ))}
          </section>
        )}

        <footer className="mt-10 border-t border-white/10 pt-5 text-xs leading-5 text-slate-500">
          CyberCup · Employee workspace · Local demo mode. Actual prompt enforcement must happen on the backend.
        </footer>
      </main>
    </div>
  );
}
