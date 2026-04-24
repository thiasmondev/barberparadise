"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { getAdminToken } from "@/lib/admin-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://barberparadise-backend.onrender.com";

interface ImageManagerProps {
  productId: string;
  images: string[];
  imageAlts?: string[];
  onChange: (images: string[]) => void;
  onAltsChange?: (alts: string[]) => void;
}

export default function ImageManager({ productId, images, imageAlts = [], onChange, onAltsChange }: ImageManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alts, setAlts] = useState<string[]>([]);
  const [savingAlts, setSavingAlts] = useState(false);
  const [altsSaved, setAltsSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchroniser les alts avec les images
  useEffect(() => {
    const synced = images.map((_, i) => imageAlts[i] || "");
    setAlts(synced);
  }, [images.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Mise à jour d'un alt ────────────────────────────────────
  const updateAlt = (index: number, value: string) => {
    const newAlts = [...alts];
    newAlts[index] = value;
    setAlts(newAlts);
    setAltsSaved(false);
    if (onAltsChange) onAltsChange(newAlts);
  };

  // ─── Sauvegarde des alts ─────────────────────────────────────
  const saveAlts = useCallback(async () => {
    setSavingAlts(true);
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_URL}/api/admin/products/${productId}/image-alts`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ imageAlts: alts }),
      });
      if (!res.ok) throw new Error("Erreur sauvegarde alts");
      setAltsSaved(true);
      setTimeout(() => setAltsSaved(false), 3000);
    } catch {
      setError("Impossible de sauvegarder les alt texts");
    } finally {
      setSavingAlts(false);
    }
  }, [productId, alts]);

  // ─── Upload vers le backend ──────────────────────────────────
  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Seules les images sont acceptées (JPG, PNG, WebP, GIF)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("L'image ne doit pas dépasser 10 MB");
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const token = getAdminToken();
      if (!token) {
        throw new Error("Non authentifié — veuillez vous reconnecter");
      }
      setUploadProgress(40);

      const res = await fetch(`${API_URL}/api/admin/products/${productId}/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      setUploadProgress(80);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Erreur HTTP ${res.status}` }));
        throw new Error(err.error || `Erreur upload (${res.status})`);
      }

      const data = await res.json();
      setUploadProgress(100);
      onChange(data.images);
      // Ajouter un alt vide pour la nouvelle image
      setAlts(prev => [...prev, ""]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [productId, onChange]);

  // ─── Gestion du drop zone ────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (files.length === 0) { setError("Aucune image détectée dans les fichiers déposés"); return; }
    files.reduce((promise, file) => promise.then(() => uploadFile(file)), Promise.resolve());
  }, [uploadFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.reduce((promise, file) => promise.then(() => uploadFile(file)), Promise.resolve());
    e.target.value = "";
  }, [uploadFile]);

  // ─── Suppression d'image ─────────────────────────────────────
  const handleDelete = useCallback(async (url: string, index: number) => {
    if (!confirm("Supprimer cette image ?")) return;
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_URL}/api/admin/products/${productId}/images`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error("Erreur suppression");
      const data = await res.json();
      onChange(data.images);
      // Retirer l'alt correspondant
      setAlts(prev => prev.filter((_, i) => i !== index));
    } catch {
      setError("Impossible de supprimer l'image");
    }
  }, [productId, onChange]);

  // ─── Définir comme image principale ─────────────────────────
  const setAsMain = useCallback(async (index: number) => {
    if (index === 0) return;
    const newImages = [...images];
    const [moved] = newImages.splice(index, 1);
    newImages.unshift(moved);
    // Réorganiser les alts de la même façon
    const newAlts = [...alts];
    const [movedAlt] = newAlts.splice(index, 1);
    newAlts.unshift(movedAlt);
    try {
      const token = getAdminToken();
      await fetch(`${API_URL}/api/admin/products/${productId}/images`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ images: newImages }),
      });
      onChange(newImages);
      setAlts(newAlts);
    } catch {
      setError("Impossible de réorganiser les images");
    }
  }, [images, alts, productId, onChange]);

  // ─── Drag & Drop pour réorganiser ───────────────────────────
  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };
  const handleDragEnd = async () => {
    if (dragIndex === null || dragOverIndex === null || dragIndex === dragOverIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newImages = [...images];
    const [moved] = newImages.splice(dragIndex, 1);
    newImages.splice(dragOverIndex, 0, moved);
    // Réorganiser les alts de la même façon
    const newAlts = [...alts];
    const [movedAlt] = newAlts.splice(dragIndex, 1);
    newAlts.splice(dragOverIndex, 0, movedAlt);
    setDragIndex(null);
    setDragOverIndex(null);
    try {
      const token = getAdminToken();
      await fetch(`${API_URL}/api/admin/products/${productId}/images`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ images: newImages }),
      });
      onChange(newImages);
      setAlts(newAlts);
    } catch {
      setError("Impossible de réorganiser les images");
    }
  };

  return (
    <div className="space-y-4">
      {/* Zone de drop */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
          ${dragOver ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"}
          ${uploading ? "opacity-60 cursor-not-allowed" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileInput}
          disabled={uploading}
        />

        {uploading ? (
          <div className="space-y-3">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-600 font-medium">Upload en cours...</p>
            <div className="w-full bg-gray-200 rounded-full h-2 max-w-xs mx-auto">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                {dragOver ? "Déposez les images ici" : "Cliquez ou glissez des images ici"}
              </p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP, GIF — max 10 MB par image</p>
            </div>
          </div>
        )}
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Grille d'images avec champs alt */}
      {images.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              Glissez pour réorganiser · La 1ère image est l'image principale
            </p>
            <button
              onClick={saveAlts}
              disabled={savingAlts}
              className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                altsSaved
                  ? "bg-green-100 text-green-700 border border-green-200"
                  : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
              }`}
            >
              {savingAlts ? "Sauvegarde..." : altsSaved ? "✓ Alt texts sauvegardés" : "Sauvegarder les alt texts"}
            </button>
          </div>

          <div className="space-y-4">
            {images.map((url, index) => (
              <div
                key={url}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`
                  border-2 rounded-xl overflow-hidden transition-all cursor-grab active:cursor-grabbing
                  ${index === 0 ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-200 hover:border-gray-300"}
                  ${dragOverIndex === index && dragIndex !== index ? "border-blue-400 shadow-lg scale-[1.01]" : ""}
                  ${dragIndex === index ? "opacity-50" : ""}
                `}
              >
                <div className="flex gap-3 p-3">
                  {/* Miniature */}
                  <div className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                    {index === 0 && (
                      <div className="absolute top-1 left-1 z-10 bg-blue-500 text-white text-[9px] px-1 py-0.5 rounded font-bold">
                        MAIN
                      </div>
                    )}
                    <img
                      src={url}
                      alt={alts[index] || `Image ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://via.placeholder.com/80x80?text=Err";
                      }}
                    />
                    <div className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                      {index + 1}
                    </div>
                  </div>

                  {/* Champ alt text */}
                  <div className="flex-1 flex flex-col gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        Alt text SEO
                        {index === 0 && <span className="text-blue-500 ml-1">(image principale)</span>}
                      </label>
                      <input
                        type="text"
                        value={alts[index] || ""}
                        onChange={(e) => updateAlt(index, e.target.value)}
                        placeholder={`Ex: Cire brillante Uppercut Deluxe 100g — Barber Paradise`}
                        className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-gray-50"
                        maxLength={125}
                      />
                      <p className="text-[10px] text-gray-400 mt-0.5 text-right">
                        {(alts[index] || "").length}/125 caractères
                        {(alts[index] || "").length > 100 && <span className="text-orange-500 ml-1">⚠ Trop long</span>}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-auto">
                      {index !== 0 && (
                        <button
                          onClick={() => setAsMain(index)}
                          className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded-md font-medium transition-colors border border-blue-200"
                        >
                          ★ Principale
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(url, index)}
                        className="text-[10px] bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded-md font-medium transition-colors border border-red-200 ml-auto"
                      >
                        🗑 Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Bouton ajouter rapide */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex items-center justify-center gap-2 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm text-gray-400">Ajouter une image</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
