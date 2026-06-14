"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { resetCustomerPassword } from "@/lib/customer-api";

export default function ReinitialiserMotDePassePage() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setError("Lien de réinitialisation manquant ou invalide.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setError("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await resetCustomerPassword(token, password);
      setMessage(response.message || "Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de réinitialiser le mot de passe.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#080808] px-5 py-16 text-white sm:px-6">
      <section className="mx-auto grid max-w-5xl overflow-hidden border border-white/10 bg-[#111] shadow-2xl md:grid-cols-[0.9fr_1.1fr]">
        <div className="hidden bg-[radial-gradient(circle_at_20%_20%,rgba(233,30,140,0.32),transparent_32%),linear-gradient(135deg,#050505,#161616)] p-10 md:flex md:flex-col md:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#E91E8C]">Nouveau mot de passe</p>
            <h1 className="mt-6 text-4xl font-black uppercase leading-tight tracking-tight">Sécurisez votre compte client.</h1>
          </div>
          <p className="text-sm leading-7 text-white/55">Choisissez un mot de passe unique d’au moins 8 caractères.</p>
        </div>

        <div className="p-8 sm:p-12">
          <Link href="/connexion" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/45 hover:text-white">
            <ArrowLeft size={16} /> Retour connexion
          </Link>
          <p className="mt-10 text-[11px] font-black uppercase tracking-[0.35em] text-[#E91E8C]">Réinitialisation</p>
          <h2 className="mt-4 text-3xl font-black uppercase">Créer un nouveau mot de passe</h2>
          <p className="mt-3 text-sm leading-7 text-white/50">Ce lien est valable pendant une durée limitée. Une fois validé, l’ancien mot de passe ne fonctionnera plus.</p>

          {!token && <div className="mt-8 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">Lien de réinitialisation invalide. Demandez un nouveau lien depuis la page mot de passe oublié.</div>}
          {error && <div className="mt-8 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">{error}</div>}
          {message && <div className="mt-8 border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-100" role="status"><CheckCircle2 size={16} className="mr-2 inline" />{message}</div>}

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <PasswordField label="Nouveau mot de passe" value={password} onChange={setPassword} show={showPassword} toggle={() => setShowPassword((value) => !value)} autoComplete="new-password" />
            <PasswordField label="Confirmation" value={confirmPassword} onChange={setConfirmPassword} show={showPassword} toggle={() => setShowPassword((value) => !value)} autoComplete="new-password" />

            <button type="submit" disabled={submitting || !token} className="w-full bg-[#E91E8C] px-6 py-4 text-[12px] font-black uppercase tracking-[0.25em] text-white transition hover:bg-[#ff4a9f] disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? "Validation..." : "Changer mon mot de passe"}
            </button>
          </form>

          {message && <Link href="/connexion" className="mt-6 inline-flex w-full justify-center border border-white/10 px-6 py-4 text-[12px] font-black uppercase tracking-[0.25em] text-white/70 transition hover:border-white hover:text-white">Se connecter</Link>}
        </div>
      </section>
    </main>
  );
}

function PasswordField({ label, value, onChange, show, toggle, autoComplete }: { label: string; value: string; onChange: (value: string) => void; show: boolean; toggle: () => void; autoComplete: string }) {
  return (
    <div>
      <label className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">{label}</label>
      <div className="mt-2 flex items-center border border-white/10 bg-[#0e0e0e] focus-within:border-[#E91E8C]">
        <Lock size={18} className="ml-4 text-white/30" />
        <input type={show ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-transparent px-4 py-4 text-sm text-white outline-none placeholder:text-white/25" />
        <button type="button" onClick={toggle} className="px-4 text-white/40 hover:text-white" aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
