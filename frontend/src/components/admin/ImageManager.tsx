"use client";
import { useState, useRef, useCallback } from "react";
import { getAdminToken } from "@/lib/admin-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://barberparadise-backend.onrender.com";

interface ImageManagerProps {
  productId: string;
  images: string[];
  onChange: (images: string[]) => void;
}

export default function ImageManager({ productId, images, onChange }: ImageManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setUploadProgress(40);

      const res = await fetch(`${API_URL}/api/admin/products/${productId}/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      setUploadProgress(80);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur upload");
      }

      const data = await res.json();
      setUploadProgress(100);
      onChange(data.images);
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
    // Upload séquentiel si plusieurs fichiers
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
    try {
      const token = getAdminToken();
      await fetch(`${API_URL}/api/admin/products/${productId}/images`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ images: newImages }),
      });
      onChange(newImages);
    } catch {
      setError("Impossible de réorganiser les images");
    }
  }, [images, productId, onChange]);

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

      {/* Grille d'images */}
      {images.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            Glissez pour réorganiser · La 1ère image est l'image principale
          </p>
          <div className="grid grid-cols-3 gap-3">
            {images.map((url, index) => (
              <div
                key={url}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`
                  relative group rounded-lg overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all
                  ${index === 0 ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200 hover:border-gray-400"}
                  ${dragOverIndex === index && dragIndex !== index ? "border-blue-400 scale-105 shadow-lg" : ""}
                  ${dragIndex === index ? "opacity-50" : ""}
                `}
              >
                {/* Badge image principale */}
                {index === 0 && (
                  <div className="absolute top-1 left-1 z-10 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                    Principale
                  </div>
                )}

                {/* Image */}
                <div className="aspect-square bg-gray-100">
                  <img
                    src={url}
                    alt={`Image ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://via.placeholder.com/200x200?text=Erreur";
                    }}
                  />
                </div>

                {/* Actions au survol */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                  {index !== 0 && (
                    <button
                      onClick={() => setAsMain(index)}
                      className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded-md font-medium transition-colors"
                    >
                      ★ Principale
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(url, index)}
                    className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded-md font-medium transition-colors"
                  >
                    🗑 Supprimer
                  </button>
                </div>

                {/* Numéro */}
                <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {index + 1}
                </div>
              </div>
            ))}

            {/* Bouton ajouter rapide */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
            >
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs text-gray-400 mt-1">Ajouter</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
