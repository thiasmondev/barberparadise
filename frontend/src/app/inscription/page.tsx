"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function InscriptionPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading } = useCustomerAuth();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/compte");
    }
  }, [isAuthenticated, isLoading, router]);

  const setField = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const validate = () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.password || !form.confirmPassword) {
      return "Tous les champs sont obligatoires.";
    }
    if (!emailRegex.test(form.email.trim())) return "Veuillez saisir une adresse email valide.";
    if (form.password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
    if (form.password !== form.confirmPassword) return "La confirmation du mot de passe ne correspond pas.";
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
      await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      router.replace("/compte");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer le compte client.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="min-h-[calc(100vh-160px)] bg-[#0b0b0b] px-6 py-16 text-white">
      <div className="mx-auto grid max-w-5xl overflow-hidden border border-white/10 bg-[#131313] shadow-2xl shadow-black/40 md:grid-cols-[1.1fr_0.9fr]">
        <div className="p-8 sm:p-12">
          <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#E91E8C]">Inscription</p>
          <h1 className="mt-4 text-3xl font-black uppercase">Créer mon compte</h1>
          <p className="mt-3 text-sm text-white/50">Créez un espace client pour suivre vos commandes, gérer vos adresses et sauvegarder vos produits favoris.</p>

          {error && (
            <div className="mt-8 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Prénom" icon={<User size={18} />} value={form.firstName} onChange={(value) => setField("firstName", value)} autoComplete="given-name" />
              <Field label="Nom" icon={<User size={18} />} value={form.lastName} onChange={(value) => setField("lastName", value)} autoComplete="family-name" />
            </div>

            <Field label="Email" type="email" icon={<Mail size={18} />} value={form.email} onChange={(value) => setField("email", value)} autoComplete="email" placeholder="vous@email.com" />

            <div className="grid gap-5 sm:grid-cols-2">
              <PasswordField label="Mot de passe" value={form.password} onChange={(value) => setField("password", value)} show={showPassword} toggle={() => setShowPassword((value) => !value)} autoComplete="new-password" />
              <PasswordField label="Confirmation" value={form.confirmPassword} onChange={(value) => setField("confirmPassword", value)} show={showPassword} toggle={() => setShowPassword((value) => !value)} autoComplete="new-password" />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#E91E8C] px-6 py-4 text-[12px] font-black uppercase tracking-[0.25em] text-white transition hover:bg-[#ff4a9f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Création..." : "S'inscrire"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-white/50">
            Déjà un compte ?{" "}
            <Link href="/connexion" className="font-bold text-[#E91E8C] hover:text-white">Se connecter</Link>
          </p>
        </div>

        <div className="hidden bg-[radial-gradient(circle_at_80%_20%,rgba(233,30,140,0.28),transparent_35%),linear-gradient(135deg,#050505,#141414)] p-10 md:flex md:flex-col md:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#E91E8C]">Barber Paradise</p>
            <h2 className="mt-6 text-4xl font-black uppercase leading-tight tracking-tight">Votre sélection professionnelle, sauvegardée.</h2>
          </div>
          <p className="max-w-xs text-sm leading-7 text-white/55">Un compte unique pour accélérer vos prochaines commandes et retrouver vos essentiels de barber.</p>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  icon,
  value,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">{label}</label>
      <div className="mt-2 flex items-center border border-white/10 bg-[#0e0e0e] focus-within:border-[#E91E8C]">
        <span className="ml-4 text-white/30">{icon}</span>
        <input type={type} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full bg-transparent px-4 py-4 text-sm text-white outline-none placeholder:text-white/25" />
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  toggle,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  toggle: () => void;
  autoComplete?: string;
}) {
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
