
import { useState } from "react";

const stats = [
  { label: "Total Inspections", value: "2,846", change: "+12.8%", icon: "⌕" },
  { label: "Threats Blocked", value: "184", change: "This month", icon: "🛡" },
  { label: "Data Sanitized", value: "327", change: "This month", icon: "◈" },
  { label: "Active Policies", value: "12", change: "All systems", icon: "▤" },
];

const initialIncidents = [
  { id: "INC-1042", type: "API Key", user: "employee@company.com", severity: "Critical", decision: "Blocked", time: "2 min ago" },
  { id: "INC-1041", type: "Personal Data", user: "analyst@company.com", severity: "Medium", decision: "Sanitized", time: "12 min ago" },
  { id: "INC-1040", type: "Email Address", user: "employee2@company.com", severity: "Low", decision: "Sanitized", time: "28 min ago" },
  { id: "INC-1039", type: "API Key", user: "developer@company.com", severity: "Critical", decision: "Blocked", time: "41 min ago" },
];

const initialPolicies = [
  { name: "PII Protection", detail: "Detect emails, phone numbers and personal data", enabled: true },
  { name: "API Key Detection", detail: "Prevent secret and credential leakage", enabled: true },
  { name: "Prompt Inspection", detail: "Inspect prompts before external submission", enabled: true },
  { name: "Custom Data Rules", detail: "Organization-specific sensitive data patterns", enabled: false },
];

const navItems = [
  ["Overview", "▦"],
  ["Incidents", "⚠"],
  ["Policies", "◈"],
  ["Users & Roles", "♙"],
  ["Audit Logs", "≡"],
];

