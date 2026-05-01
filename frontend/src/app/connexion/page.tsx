"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ConnexionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/compte";
  const { login, isAuthenticated, isLoading } = useCustomerAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, isLoading, redirectTo, router]);

  const validate = () => {
    if (!email.trim() || !password) return "Tous les champs sont obligatoires.";
    if (!emailRegex.test(email.trim())) return "Veuillez saisir une adresse email valide.";
    return "";
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Identifiants incorrects.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="min-h-[calc(100vh-160px)] bg-[#0b0b0b] px-6 py-16 text-white">
      <div className="mx-auto grid max-w-5xl overflow-hidden border border-white/10 bg-[#131313] shadow-2xl shadow-black/40 md:grid-cols-[0.9fr_1.1fr]">
        <div className="hidden bg-[radial-gradient(circle_at_20%_20%,rgba(233,30,140,0.28),transparent_35%),linear-gradient(135deg,#111,#050505)] p-10 md:flex md:flex-col md:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#E91E8C]">Espace client</p>
            <h1 className="mt-6 text-4xl font-black uppercase leading-tight tracking-tight">Connexion Barber Paradise</h1>
          </div>
          <p className="max-w-xs text-sm leading-7 text-white/55">Retrouvez vos commandes, vos adresses et votre wishlist depuis un espace sécurisé.</p>
        </div>

        <div className="p-8 sm:p-12">
          <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#E91E8C]">Connexion</p>
          <h2 className="mt-4 text-3xl font-black uppercase">Accéder à mon compte</h2>
          <p className="mt-3 text-sm text-white/50">Connectez-vous avec l’adresse email utilisée lors de votre commande.</p>

          {error && (
            <div className="mt-8 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
            <div>
              <label htmlFor="email" className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Email</label>
              <div className="mt-2 flex items-center border border-white/10 bg-[#0e0e0e] focus-within:border-[#E91E8C]">
                <Mail size={18} className="ml-4 text-white/30" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full bg-transparent px-4 py-4 text-sm text-white outline-none placeholder:text-white/25"
                  placeholder="vous@email.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Mot de passe</label>
              <div className="mt-2 flex items-center border border-white/10 bg-[#0e0e0e] focus-within:border-[#E91E8C]">
                <Lock size={18} className="ml-4 text-white/30" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-transparent px-4 py-4 text-sm text-white outline-none placeholder:text-white/25"
                  placeholder="Votre mot de passe"
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="px-4 text-white/40 hover:text-white" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#E91E8C] px-6 py-4 text-[12px] font-black uppercase tracking-[0.25em] text-white transition hover:bg-[#ff4a9f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Connexion..." : "Se connecter"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-white/50">
            Pas encore de compte ?{" "}
            <Link href="/inscription" className="font-bold text-[#E91E8C] hover:text-white">S'inscrire</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
