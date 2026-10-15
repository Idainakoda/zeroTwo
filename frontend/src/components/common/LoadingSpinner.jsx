export default function LoadingSpinner({ label = "Loading...", className = "" }) {
  return (
    <div className={`flex items-center gap-3 text-sm text-slate-400 ${className}`} role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400/30 border-t-indigo-300" />
      {label}
    </div>
  );
}
