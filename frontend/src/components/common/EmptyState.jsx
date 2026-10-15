import { Inbox } from "lucide-react";

export default function EmptyState({ title = "Nothing here yet", text, icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
      <Icon className="h-8 w-8 text-slate-600" />
      <p className="mt-3 text-sm font-medium text-slate-300">{title}</p>
      {text && <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{text}</p>}
    </div>
  );
}
