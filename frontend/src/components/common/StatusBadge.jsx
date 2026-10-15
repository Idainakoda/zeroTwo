import { ACTION_META, CLASSIFICATION_TONE, TONE_CLASSES } from "../../utils/formatters";

export function Badge({ tone = "slate", children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${TONE_CLASSES[tone] || TONE_CLASSES.slate} ${className}`}
    >
      {children}
    </span>
  );
}

/** Gateway action / decision badge (ALLOW, MASK, BLOCK, ...). */
export default function StatusBadge({ action, className = "" }) {
  const meta = ACTION_META[action] || { label: action || "-", tone: "slate" };
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}

export function ClassificationBadge({ level }) {
  return <Badge tone={CLASSIFICATION_TONE[level] || "slate"}>{level}</Badge>;
}
