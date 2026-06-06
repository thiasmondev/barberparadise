"use client";

import { useCallback, useEffect, useState } from "react";
import {
  archiveHermesConversation,
  deleteHermesConversation,
  getHermesConversation,
  getHermesConversations,
  type HermesConversation,
} from "@/lib/admin-api";

export function useHermesConversations() {
  const [conversations, setConversations] = useState<HermesConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<HermesConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getHermesConversations("active");
      setConversations(data.conversations);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement Hermes");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    const conversation = await getHermesConversation(id);
    setSelectedConversation(conversation);
    return conversation;
  }, []);

  const archiveConversation = useCallback(async (id: string) => {
    await archiveHermesConversation(id);
    if (selectedConversation?.id === id) setSelectedConversation(null);
    await refresh();
  }, [refresh, selectedConversation?.id]);

  const deleteConversation = useCallback(async (id: string) => {
    await deleteHermesConversation(id);
    if (selectedConversation?.id === id) setSelectedConversation(null);
    await refresh();
  }, [refresh, selectedConversation?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    conversations,
    selectedConversation,
    setSelectedConversation,
    loading,
    error,
    refresh,
    loadConversation,
    archiveConversation,
    deleteConversation,
  };
}
