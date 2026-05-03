"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  approveAdminProAccount,
  getAdminProAccount,
  rejectAdminProAccount,
  suspendAdminProAccount,
  type AdminProAccount,
} from "@/lib/admin-api";

type ProStatus = AdminProAccount["status"];

const STATUS_BADGES: Record<ProStatus, { label: string; className: string }> = {
  pending: {
    label: "EN ATTENTE",
    className: "border-yellow-400/30 bg-yellow-500/10 text-yellow-200",
  },
  approved: {
    label: "APPROUVÉ",
    className: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  },
  rejected: {
    label: "REFUSÉ",
    className: "border-red-400/30 bg-red-500/10 text-red-200",
  },
  suspended: {
    label: "SUSPENDU",
    className: "border-orange-400/30 bg-orange-500/10 text-orange-200",
  },
};

function StatusBadge({ status }: { status: ProStatus }) {
  const badge = STATUS_BADGES[status];

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${badge.className}`}>
      {badge.label}
    </span>
  );
}

export default function AdminProDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [account, setAccount] = useState<AdminProAccount | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionDone, setActionDone] = useState(false);

  const load = useCallback(async () => {
    const refreshedAccount = await getAdminProAccount(params.id);
    setAccount(refreshedAccount);
  }, [params.id]);

  useEffect(() => {
    load().catch((error) => setMessage(error instanceof Error ? error.message : "Erreur chargement"));
  }, [load]);

  const isActionDisabled = isProcessing || actionDone;
  const disabledClassName = isActionDisabled ? "opacity-50 cursor-not-allowed" : "hover:brightness-110";

  const customerLabel = useMemo(() => {
    if (!account) return "";
    return `${account.customer.firstName} ${account.customer.lastName} — ${account.customer.email}`;
  }, [account]);

  async function handleApprove() {
    setIsProcessing(true);
    setMessage("");
    try {
      const response = await approveAdminProAccount(params.id);
      setAccount(response.account);
      setActionDone(true);
      setMessage("Compte professionnel approuvé.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleReject() {
    setIsProcessing(true);
    setMessage("");
    try {
      const response = await rejectAdminProAccount(params.id, reason || "Demande refusée");
      setAccount(response.account);
      setActionDone(true);
      setMessage("Compte professionnel refusé.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleSuspend() {
    setIsProcessing(true);
    setMessage("");
    try {
      const response = await suspendAdminProAccount(params.id, reason || "Compte suspendu");
      setAccount(response.account);
      setActionDone(true);
      setMessage("Compte professionnel suspendu.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleRefresh() {
    setActionDone(false);
    await load();
    router.refresh();
  }

  if (!account) return <div className="text-zinc-300">Chargement...</div>;

  const detailRows: [string, string][] = [
    ["Entreprise", account.companyName],
    ["Activité", account.activity],
    ["Téléphone", account.phone],
    ["SIRET", account.siret || "Non renseigné"],
    ["TVA intracommunautaire", account.vatNumber || "Non renseigné"],
    ["Client", customerLabel],
    ["Date demande", new Date(account.createdAt).toLocaleString("fr-FR")],
    ["Motif refus ou suspension", account.rejectionReason || "—"],
  ];

  return (
    <div className="space-y-6">
      <Link href="/admin/pro" className="text-sm text-pink-400 hover:text-pink-300">
        ← Retour demandes pro
      </Link>

      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wider text-pink-500">Demande professionnelle</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-white">{account.companyName}</h1>
          <StatusBadge status={account.status} />
        </div>
      </div>

      {message && <div className="rounded-lg border border-pink-500/30 bg-pink-500/10 p-4 text-pink-100">{message}</div>}

      <div className="grid gap-4 md:grid-cols-2">
        {detailRows.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
            <p className="mt-2 text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        <label className="text-xs uppercase tracking-wider text-zinc-500" htmlFor="pro-action-reason">
          Raison de refus ou suspension
        </label>
        <textarea
          id="pro-action-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={isActionDisabled}
          className={`mt-3 h-28 w-full rounded-lg border border-zinc-800 bg-black p-3 text-white outline-none focus:border-pink-500 ${
            isActionDisabled ? "opacity-60 cursor-not-allowed" : ""
          }`}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        {account.status !== "approved" && (
          <button
            type="button"
            onClick={handleApprove}
            disabled={isActionDisabled}
            className={`rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition ${disabledClassName}`}
          >
            {isProcessing ? "En cours..." : "Approuver"}
          </button>
        )}

        {account.status !== "rejected" && (
          <button
            type="button"
            onClick={handleReject}
            disabled={isActionDisabled}
            className={`rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition ${disabledClassName}`}
          >
            {isProcessing ? "En cours..." : "Refuser"}
          </button>
        )}

        {account.status === "approved" && (
          <button
            type="button"
            onClick={handleSuspend}
            disabled={isActionDisabled}
            className={`rounded-lg bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition ${disabledClassName}`}
          >
            {isProcessing ? "En cours..." : "Suspendre"}
          </button>
        )}

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isProcessing}
          className={`rounded-lg border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-200 transition ${
            isProcessing ? "opacity-50 cursor-not-allowed" : "hover:border-zinc-500 hover:text-white"
          }`}
        >
          Rafraîchir
        </button>
      </div>
    </div>
  );
}
