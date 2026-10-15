// Display helpers shared by the assistant and the admin screens.

export const ACTION_META = {
  ALLOW: { label: "Allowed", tone: "emerald", text: "Nothing sensitive found. Sent as written." },
  WARN: { label: "Warned", tone: "amber", text: "Allowed, with a warning that was logged." },
  MASK: { label: "Masked", tone: "cyan", text: "Sensitive values were replaced with placeholders before the AI saw them." },
  REDACT: { label: "Redacted", tone: "sky", text: "Secrets were removed permanently before the AI saw them." },
  REQUIRE_APPROVAL: { label: "Needs approval", tone: "violet", text: "Held for a supervisor. Only the masked text was stored." },
  BLOCK: { label: "Blocked", tone: "rose", text: "Stopped by policy. Nothing was sent to the AI." },
  SANITIZE: { label: "Sanitized", tone: "cyan", text: "Sensitive data was redacted." },
  PENDING: { label: "Pending", tone: "violet", text: "Waiting for a supervisor." },
  APPROVED: { label: "Approved", tone: "emerald", text: "Approved by a supervisor." },
  REJECTED: { label: "Rejected", tone: "rose", text: "Rejected by a supervisor." },
};

export const CLASSIFICATION_TONE = {
  PUBLIC: "emerald",
  INTERNAL: "sky",
  CONFIDENTIAL: "amber",
  SECRET: "rose",
};

export const TONE_CLASSES = {
  emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  amber: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  cyan: "border-cyan-400/25 bg-cyan-400/10 text-cyan-300",
  sky: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  violet: "border-violet-400/25 bg-violet-400/10 text-violet-300",
  rose: "border-rose-400/25 bg-rose-400/10 text-rose-300",
  slate: "border-white/10 bg-white/5 text-slate-300",
};

export const TONE_HEX = {
  emerald: "#34d399",
  amber: "#fbbf24",
  cyan: "#22d3ee",
  sky: "#38bdf8",
  violet: "#a78bfa",
  rose: "#fb7185",
  slate: "#94a3b8",
};

const TYPE_LABELS = {
  AADHAAR: "Aadhaar number",
  AADHAAR_VID: "Aadhaar VID",
  PAN: "PAN",
  GSTIN: "GSTIN",
  PHONE_IN: "Mobile number",
  EMAIL: "Email address",
  UPI_ID: "UPI ID",
  IFSC: "IFSC code",
  BANK_ACCOUNT: "Bank account",
  CREDIT_CARD: "Card number",
  PASSPORT_IN: "Passport number",
  VOTER_ID: "Voter ID",
  DRIVING_LICENSE: "Driving licence",
  DATE_OF_BIRTH: "Date of birth",
  PERSON: "Person name",
  PASSWORD: "Password",
  SECRET_VALUE: "Secret value",
  PRIVATE_KEY: "Private key",
  CONNECTION_STRING: "Database credentials",
  HIGH_ENTROPY_SECRET: "Random-looking secret",
  CLASSIFICATION_MARKING: "Classification marking",
  INTERNAL_CODENAME: "Internal codename",
  INTERNAL_IP: "Internal IP address",
  INTERNAL_HOST: "Internal host name",
  SOURCE_CODE: "Source code",
  BUSINESS_CONTEXT_HINT: "Business context",
  SYSTEM_PROMPT_EXTRACTION: "System prompt extraction",
  INSTRUCTION_OVERRIDE: "Instruction override",
  JAILBREAK_ROLEPLAY: "Jailbreak / role-play",
  CROSS_USER_DATA_REQUEST: "Other users' data",
  DELIMITER_INJECTION: "Chat-template injection",
  INDIRECT_INJECTION: "Hidden instruction",
  DATA_EXFILTRATION: "Data exfiltration",
  OBFUSCATED_PAYLOAD: "Obfuscated attack",
  HIDDEN_CHARACTERS: "Invisible characters",
  ML_CLASSIFIER_INJECTION: "ML classifier: injection",
  SUSPICIOUS_META_REQUEST: "Suspicious request",
  LLM_CONFIRMED_INJECTION: "Local model: injection",
  BULK_PERSONAL_DATA: "Bulk personal data",
  SYSTEM_PROMPT_LEAK: "System prompt leak",
  INSTRUCTION_DISCLOSURE: "Instruction disclosure",
  RESTRICTED_DOCUMENT_CONTENT: "Restricted document text",
};

export function typeLabel(type) {
  if (!type) return "";
  return TYPE_LABELS[type] || type.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function categoryLabel(category) {
  const map = {
    PII: "Personal data",
    FINANCIAL: "Financial",
    SECRET: "Credentials",
    CONFIDENTIAL: "Confidential",
    INFRASTRUCTURE: "Infrastructure",
    INJECTION: "Prompt injection",
    OUTPUT_LEAK: "Output leak",
    RAG_ACCESS: "Restricted retrieval",
    BULK_PII: "Bulk personal data",
    RESPONSE: "Response",
    SUSPICIOUS: "Suspicious",
  };
  return map[category] || category;
}

export function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatMs(ms) {
  if (ms === undefined || ms === null) return "-";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

export function splitList(value) {
  if (!value) return [];
  return String(value).split(",").map((s) => s.trim()).filter(Boolean);
}
