"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteHermesImage,
  generateHermesImage,
  getHermesImages,
  getHermesImageStats,
  updateHermesImage,
  type HermesImage,
  type HermesImageStats,
} from "@/lib/admin-api";

export function useHermesImages() {
  const [images, setImages] = useState<HermesImage[]>([]);
  const [stats, setStats] = useState<HermesImageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listResponse, statsResponse] = await Promise.all([
        getHermesImages({ category: category || undefined, status: status || undefined, limit: 50 }),
        getHermesImageStats(),
      ]);
      setImages(listResponse.images);
      setStats(statsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur chargement images Hermes");
    } finally {
      setLoading(false);
    }
  }, [category, status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const generateImage = useCallback(async (data: { prompt: string; category?: string; tags?: string[]; aspectRatio?: string; useFastModel?: boolean }) => {
    setGenerating(true);
    setError(null);
    try {
      const image = await generateHermesImage(data);
      await refresh();
      return image;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur génération image Hermes";
      setError(message);
      throw err;
    } finally {
      setGenerating(false);
    }
  }, [refresh]);

  const saveImage = useCallback(async (id: string, data: { category?: string; tags?: string[] }) => {
    await updateHermesImage(id, data);
    await refresh();
  }, [refresh]);

  const removeImage = useCallback(async (id: string) => {
    await deleteHermesImage(id);
    await refresh();
  }, [refresh]);

  return {
    images,
    stats,
    loading,
    generating,
    error,
    category,
    setCategory,
    status,
    setStatus,
    refresh,
    generateImage,
    saveImage,
    removeImage,
  };
}
