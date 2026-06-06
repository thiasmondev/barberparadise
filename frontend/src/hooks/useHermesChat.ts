"use client";

import { useCallback, useState } from "react";
import { getAdminToken, getHermesChatUrl, type HermesMessage } from "@/lib/admin-api";

type LocalHermesMessage = Pick<HermesMessage, "role" | "content" | "model" | "createdAt"> & {
  id: string;
  conversationId?: string;
};

interface SendMessageInput {
  message: string;
  conversationId?: string | null;
  module?: string | null;
  usePro?: boolean;
}

export function useHermesChat(initialConversationId?: string | null) {
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId || null);
  const [messages, setMessages] = useState<LocalHermesMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastModel, setLastModel] = useState<string | null>(null);

  const replaceMessages = useCallback((nextMessages: HermesMessage[]) => {
    setMessages(
      nextMessages.map((message) => ({
        id: message.id,
        conversationId: message.conversationId,
        role: message.role,
        content: message.content,
        model: message.model,
        createdAt: message.createdAt,
      }))
    );
  }, []);

  const resetConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setLastModel(null);
  }, []);

  const sendMessage = useCallback(async ({ message, conversationId: explicitConversationId, module, usePro = false }: SendMessageInput) => {
    const token = getAdminToken();
    if (!token) throw new Error("Non authentifié");

    const trimmed = message.trim();
    if (!trimmed || isStreaming) return;

    const activeConversationId = explicitConversationId ?? conversationId;
    const userMessage: LocalHermesMessage = {
      id: `user-${Date.now()}`,
      conversationId: activeConversationId || undefined,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const assistantId = `assistant-${Date.now()}`;

    setError(null);
    setIsStreaming(true);
    setMessages((current) => [
      ...current,
      userMessage,
      { id: assistantId, conversationId: activeConversationId || undefined, role: "assistant", content: "", createdAt: new Date().toISOString() },
    ]);

    try {
      const response = await fetch(getHermesChatUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId: activeConversationId, message: trimmed, module, usePro }),
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Erreur Hermes ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const event of events) {
          const line = event.split("\n").find((item) => item.startsWith("data: "));
          if (!line) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === "chunk") {
            setMessages((current) =>
              current.map((item) => (item.id === assistantId ? { ...item, content: `${item.content}${data.content}` } : item))
            );
          } else if (data.type === "done") {
            setConversationId(data.conversationId);
            setLastModel(data.model || null);
          } else if (data.type === "error") {
            throw new Error(data.message || "Erreur interne Hermes");
          }
        }
      }
    } catch (err) {
      const messageError = err instanceof Error ? err.message : "Erreur Hermes";
      setError(messageError);
      setMessages((current) =>
        current.map((item) => (item.id === assistantId ? { ...item, content: `Erreur : ${messageError}` } : item))
      );
    } finally {
      setIsStreaming(false);
    }
  }, [conversationId, isStreaming]);

  return {
    conversationId,
    setConversationId,
    messages,
    replaceMessages,
    resetConversation,
    sendMessage,
    isStreaming,
    error,
    lastModel,
  };
}
