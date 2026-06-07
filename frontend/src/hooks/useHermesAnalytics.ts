"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collectHermesAnalytics,
  getHermesAnalyticsContext,
  getHermesAnalyticsKpis,
  getHermesAnalyticsReport,
  type HermesAnalyticsReport,
  type HermesMarketingKPI,
} from "@/lib/admin-api";

export function useHermesAnalytics() {
  const [report, setReport] = useState<HermesAnalyticsReport | null>(null);
  const [kpis, setKpis] = useState<HermesMarketingKPI[]>([]);
  const [context, setContext] = useState("");
  const [days, setDays] = useState(30);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportResponse, kpiResponse, contextResponse] = await Promise.all([
        getHermesAnalyticsReport(days),
        getHermesAnalyticsKpis({ source: source || undefined }),
        getHermesAnalyticsContext(),
      ]);
      setReport(reportResponse);
      setKpis(kpiResponse.kpis);
      setContext(contextResponse.context);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur chargement analytics Hermes");
    } finally {
      setLoading(false);
    }
  }, [days, source]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const collectNow = useCallback(async () => {
    setCollecting(true);
    setError(null);
    try {
      await collectHermesAnalytics();
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur collecte KPI Hermes";
      setError(message);
      throw err;
    } finally {
      setCollecting(false);
    }
  }, [refresh]);

  return {
    report,
    kpis,
    context,
    days,
    setDays,
    source,
    setSource,
    loading,
    collecting,
    error,
    refresh,
    collectNow,
  };
}
