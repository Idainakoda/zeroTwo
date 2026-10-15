import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { sendPrompt } from "../services/promptService";
import ChatWindow from "../components/chat/ChatWindow";
import PromptInput from "../components/chat/PromptInput";
import InspectionStatus from "../components/chat/InspectionStatus";
import { PageHeader } from "../components/common/Card";

let nextId = 1;

export default function ChatPage() {
  const { token, user } = useAuth();
  // Kept in memory only: prompts may contain sensitive data, so nothing is written to browser storage.
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  async function handleSend({ prompt, useDocuments, attachment }) {
    const userMsg = {
      id: nextId++,
      role: "user",
      text: prompt,
      useDocuments,
      attachmentName: attachment?.name,
    };
    setMessages((m) => [...m, userMsg]);
    setBusy(true);
    try {
      const result = await sendPrompt(token, { prompt, useDocuments, attachment: attachment?.text });
      const reply = { id: nextId++, role: "gateway", prompt, result };
      setMessages((m) => m.map((x) => (x.id === userMsg.id ? { ...x, result } : x)).concat(reply));
      setSelectedId(reply.id);
    } catch (err) {
      setMessages((m) => [...m, { id: nextId++, role: "gateway", error: err.message }]);
    } finally {
      setBusy(false);
    }
  }

  const selected = messages.find((m) => m.id === selectedId)?.result;

  return (
    <div>
      <PageHeader
        eyebrow="Secure assistant"
        title={`Hello, ${user?.fullName?.split(" ")[0] || "there"}`}
        text="Ask the department's AI assistant. The gateway checks every message and every answer, and only uses documents your clearance allows."
        right={
          messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); setSelectedId(null); }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear conversation
            </button>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-h-[70vh] flex-col rounded-2xl border border-white/10 bg-[#080e1c]">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <ChatWindow messages={messages} busy={busy} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          <div className="border-t border-white/10 p-4">
            <PromptInput onSend={handleSend} busy={busy} />
          </div>
        </div>

        <div className="xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
          <InspectionStatus result={selected} />
        </div>
      </div>
    </div>
  );
}
