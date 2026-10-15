/** ZeroTwo mark: an arch (the gateway) with a checked point passing through it. */
export function LogoMark({ size = 40 }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-signal to-iris shadow-[0_8px_24px_-8px_rgba(111,108,255,0.8)]"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none" stroke="white"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4.5 19V11a7.5 7.5 0 0 1 15 0v8" />
        <path d="m9.2 13.6 2 2 3.8-4" />
      </svg>
    </span>
  );
}

export default function Logo({ size = 40, subtitle = "AI security gateway" }) {
  return (
    <span className="inline-flex items-center gap-3">
      <LogoMark size={size} />
      <span className="leading-tight">
        <span className="block font-display text-lg font-semibold tracking-tight text-white">ZeroTwo</span>
        {subtitle && <span className="block text-[11px] text-mist">{subtitle}</span>}
      </span>
    </span>
  );
}