function Badge({ children, type = "neutral" }) {
  const styles = {
    Critical: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    Blocked: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    Medium: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    Low: "bg-sky-500/10 text-sky-300 border-sky-500/20",
    Sanitized: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    neutral: "bg-white/5 text-slate-300 border-white/10",
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[children] || styles[type] || styles.neutral}`}>
      {children}
    </span>
  );
}

function SectionTitle({ title, description, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      {action}
    </div>
  );
}

export default function AdminDashboard() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [incidents, setIncidents] = useState(initialIncidents);
  const [policies, setPolicies] = useState(initialPolicies);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

  const filteredIncidents = incidents.filter((incident) =>
    `${incident.id} ${incident.type} ${incident.user} ${incident.severity}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  function togglePolicy(index) {
    setPolicies((current) =>
      current.map((policy, i) =>
        i === index ? { ...policy, enabled: !policy.enabled } : policy
      )
    );
    setNotice("Policy updated locally. Connect the Policies API to save this change.");
  }

  const navTo = (item) => {
    setActiveNav(item);
    setNotice("");
  };

  return (
    <div className="min-h-screen bg-[#080d18] text-slate-200">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-[#0b1120] p-5 lg:flex lg:flex-col">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 text-2xl text-cyan-300">
              ⛨
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wide text-white">CyberCup</h1>
              <p className="text-xs text-slate-500">AI Security Gateway</p>
            </div>
          </div>

          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Administration
          </p>

          <nav className="space-y-1">
            {navItems.map(([label, icon]) => (
              <button
                key={label}
                onClick={() => navTo(label)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                  activeNav === label
                    ? "border border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="w-5 text-center text-lg">{icon}</span>
                {label}
              </button>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
            <p className="text-sm font-semibold text-cyan-200">Security status</p>
            <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Dashboard demo mode
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Connect the backend to display live system status.
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#080d18]/90 px-5 py-4 backdrop-blur-xl sm:px-8">
            <div>
              <p className="text-xs text-slate-500">CyberCup / Admin</p>
              <h2 className="mt-1 text-lg font-semibold text-white">{activeNav}</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-xs text-emerald-300 sm:inline-flex">
                ● Demo environment
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 font-semibold text-cyan-200">
                A
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-white">Administrator</p>
                <p className="text-xs text-slate-500">System management</p>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] p-5 sm:p-8">
            {notice && (
              <div className="mb-5 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-sm text-cyan-200">
                {notice}
              </div>
            )}

            {activeNav === "Overview" && (
              <>
                <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-cyan-300">SECURITY COMMAND CENTER</p>
                    <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                      Security overview
                    </h1>
                    <p className="mt-2 text-sm text-slate-400">
                      Monitor prompt inspections, incidents and security policies.
                    </p>
                  </div>
                  <button
                    onClick={() => navTo("Incidents")}
                    className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                  >
                    Review incidents →
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {stats.map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-white/10 bg-[#101827] p-5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">{stat.label}</span>
                        <span className="text-xl text-cyan-300">{stat.icon}</span>
                      </div>
                      <p className="mt-5 text-3xl font-bold tracking-tight text-white">{stat.value}</p>
                      <p className="mt-2 text-xs text-emerald-300">{stat.change}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                  <section className="rounded-2xl border border-white/10 bg-[#101827] p-5 sm:p-6">
                    <SectionTitle
                      title="Recent security incidents"
                      description="Latest detected sensitive-data events"
                      action={
                        <button onClick={() => navTo("Incidents")} className="text-sm text-cyan-300 hover:text-cyan-200">
                          View all →
                        </button>
                      }
                    />
                    <div className="space-y-3">
                      {incidents.slice(0, 4).map((incident) => (
                        <div key={incident.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white">{incident.type}</p>
                            <p className="mt-1 break-all text-xs text-slate-500">
                              {incident.id} · {incident.user}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge>{incident.severity}</Badge>
                            <Badge>{incident.decision}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-[#101827] p-5 sm:p-6">
                    <SectionTitle title="Protection summary" description="Sample inspection outcomes" />
                    <div className="space-y-5">
                      {[
                        ["Allowed", 76, "bg-cyan-400"],
                        ["Sanitized", 16, "bg-emerald-400"],
                        ["Blocked", 8, "bg-rose-400"],
                      ].map(([label, value, color]) => (
                        <div key={label}>
                          <div className="mb-2 flex justify-between text-sm">
                            <span className="text-slate-300">{label}</span>
                            <span className="text-white">{value}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/5">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-8 rounded-xl border border-amber-400/15 bg-amber-400/5 p-4">
                      <p className="text-sm font-semibold text-amber-200">Demo data notice</p>
                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        Statistics are illustrative. Replace them with aggregated API results before presenting live security metrics.
                      </p>
                    </div>
                  </section>
                </div>
              </>
            )}

            {activeNav === "Incidents" && (
              <section className="rounded-2xl border border-white/10 bg-[#101827] p-5 sm:p-6">
                <SectionTitle title="Security incidents" description="Search and review detected sensitive-data events." />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search ID, category or user..."
                  className="mb-5 w-full rounded-xl border border-white/10 bg-[#0b1120] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/50"
                />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="text-xs uppercase text-slate-500">
                      <tr>{["Incident", "Category", "User", "Severity", "Decision", "Time"].map((x) => <th key={x} className="border-b border-white/10 px-3 py-4 font-medium">{x}</th>)}</tr>
                    </thead>
                    <tbody>
                      {filteredIncidents.map((item) => (
                        <tr key={item.id} className="border-b border-white/5">
                          <td className="px-3 py-4 text-cyan-300">{item.id}</td>
                          <td className="px-3 py-4 text-white">{item.type}</td>
                          <td className="px-3 py-4 text-slate-400">{item.user}</td>
                          <td className="px-3 py-4"><Badge>{item.severity}</Badge></td>
                          <td className="px-3 py-4"><Badge>{item.decision}</Badge></td>
                          <td className="px-3 py-4 text-slate-400">{item.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredIncidents.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No incidents match your search.</p>}
                </div>
              </section>
            )}

            {activeNav === "Policies" && (
              <section className="rounded-2xl border border-white/10 bg-[#101827] p-5 sm:p-6">
                <SectionTitle title="Security policies" description="Toggle demo policy states. Changes are local until the API is connected." />
                <div className="space-y-3">
                  {policies.map((policy, index) => (
                    <div key={policy.name} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 p-4">
                      <div>
                        <p className="font-medium text-white">{policy.name}</p>
                        <p className="mt-1 text-sm text-slate-400">{policy.detail}</p>
                      </div>
                      <button
                        role="switch"
                        aria-checked={policy.enabled}
                        onClick={() => togglePolicy(index)}
                        className={`relative h-7 w-12 rounded-full transition ${policy.enabled ? "bg-cyan-400" : "bg-slate-700"}`}
                        aria-label={`Toggle ${policy.name}`}
                      >
                        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${policy.enabled ? "left-6" : "left-1"}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeNav === "Users & Roles" && (
              <section className="rounded-2xl border border-white/10 bg-[#101827] p-5 sm:p-6">
                <SectionTitle title="Users & roles" description="Illustrative role directory. Connect a user-management API for real records." />
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    ["Administrator", "ADMIN", "Manage policies, roles and security settings."],
                    ["Security Analyst", "SECURITY_ANALYST", "Investigate incidents and monitor audit activity."],
                    ["Employee", "EMPLOYEE", "Inspect prompts and view personal inspection history."],
                  ].map(([name, role, description]) => (
                    <div key={role} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                      <p className="text-xs text-cyan-300">{role}</p>
                      <h3 className="mt-3 font-semibold text-white">{name}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeNav === "Audit Logs" && (
              <section className="rounded-2xl border border-white/10 bg-[#101827] p-5 sm:p-6">
                <SectionTitle title="Audit activity" description="Example audit events for the admin interface." />
                <div className="space-y-3">
                  {[
                    ["PROMPT_BLOCKED", "A prompt containing a detected credential was blocked.", "2 min ago"],
                    ["PROMPT_SANITIZED", "Sensitive personal information was redacted.", "12 min ago"],
                    ["POLICY_UPDATED", "A security policy was changed in demo mode.", "35 min ago"],
                    ["USER_LOGIN", "A user authenticated to the platform.", "1 hour ago"],
                  ].map(([action, detail, time]) => (
                    <div key={action + time} className="flex flex-wrap justify-between gap-3 border-b border-white/5 py-4">
                      <div>
                        <p className="text-sm font-medium text-white">{action}</p>
                        <p className="mt-1 text-sm text-slate-400">{detail}</p>
                      </div>
                      <span className="text-xs text-slate-500">{time}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <footer className="mt-10 border-t border-white/10 pt-5 text-xs text-slate-500">
              CyberCup · AI Security Gateway · Admin console · Sample dashboard data
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
