import { useState, useEffect, useRef } from "react";
import type { Message } from "../lib/types";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";

interface ChatPanelProps {
  sessionId: string;
  token: string;
  userName: string;
}

export default function ChatPanel({ sessionId, token, userName }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load existing messages
  useEffect(() => {
    api.getMessages(sessionId).then((msgs) => {
      setMessages(msgs.filter((m) => !m.is_deleted));
    }).catch(() => {});
  }, [sessionId]);

  // Subscribe to realtime
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "webinar_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          if (!msg.is_deleted) {
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "webinar_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.is_deleted) {
            setMessages((prev) => prev.filter((m) => m.id !== msg.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setSendError(null);
    setSending(true);
    try {
      await api.sendMessage(sessionId, token, content);
      setInput("");
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : "Erro ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  }

  function formatTime(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">Chat ao vivo</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-8">
            Seja o primeiro a enviar uma mensagem!
          </p>
        )}
        {messages.map((msg) => {
          const isPresenter = msg.sender_type === "presenter";
          return (
            <div key={msg.id} className={`flex flex-col ${isPresenter ? "items-start" : "items-end"}`}>
              <div
                className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                  isPresenter
                    ? "bg-blue-50 text-blue-900"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {isPresenter && (
                  <span className="block text-xs font-bold text-blue-600 mb-0.5">
                    Apresentador
                  </span>
                )}
                <span className={isPresenter ? "font-semibold" : ""}>{msg.content}</span>
              </div>
              <span className="text-xs text-gray-400 mt-0.5 px-1">
                {isPresenter ? "Apresentador" : userName} · {formatTime(msg.created_at)}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100">
        {sendError && (
          <p className="text-xs text-red-500 mb-2">{sendError}</p>
        )}
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 500))}
            placeholder="Digite sua mensagem..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-semibold
              hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
