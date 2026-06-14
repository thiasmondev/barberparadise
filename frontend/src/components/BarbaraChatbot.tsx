"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { API_URL } from "@/lib/api";

type BarbaraMessage = {
  role: "user" | "assistant";
  content: string;
};

const SESSION_STORAGE_KEY = "bp_barbara_session_id";
const CONSENT_STORAGE_KEY = "rgpd_consent";
const WELCOME_MESSAGE = "Bonjour ! Je suis Barbara, votre assistante Barber Paradise 💈 Comment puis-je vous aider ?";
const QUICK_QUESTIONS = [
  "Quels sont vos délais de livraison ?",
  "Comment devenir client pro ?",
  "Quelles marques proposez-vous ?",
];
const BARBARA_PROFILE_IMAGE = "/images/barbara-profile.png";

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
  const [hasCookieConsent, setHasCookieConsent] = useState(true);
  const [messages, setMessages] = useState<BarbaraMessage[]>([
    { role: "assistant", content: WELCOME_MESSAGE },
  ]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const isAdminRoute = pathname?.startsWith("/admin") ?? false;
  const canSend = input.trim().length >= 2 && !isTyping;
  const closedPositionClass = hasCookieConsent
    ? "bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] sm:bottom-6"
    : "bottom-[calc(env(safe-area-inset-bottom)+10rem)] sm:bottom-6";

  const apiMessages = useMemo(
    () => messages.filter((message) => !(message.role === "assistant" && message.content === WELCOME_MESSAGE)),
    [messages],
  );

  useEffect(() => {
    setSessionId(getSessionId());
    setHasCookieConsent(Boolean(window.localStorage.getItem(CONSENT_STORAGE_KEY)));

    const updateCookieConsentState = () => {
      setHasCookieConsent(Boolean(window.localStorage.getItem(CONSENT_STORAGE_KEY)));
    };

    window.addEventListener("bp:cookie-consent-updated", updateCookieConsentState);
    window.addEventListener("storage", updateCookieConsentState);

    return () => {
      window.removeEventListener("bp:cookie-consent-updated", updateCookieConsentState);
      window.removeEventListener("storage", updateCookieConsentState);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });

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
    <div className={`fixed right-3 z-[10000] max-w-[calc(100vw-1.5rem)] print:hidden sm:right-6 ${closedPositionClass}`}>
      {isOpen ? (
        <div
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-[10000] flex items-end justify-center bg-transparent p-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:block"
          
        >
          <section
            className="flex w-full max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-[1.35rem] border border-black/10 bg-white text-[#181818] shadow-2xl sm:h-[500px] sm:w-[350px] sm:max-w-none sm:rounded-3xl sm:border-white/20"
            style={{ height: "min(62svh, 460px)", maxHeight: "calc(100svh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 8rem)" }}
          >
            <header className="flex items-center justify-between bg-[#181818] px-3 py-2.5 text-white sm:px-4 sm:py-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 overflow-hidden rounded-full border border-white/20 bg-[#ff4a8d] shadow-lg shadow-[#ff4a8d]/30 sm:h-11 sm:w-11">
                  <img src={BARBARA_PROFILE_IMAGE} alt="Barbara, assistante Barber Paradise" className="h-full w-full object-cover object-center" />
                </div>
                <div>
                  <p className="font-heading text-[13px] font-black leading-tight sm:text-base">Barbara</p>
                  <p className="text-[10px] text-white/70 sm:text-xs">Assistante Barber Paradise</p>
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

            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-[#f7f7f7] px-2.5 py-2.5 sm:space-y-3 sm:px-4 sm:py-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[78%] break-words rounded-2xl px-2.5 py-2 text-[12px] leading-[1.32] shadow-sm sm:max-w-[85%] sm:px-4 sm:py-3 sm:text-sm sm:leading-5 ${
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
                      className="w-full rounded-2xl border border-[#ff4a8d]/20 bg-white px-2.5 py-1.5 text-left text-[10px] font-semibold text-[#252525] transition-colors hover:border-[#ff4a8d]/60 hover:bg-[#fff0f6] sm:px-3 sm:py-2 sm:text-xs"
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

            <form onSubmit={handleSubmit} className="border-t border-black/10 bg-white p-2 sm:p-3">
              {error && <p className="mb-2 text-xs font-medium text-[#b42318]">{error}</p>}
              <div className="flex min-w-0 items-end gap-2 rounded-2xl border border-black/10 bg-[#f7f7f7] p-2 focus-within:border-[#ff4a8d]/60">
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
                  className="max-h-16 min-h-8 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-base text-[#181818] outline-none placeholder:text-black/40 sm:max-h-24 sm:min-h-10 sm:px-2 sm:py-2 sm:text-sm"
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  className="shrink-0 rounded-full bg-[#ff4a8d] px-2.5 py-1.5 text-[12px] font-black text-white transition-colors hover:bg-[#ff1f70] disabled:cursor-not-allowed disabled:bg-black/20 sm:px-4 sm:py-2 sm:text-sm"
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
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ff4a8d] text-sm font-black text-white shadow-2xl shadow-[#ff4a8d]/30 transition-transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-[#ff4a8d]/30 sm:h-16 sm:w-16 sm:text-lg"
          aria-label="Ouvrir Barbara, assistante Barber Paradise"
        >
          ?
        </button>
      )}
    </div>
  );
}
