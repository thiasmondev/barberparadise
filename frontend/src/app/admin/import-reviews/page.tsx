"use client";
export const dynamic = "force-dynamic";

import { useState, useRef } from "react";
import { Upload, CheckCircle, XCircle, AlertCircle, FileText, Download, Star } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://barberparadise-backend.onrender.com";

interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  skipped: number;
  unmatched: number;
  unmatchedList: {
    reviewer_name: string;
    reviewer_email: string;
    rating: number;
    title: string;
    body: string;
    review_date: string;
    product_handle: string;
    product_id: string;
  }[];
}

export default function ImportReviewsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".csv")) {
      setError("Seuls les fichiers CSV sont acceptés.");
      return;
    }
    setFile(f);
    setError("");
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const token = localStorage.getItem("admin-token");
      const formData = new FormData();
      formData.append("csv", file);

      const res = await fetch(`${API_URL}/api/admin/import-reviews`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'import");
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const downloadUnmatched = () => {
    if (!result?.unmatchedList?.length) return;
    const blob = new Blob([JSON.stringify(result.unmatchedList, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "unmatched-reviews.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="font-heading font-bold text-xl text-dark-800">Import des avis Judge.me</h1>
        <p className="text-sm text-gray-500 mt-1">
          Importez votre export CSV Judge.me depuis Shopify. Les avis seront automatiquement associés aux produits et marqués comme vérifiés et approuvés.
        </p>
      </div>

      {/* Zone de dépôt */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
          dragging
            ? "border-violet-400 bg-violet-50"
            : file
            ? "border-green-300 bg-green-50"
            : "border-gray-200 hover:border-violet-300 hover:bg-violet-50/30"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {file ? (
          <div className="flex flex-col items-center gap-2">
            <FileText size={40} className="text-green-500" />
            <p className="font-semibold text-dark-700">{file.name}</p>
            <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB · Prêt à importer</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={40} className="text-gray-300" />
            <p className="font-semibold text-dark-600">Déposez votre CSV ici</p>
            <p className="text-sm text-gray-400">ou cliquez pour sélectionner un fichier</p>
            <p className="text-xs text-gray-300 mt-2">Format : export Judge.me depuis Shopify (.csv)</p>
          </div>
        )}
      </div>

      {/* Erreur */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
          <XCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Bouton import */}
      {file && !result && (
        <button
          onClick={handleImport}
          disabled={loading}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3"
        >
          {loading ? (
            <>
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Import en cours...
            </>
          ) : (
            <>
              <Upload size={16} />
              Lancer l'import
            </>
          )}
        </button>
      )}

      {/* Résultats */}
      {result && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
              <p className="text-2xl font-black text-dark-800">{result.total}</p>
              <p className="text-xs text-gray-500 mt-1">Total CSV</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center border border-green-100">
              <p className="text-2xl font-black text-green-600">{result.imported}</p>
              <p className="text-xs text-green-600 mt-1">Importés</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4 text-center border border-yellow-100">
              <p className="text-2xl font-black text-yellow-600">{result.skipped}</p>
              <p className="text-xs text-yellow-600 mt-1">Ignorés</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center border border-red-100">
              <p className="text-2xl font-black text-red-500">{result.unmatched}</p>
              <p className="text-xs text-red-500 mt-1">Non matchés</p>
            </div>
          </div>

          {/* Message de succès */}
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-xl">
            <CheckCircle size={20} className="text-green-500 shrink-0" />
            <div>
              <p className="font-semibold text-green-700 text-sm">Import terminé avec succès</p>
              <p className="text-xs text-green-600">
                {result.imported} avis importés · {result.skipped} déjà en base · {result.unmatched} produits non trouvés
              </p>
            </div>
          </div>

          {/* Avis non matchés */}
          {result.unmatchedList.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-orange-400" />
                  <span className="text-sm font-medium text-dark-700">
                    Avis non associés ({result.unmatchedList.length})
                  </span>
                </div>
                <button
                  onClick={downloadUnmatched}
                  className="flex items-center gap-1.5 text-xs text-violet-600 hover:underline"
                >
                  <Download size={12} />
                  Télécharger JSON
                </button>
              </div>
              <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                {result.unmatchedList.map((u, i) => (
                  <div key={i} className="px-4 py-3 flex items-start gap-3">
                    <div className="flex gap-0.5 mt-0.5 shrink-0">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star
                          key={j}
                          size={10}
                          className={j < u.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}
                        />
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-dark-700 truncate">{u.reviewer_name}</p>
                      <p className="text-xs text-gray-400 font-mono truncate">Handle : {u.product_handle}</p>
                      {u.body && <p className="text-xs text-gray-500 mt-1 line-clamp-1">"{u.body}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommencer */}
          <button
            onClick={() => { setFile(null); setResult(null); }}
            className="text-sm text-violet-600 hover:underline"
          >
            Importer un autre fichier
          </button>
        </div>
      )}

      {/* Instructions */}
      {!result && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 space-y-2">
          <p className="text-sm font-semibold text-blue-700">Comment exporter depuis Judge.me ?</p>
          <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
            <li>Allez dans votre app Judge.me sur Shopify</li>
            <li>Cliquez sur <strong>Reviews → Export</strong></li>
            <li>Sélectionnez le format <strong>Judge.me format</strong></li>
            <li>Téléchargez le fichier CSV et déposez-le ici</li>
          </ol>
        </div>
      )}
    </div>
  );
}
