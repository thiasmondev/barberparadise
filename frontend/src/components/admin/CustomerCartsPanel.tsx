"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, FileText, Loader2, RefreshCw, ShoppingCart } from "lucide-react";
import {
  convertAdminCustomerCartToDraft,
  getAdminCustomerCarts,
  type AdminCustomerCart,
} from "@/lib/admin-api";

const moneyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function activityTime(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatActivity(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? dateFormatter.format(date) : "Date inconnue";
}

type RequestScope = { active: boolean };
type CreatedDraft = { cartId: string; draftId: string; label: string };

// Une nouvelle fiche ne réutilise jamais les paniers, erreurs ou succès du client précédent.
export default function CustomerCartsPanel({ customerId }: { customerId: string }) {
  return <CustomerCartsContent key={customerId} customerId={customerId} />;
}

function CustomerCartsContent({ customerId }: { customerId: string }) {
  const [carts, setCarts] = useState<AdminCustomerCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [createdDrafts, setCreatedDrafts] = useState<CreatedDraft[]>([]);
  const scopeRef = useRef<RequestScope | null>(null);
  const loadRequestRef = useRef(0);
  const conversionLatchRef = useRef<object | null>(null);
  const convertedCartIdsRef = useRef(new Set<string>());

  const loadCarts = useCallback(async () => {
    const scope = scopeRef.current;
    if (!scope?.active || !customerId) return;
    const requestId = ++loadRequestRef.current;
    const isCurrent = () => scope.active && scopeRef.current === scope && loadRequestRef.current === requestId;

    setLoading(true);
    setError("");
    try {
      const data = await getAdminCustomerCarts(customerId);
      if (!isCurrent()) return;
      setCarts(
        data.carts
          .filter((cart) => cart.itemCount > 0 && cart.items.length > 0 && !convertedCartIdsRef.current.has(cart.id))
          .sort((a, b) => activityTime(b.lastSeenAt) - activityTime(a.lastSeenAt)),
      );
    } catch (err: unknown) {
      if (!isCurrent()) return;
      setError(err instanceof Error ? err.message : "Impossible de charger les paniers de ce client.");
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    const scope: RequestScope = { active: true };
    scopeRef.current = scope;
    void loadCarts();
    return () => {
      // Les helpers n'acceptent pas d'AbortSignal : ignorer les réponses après départ de la fiche.
      scope.active = false;
    };
  }, [loadCarts]);

  const handleConvert = useCallback(async (cart: AdminCustomerCart) => {
    const scope = scopeRef.current;
    // Le verrou synchrone bloque aussi deux clics intervenant avant le prochain rendu React.
    if (!scope?.active || loading || conversionLatchRef.current || convertedCartIdsRef.current.has(cart.id)) return;
    const operation = {};
    conversionLatchRef.current = operation;
    const isCurrent = () => scope.active && scopeRef.current === scope;

    setConvertingId(cart.id);
    setLineErrors((current) => {
      const next = { ...current };
      delete next[cart.id];
      return next;
    });

    try {
      const data = await convertAdminCustomerCartToDraft(customerId, cart.id);
      if (!isCurrent()) return;
      convertedCartIdsRef.current.add(cart.id);
      setCreatedDrafts((current) => [...current, {
        cartId: cart.id,
        draftId: data.draft.id,
        label: data.draft.orderNumber || data.draft.id.slice(-8),
      }]);
      setCarts((current) => current.filter((entry) => entry.id !== cart.id));
      // Le succès reste visible même si cette actualisation échoue.
      await loadCarts();
    } catch (err: unknown) {
      if (!isCurrent()) return;
      setLineErrors((current) => ({
        ...current,
        [cart.id]: err instanceof Error ? err.message : "Impossible de transformer ce panier en brouillon. Réessayez.",
      }));
    } finally {
      if (conversionLatchRef.current === operation) conversionLatchRef.current = null;
      if (isCurrent()) setConvertingId(null);
    }
  }, [customerId, loadCarts, loading]);

  return (
    <section aria-label="Paniers du client" className="min-w-0 rounded-xl border border-gray-100 bg-white">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-dark-800">
            <ShoppingCart size={17} className="shrink-0 text-primary" aria-hidden="true" />
            Paniers non convertis
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            Paniers enregistrés non vides, sans attendre une heure d'inactivité. Il s'agit du dernier état enregistré de chaque session, pas d'un panier en temps réel.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadCarts()}
          disabled={loading || convertingId !== null}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-dark-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} aria-hidden="true" />
          Actualiser
        </button>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <p className="text-xs leading-relaxed text-gray-500">
          Montants indicatifs aux prix publics TTC du panier enregistré. Le brouillon recalcule les tarifs applicables côté serveur. Cette action ne modifie pas le panier du client, ne déclenche aucun paiement et n'envoie aucun email.
        </p>

        {createdDrafts.length > 0 && (
          <div role="status" aria-live="polite" className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {createdDrafts.map((draft) => (
              <div key={draft.cartId} className="min-w-0">
                <p className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">Panier transformé en brouillon {draft.label}.</span>
                </p>
                <Link
                  href={`/admin/commandes/brouillons?draftId=${encodeURIComponent(draft.draftId)}`}
                  className="mt-1 inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-2 font-semibold underline underline-offset-2 hover:text-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <FileText size={14} className="shrink-0" aria-hidden="true" />
                  Ouvrir le brouillon créé
                </Link>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{error}</span>
            </p>
            <p className="mt-2 text-xs">Cliquez sur Actualiser pour réessayer.</p>
          </div>
        )}

        {loading ? (
          <div role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
            <Loader2 size={18} className="shrink-0 animate-spin" aria-hidden="true" />
            Chargement des paniers…
          </div>
        ) : carts.length === 0 ? (
          !error && (
            <div className="py-8 text-center text-sm text-gray-500">
              <ShoppingCart size={28} className="mx-auto mb-2 text-gray-300" aria-hidden="true" />
              Aucun panier non converti et non vide pour ce client.
            </div>
          )
        ) : (
          <div className="space-y-4">
            {carts.map((cart, index) => (
              <article key={cart.id} className="min-w-0 rounded-lg border border-gray-200 p-3 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-dark-800">
                      {index === 0 ? "Panier le plus récent" : "Autre appareil / session"}
                    </h3>
                    <p className="mt-1 break-words text-xs text-gray-500">
                      Session {cart.id.slice(-8)} · Dernière activité : {formatActivity(cart.lastSeenAt)}
                    </p>
                    {cart.email && <p className="mt-1 break-words text-xs text-gray-500">{cart.email}</p>}
                  </div>
                  <div className="text-sm sm:text-right">
                    <p className="font-semibold tabular-nums text-dark-800">{moneyFormatter.format(cart.total)} TTC indicatif</p>
                    <p className="mt-1 text-xs text-gray-500">{cart.itemCount} article{cart.itemCount !== 1 ? "s" : ""}</p>
                  </div>
                </div>

                <ul className="mt-3 divide-y divide-gray-100 border-y border-gray-100">
                  {cart.items.map((item, itemIndex) => (
                    <li key={`${item.productId}:${item.variantId ?? ""}:${itemIndex}`} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:justify-between sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-medium text-dark-800">{item.name}</p>
                        {item.variantLabel && <p className="mt-0.5 break-words text-xs text-gray-500">{item.variantLabel}</p>}
                        <p className="mt-1 text-xs text-gray-500">Quantité : {item.quantity} · {moneyFormatter.format(item.price)} / unité TTC indicatif</p>
                      </div>
                      <p className="text-sm font-medium tabular-nums text-dark-800 sm:text-right">{moneyFormatter.format(item.lineTotal)} TTC</p>
                    </li>
                  ))}
                </ul>

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => void handleConvert(cart)}
                    disabled={convertingId !== null || loading}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-dark-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {convertingId === cart.id ? <Loader2 size={15} className="shrink-0 animate-spin" aria-hidden="true" /> : <FileText size={15} className="shrink-0" aria-hidden="true" />}
                    {convertingId === cart.id ? "Création du brouillon…" : "Transformer en brouillon"}
                  </button>
                  {lineErrors[cart.id] && <p role="alert" className="mt-2 break-words text-xs leading-relaxed text-red-600">{lineErrors[cart.id]}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
