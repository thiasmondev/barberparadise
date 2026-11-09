"use client";

import { useCart } from "@/contexts/CartContext";

export default function CartSyncStatus() {
  const { syncStatus, syncMessage, lastSyncedAt, syncCartNow } = useCart();
  const isSyncing = syncStatus === "syncing";
  const message = isSyncing ? "Enregistrement du panier…" : syncMessage || "Enregistrez votre panier pour le retrouver auprès de notre équipe.";

  return (
    <section className={`mb-8 rounded-lg border p-4 ${syncStatus === "error" ? "border-amber-400/30 bg-amber-400/10" : "border-white/10 bg-white/5"}`} aria-label="Enregistrement du panier">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p role="status" aria-live="polite" className="text-xs leading-relaxed text-gray-200">{message}</p>
          {lastSyncedAt && (
            <p className="mt-1 text-[11px] text-gray-400">
              Dernier enregistrement : <time dateTime={lastSyncedAt}>{new Date(lastSyncedAt).toLocaleString("fr-FR")}</time>
            </p>
          )}
          {syncStatus === "error" && <p className="mt-1 text-[11px] text-gray-400">Cela ne bloque pas votre commande.</p>}
        </div>
        <button type="button" onClick={syncCartNow} disabled={isSyncing}
          className="shrink-0 rounded border border-white/20 px-4 py-2 text-xs font-bold text-white transition hover:border-[#ff4a8d] hover:text-[#ff4a8d] disabled:cursor-wait disabled:opacity-50">
          Enregistrer mon panier
        </button>
      </div>
    </section>
  );
}
