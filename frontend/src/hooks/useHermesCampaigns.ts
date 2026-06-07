"use client";

import { useCallback, useEffect, useState } from "react";
import {
  approveHermesCampaign,
  createHermesCampaign,
  deleteHermesCampaign,
  getHermesCampaignStats,
  getHermesCampaigns,
  scheduleHermesCampaign,
  sendHermesCampaignNow,
  syncHermesCampaignStats,
  updateHermesCampaign,
  type HermesCampaignPlan,
} from "@/lib/admin-api";

export function useHermesCampaigns() {
  const [campaigns, setCampaigns] = useState<HermesCampaignPlan[]>([]);
  const [stats, setStats] = useState<{ byStatus: Record<string, number>; recentSent: HermesCampaignPlan[]; lists: unknown; brevoConfigured: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [targetAudience, setTargetAudience] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listResponse, statsResponse] = await Promise.all([
        getHermesCampaigns({ status: status || undefined, targetAudience: targetAudience || undefined, limit: 50 }),
        getHermesCampaignStats(),
      ]);
      setCampaigns(listResponse.plans);
      setStats(statsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur chargement campagnes");
    } finally {
      setLoading(false);
    }
  }, [status, targetAudience]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createPlan = useCallback(async (data: Partial<HermesCampaignPlan>) => {
    await createHermesCampaign(data);
    await refresh();
  }, [refresh]);

  const savePlan = useCallback(async (id: string, data: Partial<HermesCampaignPlan>) => {
    await updateHermesCampaign(id, data);
    await refresh();
  }, [refresh]);

  const approvePlan = useCallback(async (id: string) => {
    await approveHermesCampaign(id);
    await refresh();
  }, [refresh]);

  const schedulePlan = useCallback(async (id: string, scheduledAt: string) => {
    await scheduleHermesCampaign(id, scheduledAt);
    await refresh();
  }, [refresh]);

  const sendNow = useCallback(async (id: string) => {
    await sendHermesCampaignNow(id);
    await refresh();
  }, [refresh]);

  const syncStats = useCallback(async (id: string) => {
    await syncHermesCampaignStats(id);
    await refresh();
  }, [refresh]);

  const removePlan = useCallback(async (id: string) => {
    await deleteHermesCampaign(id);
    await refresh();
  }, [refresh]);

  return {
    campaigns,
    stats,
    loading,
    error,
    status,
    setStatus,
    targetAudience,
    setTargetAudience,
    refresh,
    createPlan,
    savePlan,
    approvePlan,
    schedulePlan,
    sendNow,
    syncStats,
    removePlan,
  };
}
