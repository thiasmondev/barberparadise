"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteHermesDraft,
  getHermesDraftStats,
  getHermesDrafts,
  publishHermesDraft,
  updateHermesDraft,
  updateHermesDraftStatus,
  type HermesContentDraft,
} from "@/lib/admin-api";

export function useHermesDrafts() {
  const [drafts, setDrafts] = useState<HermesContentDraft[]>([]);
  const [stats, setStats] = useState<{ byStatus: Record<string, number>; byType: Record<string, number>; publishedLast30Days: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listResponse, statsResponse] = await Promise.all([
        getHermesDrafts({ type: type || undefined, status: status || undefined, limit: 50 }),
        getHermesDraftStats(),
      ]);
      setDrafts(listResponse.drafts);
      setStats(statsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur chargement brouillons");
    } finally {
      setLoading(false);
    }
  }, [type, status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const publish = useCallback(async (id: string) => {
    await publishHermesDraft(id);
    await refresh();
  }, [refresh]);

  const changeStatus = useCallback(async (id: string, nextStatus: string) => {
    await updateHermesDraftStatus(id, nextStatus);
    await refresh();
  }, [refresh]);

  const saveDraft = useCallback(async (id: string, data: Partial<HermesContentDraft>) => {
    await updateHermesDraft(id, data);
    await refresh();
  }, [refresh]);

  const removeDraft = useCallback(async (id: string) => {
    await deleteHermesDraft(id);
    await refresh();
  }, [refresh]);

  return {
    drafts,
    stats,
    loading,
    error,
    type,
    setType,
    status,
    setStatus,
    refresh,
    publish,
    changeStatus,
    saveDraft,
    removeDraft,
  };
}
