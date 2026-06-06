"use client";

import { useCallback, useEffect, useState } from "react";
import { getHermesStats, type HermesStats } from "@/lib/admin-api";

export function useHermesStats() {
  const [stats, setStats] = useState<HermesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getHermesStats();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement des statistiques Hermes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, loading, error, refresh };
}
