export function Card({ children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-[#0d1424] p-5 ${className}`}>
      {children}
    </section>
  );
}

export function CardTitle({ title, subtitle, right }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function PageHeader({ eyebrow, title, text, right }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{eyebrow}</p>
        )}
        <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">{title}</h1>
        {text && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{text}</p>}
      </div>
      {right}
    </div>
  );
}

export function Button({ variant = "primary", className = "", ...props }) {
  const styles = {
    primary: "bg-gradient-to-r from-cyan-300 to-sky-400 text-slate-950 hover:brightness-110",
    ghost: "border border-white/10 text-slate-200 hover:bg-white/5",
    danger: "border border-rose-400/30 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20",
    success: "border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
      {message}
    </div>
  );
}
