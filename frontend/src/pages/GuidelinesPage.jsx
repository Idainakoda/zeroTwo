import { useState } from "react";
import { CircleCheck, CircleX, Code2, Flag, Info, Landmark, ShieldCheck } from "lucide-react";
import { PageHeader } from "../components/common/Card";

const TOPICS = [
  {
    key: "share",
    icon: CircleCheck,
    tone: "text-emerald-300 bg-emerald-400/10",
    title: "What you can share",
    intro: "Public, general or already-anonymised information is fine to use with the assistant.",
    good: true,
    items: [
      "Public schemes, circulars, acts and notifications",
      "Drafting help for letters, notices and summaries without personal details",
      "General questions about rules, procedures and timelines",
      "Code snippets with credentials removed",
    ],
  },
  {
    key: "avoid",
    icon: CircleX,
    tone: "text-rose-300 bg-rose-400/10",
    title: "What to avoid",
    intro: "Leave these out. If they slip in, ZeroTwo masks or blocks them, but the safest copy is the one never pasted.",
    good: false,
    items: [
      "Aadhaar, PAN, voter ID, passport and phone numbers of citizens or staff",
      "Bank accounts, card numbers, UPI IDs and salary details",
      "Passwords, API keys, tokens and database connection strings",
      "Files marked Confidential, Restricted or Secret, and internal project codenames",
      "Lists of many people's personal details",
    ],
  },
  {
    key: "policy",
    icon: Landmark,
    tone: "text-[#a5b4fc] bg-indigo-400/10",
    title: "How ZeroTwo protects you",
    intro: "Your administrators decide what happens to each kind of information.",
    good: true,
    items: [
      "Personal and financial data is masked; the AI sees placeholders like <AADHAAR_1>",
      "Passwords and keys are removed permanently",
      "Classified notes and bulk personal data wait for a supervisor's approval",
      "Attempts to extract the AI's instructions or other people's data are blocked",
      "Department documents are only used if your clearance allows",
    ],
  },
  {
    key: "examples",
    icon: Code2,
    tone: "text-sky-300 bg-sky-400/10",
    title: "Examples",
    intro: "The same task, written safely.",
    good: true,
    items: [
      "Instead of “Write to Ramesh Kumar, Aadhaar 2345 6789 0124”, write “Write to the applicant about their pending EMI”",
      "Instead of pasting a config file with its password, replace the value with ********",
      "Instead of pasting a Confidential note, describe the general topic you need help with",
    ],
  },
  {
    key: "report",
    icon: Flag,
    tone: "text-amber-300 bg-amber-400/10",
    title: "Reporting concerns",
    intro: "Tell the security team if something looks wrong.",
    good: true,
    items: [
      "You pasted sensitive data by mistake: tell your supervisor; the masked record is in the audit log",
      "An answer contains information you should not see: stop and report it",
      "A request you need for work keeps being blocked: ask an administrator to review the policy",
    ],
  },
];

export default function GuidelinesPage() {
  const [active, setActive] = useState(TOPICS[0].key);
  const topic = TOPICS.find((t) => t.key === active);

  return (
    <div>
      <PageHeader
        eyebrow="AI usage guidelines"
        title={<>Use AI <span className="zt-gradient-text">responsibly.</span></>}
        text="A short guide to what belongs in a prompt and what does not."
      />
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <nav aria-label="Guideline topics" className="zt-glass rounded-2xl p-2">
          {TOPICS.map((t) => (
            <button key={t.key} type="button" onClick={() => setActive(t.key)} aria-current={active === t.key}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                      active === t.key ? "bg-indigo-400/15 text-white ring-1 ring-indigo-400/30" : "text-slate-300 hover:bg-white/[0.04]"}`}>
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${t.tone}`}><t.icon className="h-4 w-4" /></span>
              {t.title}
            </button>
          ))}
        </nav>
        <section className="zt-glass rounded-2xl p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold text-white">{topic.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-mist">{topic.intro}</p>
          <ul className="mt-6 space-y-3">
            {topic.items.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-6 text-slate-200">
                {topic.good
                  ? <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                  : <CircleX className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />}
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-8 flex items-start gap-3 rounded-xl border border-indigo-400/20 bg-indigo-400/[0.07] p-4 text-sm text-indigo-100">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
            When in doubt, remove or anonymise the details before you send. ZeroTwo is a safety net, not a reason to paste more.
          </p>
        </section>
      </div>
    </div>
  );
}
