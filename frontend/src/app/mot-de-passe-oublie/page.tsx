"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { requestPasswordReset } from "@/lib/customer-api";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function MotDePasseOubliePage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
      setError("Veuillez saisir une adresse email valide.");
      setMessage("");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await requestPasswordReset(normalizedEmail);
      setMessage(response.message || "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’envoyer le lien de réinitialisation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#080808] px-5 py-16 text-white sm:px-6">
      <section className="mx-auto grid max-w-5xl overflow-hidden border border-white/10 bg-[#111] shadow-2xl md:grid-cols-[0.9fr_1.1fr]">
        <div className="hidden bg-[radial-gradient(circle_at_20%_20%,rgba(233,30,140,0.32),transparent_32%),linear-gradient(135deg,#050505,#161616)] p-10 md:flex md:flex-col md:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#E91E8C]">Sécurité compte</p>
            <h1 className="mt-6 text-4xl font-black uppercase leading-tight tracking-tight">Récupérer votre accès Barber Paradise.</h1>
          </div>
          <p className="text-sm leading-7 text-white/55">Recevez un lien sécurisé valable temporairement pour créer un nouveau mot de passe.</p>
        </div>

        <div className="p-8 sm:p-12">
          <Link href="/connexion" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/45 hover:text-white">
            <ArrowLeft size={16} /> Retour connexion
          </Link>
          <p className="mt-10 text-[11px] font-black uppercase tracking-[0.35em] text-[#E91E8C]">Mot de passe oublié</p>
          <h2 className="mt-4 text-3xl font-black uppercase">Réinitialiser mon mot de passe</h2>
          <p className="mt-3 text-sm leading-7 text-white/50">Indiquez l’adresse email de votre compte client. Si elle correspond à un compte existant, nous envoyons le lien de changement de mot de passe.</p>

          {error && <div className="mt-8 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">{error}</div>}
          {message && <div className="mt-8 border border-[#E91E8C]/30 bg-[#E91E8C]/10 px-4 py-3 text-sm text-pink-100" role="status">{message}</div>}

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label htmlFor="email" className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Adresse email</label>
              <div className="mt-2 flex items-center border border-white/10 bg-[#0e0e0e] focus-within:border-[#E91E8C]">
                <Mail size={18} className="ml-4 text-white/30" />
                <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full bg-transparent px-4 py-4 text-sm text-white outline-none placeholder:text-white/25" placeholder="votre@email.com" />
              </div>
            </div>

            <button type="submit" disabled={submitting} className="w-full bg-[#E91E8C] px-6 py-4 text-[12px] font-black uppercase tracking-[0.25em] text-white transition hover:bg-[#ff4a9f] disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? "Envoi..." : "Recevoir le lien"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
