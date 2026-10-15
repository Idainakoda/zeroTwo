import { useEffect, useRef } from "react";
import { MessageSquareLock } from "lucide-react";
import { GatewayBubble, UserBubble } from "./MessageBubble";
import LoadingSpinner from "../common/LoadingSpinner";

export default function ChatWindow({ messages, busy, selectedId, onSelect }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy]);

  if (messages.length === 0 && !busy) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
          <MessageSquareLock className="h-7 w-7 text-cyan-300" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-white">Secure AI assistant</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
          Every message passes through the security gateway first. Personal data and secrets are masked,
          injection attempts are blocked, and documents are only used if your clearance allows it.
          Pick a scenario below to see it in action.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {messages.map((m) =>
        m.role === "user" ? (
          <UserBubble key={m.id} message={m} />
        ) : (
          <GatewayBubble key={m.id} message={m} selected={selectedId === m.id} onSelect={() => onSelect(m.id)} />
        )
      )}
      {busy && <LoadingSpinner label="Inspecting, applying policy and asking the AI..." className="pl-11" />}
      <div ref={endRef} />
    </div>
  );
}
