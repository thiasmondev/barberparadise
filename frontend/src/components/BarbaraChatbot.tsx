"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { API_URL } from "@/lib/api";

type BarbaraMessage = {
  role: "user" | "assistant";
  content: string;
};

const SESSION_STORAGE_KEY = "bp_barbara_session_id";
const WELCOME_MESSAGE = "Bonjour ! Je suis Barbara, votre assistante Barber Paradise 💈 Comment puis-je vous aider ?";
const QUICK_QUESTIONS = [
  "Quels sont vos délais de livraison ?",
  "Comment devenir client pro ?",
  "Quelles marques proposez-vous ?",
];

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `barbara-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSessionId() {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;
  const next = createSessionId();
  window.localStorage.setItem(SESSION_STORAGE_KEY, next);
  return next;
}

export default function BarbaraChatbot() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<BarbaraMessage[]>([
    { role: "assistant", content: WELCOME_MESSAGE },
  ]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const isAdminRoute = pathname?.startsWith("/admin") ?? false;
  const canSend = input.trim().length >= 2 && !isTyping;

  const apiMessages = useMemo(
    () => messages.filter((message) => !(message.role === "assistant" && message.content === WELCOME_MESSAGE)),
    [messages],
  );

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    inputRef.current?.focus();
  }, [messages, isOpen, isTyping]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  if (isAdminRoute) return null;

  async function sendMessage(content: string) {
    const cleanContent = content.trim();
    if (cleanContent.length < 2 || isTyping || !sessionId) return;

    const nextMessages: BarbaraMessage[] = [...apiMessages, { role: "user", content: cleanContent }];
    setMessages((current) => [...current, { role: "user", content: cleanContent }]);
    setInput("");
    setError(null);
    setIsTyping(true);

    try {
      const response = await fetch(`${API_URL}/api/chat/barbara`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, messages: nextMessages }),
      });
      const payload = (await response.json().catch(() => null)) as { reply?: string; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Barbara est momentanément indisponible.");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: payload?.reply || "Je suis désolée, je n’ai pas pu générer de réponse. Vous pouvez contacter le support Barber Paradise.",
        },
      ]);
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Barbara est momentanément indisponible.";
      setError(message);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: message,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className="fixed bottom-5 right-5 z-[900] print:hidden sm:bottom-6 sm:right-6">
      {isOpen ? (
        <div className="fixed inset-0 z-[900] flex items-end justify-end bg-black/35 p-0 backdrop-blur-[1px] sm:inset-auto sm:bottom-6 sm:right-6 sm:block sm:bg-transparent sm:p-0 sm:backdrop-blur-0">
          <section className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white text-[#181818] shadow-2xl sm:h-[500px] sm:w-[350px] sm:rounded-3xl sm:border sm:border-white/20">
            <header className="flex items-center justify-between bg-[#181818] px-4 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ff4a8d] text-lg font-black text-white shadow-lg shadow-[#ff4a8d]/30">
                  BP
                </div>
                <div>
                  <p className="font-heading text-base font-black leading-tight">Barbara</p>
                  <p className="text-xs text-white/70">Assistante Barber Paradise</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Fermer Barbara"
              >
                ×
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-[#f7f7f7] px-4 py-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-5 shadow-sm ${
                      message.role === "user"
                        ? "rounded-br-md bg-[#ff4a8d] text-white"
                        : "rounded-bl-md bg-white text-[#252525]"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {messages.length === 1 && (
                <div className="space-y-2 pt-1">
                  {QUICK_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => void sendMessage(question)}
                      className="w-full rounded-2xl border border-[#ff4a8d]/20 bg-white px-3 py-2 text-left text-xs font-semibold text-[#252525] transition-colors hover:border-[#ff4a8d]/60 hover:bg-[#fff0f6]"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              )}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm" aria-label="Barbara écrit">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#ff4a8d] [animation-delay:-0.2s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#ff4a8d] [animation-delay:-0.1s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#ff4a8d]" />
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="border-t border-black/10 bg-white p-3">
              {error && <p className="mb-2 text-xs font-medium text-[#b42318]">{error}</p>}
              <div className="flex items-end gap-2 rounded-2xl border border-black/10 bg-[#f7f7f7] p-2 focus-within:border-[#ff4a8d]/60">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage(input);
                    }
                  }}
                  rows={1}
                  maxLength={700}
                  placeholder="Écrivez votre question..."
                  className="max-h-24 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-[#181818] outline-none placeholder:text-black/40"
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  className="rounded-full bg-[#ff4a8d] px-4 py-2 text-sm font-black text-white transition-colors hover:bg-[#ff1f70] disabled:cursor-not-allowed disabled:bg-black/20"
                >
                  Envoyer
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ff4a8d] text-lg font-black text-white shadow-2xl shadow-[#ff4a8d]/30 transition-transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-[#ff4a8d]/30"
          aria-label="Ouvrir Barbara, assistante Barber Paradise"
        >
          BP
        </button>
      )}
    </div>
  );
}
