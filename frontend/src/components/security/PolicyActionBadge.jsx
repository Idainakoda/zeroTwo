import StatusBadge from "../common/StatusBadge";

/** "Policy name -> ACTION" trail returned by the gateway. */
export default function PolicyActionBadge({ policies }) {
  if (!policies || policies.length === 0) {
    return <p className="text-xs text-slate-500">No policy triggered.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {policies.map((p, i) => {
        const [name, action] = String(p).split(" -> ");
        return (
          <li key={i} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-300">{name}</span>
            {action && <StatusBadge action={action.trim()} />}
          </li>
        );
      })}
    </ul>
  );
}
