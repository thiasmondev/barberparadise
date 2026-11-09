"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { Order } from "@/types";
import {
  getAdminOrderDiscounts, previewAdminOrderDiscounts, updateAdminOrderDiscounts,
  type AdminOrderDiscountPayload, type AdminOrderDiscountPreview, type AdminOrderDiscountState, type DiscountType,
} from "@/lib/admin-api";

function price(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(value);
}

type InputDiscount = { type: DiscountType; value: string };
function initialDiscount(type: DiscountType | null, value: number | null): InputDiscount {
  return { type: type || "fixed", value: value == null ? "" : String(value) };
}
function parseDiscount(input: InputDiscount): { type: DiscountType | null; value: number | null } {
  const value = input.value.trim() === "" ? 0 : Number(input.value.replace(",", "."));
  if (!Number.isFinite(value) || value < 0 || (input.type === "percent" && value > 100)) {
    throw new Error("Saisissez une remise positive, et un pourcentage entre 0 et 100.");
  }
  return { type: value > 0 ? input.type : null, value: value > 0 ? value : null };
}

function DiscountInput({ label, input, onChange }: { label: string; input: InputDiscount; onChange: (next: InputDiscount) => void }) {
  return <div className="flex gap-2">
    <select aria-label={`Type de remise — ${label}`} value={input.type} onChange={(event) => onChange({ ...input, type: event.target.value as DiscountType })} className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm">
      <option value="fixed">€ fixe</option><option value="percent">%</option>
    </select>
    <input aria-label={`Remise — ${label}`} type="number" min="0" max={input.type === "percent" ? 100 : undefined} step="0.01" value={input.value} placeholder="0" onChange={(event) => onChange({ ...input, value: event.target.value })} className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
  </div>;
}

export default function OrderDiscountEditor({ orderId, currency = "EUR", onSaved, onClose }: {
  orderId: string; currency?: string; onSaved: (order: Order) => void; onClose: () => void;
}) {
  const [state, setState] = useState<AdminOrderDiscountState | null>(null);
  const [lines, setLines] = useState<Record<string, InputDiscount>>({});
  const [global, setGlobal] = useState<InputDiscount>({ type: "fixed", value: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<AdminOrderDiscountPreview | null>(null);
  const [previewPayload, setPreviewPayload] = useState<AdminOrderDiscountPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getAdminOrderDiscounts(orderId).then((data) => {
      if (cancelled) return;
      setState(data);
      setGlobal(initialDiscount(data.orderDiscountType, data.orderDiscountValue));
      setLines(Object.fromEntries(data.items.map((item) => [item.id, initialDiscount(item.lineDiscountType, item.lineDiscountValue)])));
    }).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Impossible de charger les remises.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orderId]);

  async function requestPreview() {
    if (!state) return;
    setBusy(true);
    setError("");
    try {
      const orderDiscount = parseDiscount(global);
      const payload: AdminOrderDiscountPayload = {
        expectedUpdatedAt: state.updatedAt,
        orderDiscountType: orderDiscount.type,
        orderDiscountValue: orderDiscount.value,
        items: state.items.map((item) => {
          const line = parseDiscount(lines[item.id]);
          return { id: item.id, lineDiscountType: line.type, lineDiscountValue: line.value };
        }),
      };
      const result = await previewAdminOrderDiscounts(orderId, payload);
      setPreviewPayload(payload);
      setPreview(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Impossible de prévisualiser la correction.");
    } finally { setBusy(false); }
  }

  async function save() {
    if (!preview || !previewPayload) return;
    setBusy(true);
    setError("");
    try {
      const result = await updateAdminOrderDiscounts(orderId, previewPayload);
      onSaved(result.order);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : "Impossible d’enregistrer la correction.") + " Si la commande a changé, fermez puis rouvrez cet éditeur pour la recharger.");
    } finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-6">
    <section role="dialog" aria-modal="true" aria-labelledby="order-discounts-title" className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2 id="order-discounts-title" className="font-semibold text-gray-950">Corriger les remises</h2>
        <button type="button" aria-label="Fermer l’éditeur de remises" disabled={busy} onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
      </header>
      <div className="space-y-4 overflow-y-auto p-5">
        <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">Seules les remises changent, sur les prix enregistrés. Quantités, stock et montants déjà encaissés restent inchangés. Aucun paiement, remboursement ou email n’est déclenché.</p>
        {loading && <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement des remises…</p>}
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {!loading && state && !preview && <>
          <p className="text-sm text-gray-600">Une remise fixe s’applique une seule fois à la ligne entière ; un pourcentage s’applique à prix × quantité. Les prix et bases sont indiqués en HT ou TTC selon la commande.</p>
          <div className="divide-y divide-gray-200 rounded-xl border border-gray-200">
            {state.items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0 flex-1"><p className="text-sm font-medium text-gray-950">{item.name}</p><p className="text-xs text-gray-500">{price(item.price, currency)} {item.priceTaxLabel} × {item.quantity} — brut {price(item.price * item.quantity, currency)} {item.priceTaxLabel}</p></div>
              <DiscountInput label={item.name} input={lines[item.id]} onChange={(next) => setLines((current) => ({ ...current, [item.id]: next }))} />
            </div>)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-3"><div><p className="text-sm font-semibold">Remise globale ({state.priceTaxLabel})</p><p className="text-xs text-gray-500">Appliquée après les remises articles.</p></div><DiscountInput label="commande" input={global} onChange={setGlobal} /></div>
          <p className="text-sm text-gray-600">Total actuel : <strong>{price(state.oldTotal, currency)}</strong>. Déjà payé : <strong>{state.paidAmount == null ? "non renseigné" : price(state.paidAmount, currency)}</strong>.</p>
        </>}
        {preview && state && <>
          <h3 className="font-semibold text-gray-950">Vérifier avant d’enregistrer</h3>
          <dl className="space-y-2 rounded-xl bg-gray-50 p-4 text-sm">
            {[
              ["Ancien total", price(preview.oldTotal, currency)],
              ["Nouveau total", price(preview.newTotal, currency)],
              ["Différence", `${preview.diff > 0 ? "+" : ""}${price(preview.diff, currency)}`],
              ["Total des remises", price(preview.discountTotal, currency)],
              ["Total HT", price(preview.totalHT, currency)],
              ["TVA", price(preview.vatAmount, currency)],
              ["Déjà payé — inchangé", state.paidAmount == null ? "non renseigné" : price(state.paidAmount, currency)],
              ["Reste à payer", preview.remainingAmount == null ? "à vérifier — payé non renseigné" : price(preview.remainingAmount, currency)],
              ["Trop-perçu", preview.overpaidAmount == null ? "à vérifier — payé non renseigné" : price(preview.overpaidAmount, currency)],
            ].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-gray-600">{label}</dt><dd className="text-right font-semibold">{value}</dd></div>)}
          </dl>
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">La facture existante ne sera pas remplacée : régénérez-la après correction. Un solde ou un remboursement éventuel doit être traité séparément, après vérification ; cette confirmation ne déclenche aucune transaction financière.</p>
        </>}
      </div>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-gray-200 p-4">
        {preview ? <><button type="button" disabled={busy} onClick={() => { setPreview(null); setPreviewPayload(null); setError(""); }} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Retour aux remises</button><button type="button" disabled={busy} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirmer la correction</button></> : <><button type="button" disabled={busy} onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Annuler</button><button type="button" disabled={loading || busy || !state} onClick={requestPreview} className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Prévisualiser</button></>}
      </footer>
    </section>
  </div>;
}
