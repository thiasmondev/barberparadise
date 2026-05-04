"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Gift,
  Loader2,
  Mail,
  Megaphone,
  PenLine,
  RefreshCw,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import {
  createMarketingCampaign,
  createMarketingEmailCampaign,
  createMarketingPromoCode,
  generateMarketingContent,
  getMarketingDashboard,
  getMarketingPromoCodes,
  publishMarketingBlogPost,
  sendMarketingEmailCampaign,
  syncMarketingBrevoContacts,
  type MarketingDashboard,
  type MarketingContentDraft,
  type PromoCode,
} from "@/lib/admin-api";

type TabKey = "generate" | "promos" | "email" | "blog";

type FormStatus = {
  type: "success" | "error" | "info";
  message: string;
} | null;

const defaultCampaign = {
  name: "Campagne Barber Paradise",
  goal: "Augmenter les ventes boutique et la réactivation client",
  audience: "Coiffeurs, barbiers et particuliers exigeants",
  channel: "multi_channel",
  brief: "Mettre en avant l’expertise Barber Paradise, les produits professionnels et une offre limitée.",
};

const defaultGenerator = {
  type: "social_post",
  topic: "Nouvelle routine barbe professionnelle",
  tone: "expert, direct et premium",
  prompt: "Créer un contenu prêt à publier pour BarberParadise.fr avec une promesse claire, un CTA et un style barbier professionnel.",
  campaignId: "",
};

function StatCard({ label, value, icon: Icon, hint }: { label: string; value: string | number; icon: typeof Megaphone; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-500">
        <Icon size={17} className="text-primary" />
        {label}
      </div>
      <div className="text-3xl font-bold text-gray-950">{value}</div>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function StatusBanner({ status }: { status: FormStatus }) {
  if (!status) return null;
  const classes = status.type === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : status.type === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-blue-200 bg-blue-50 text-blue-800";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${classes}`}>{status.message}</div>;
}

export default function AdminMarketingPage() {
  const [dashboard, setDashboard] = useState<MarketingDashboard | null>(null);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("generate");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<FormStatus>(null);
  const [campaignForm, setCampaignForm] = useState(defaultCampaign);
  const [generatorForm, setGeneratorForm] = useState(defaultGenerator);
  const [promoForm, setPromoForm] = useState({ code: "WELCOME10", label: "Bienvenue -10%", type: "percent", value: 10, minAmount: 49, maxUses: 200 });
  const [emailForm, setEmailForm] = useState({ name: "Newsletter Barber Paradise", subject: "Votre routine barbe professionnelle commence ici", previewText: "Une offre et des conseils sélectionnés par Barber Paradise.", senderName: "Barber Paradise", senderEmail: "contact@barberparadise.fr", listIds: "", htmlContent: "<h1>Barber Paradise</h1><p>Découvrez notre sélection professionnelle et profitez de votre avantage client.</p>" });

  const latestDraft = useMemo(() => dashboard?.recentContent?.[0] as MarketingContentDraft | undefined, [dashboard]);

  async function refresh() {
    setLoading(true);
    try {
      const [dashboardData, promoData] = await Promise.all([getMarketingDashboard(), getMarketingPromoCodes()]);
      setDashboard(dashboardData);
      setPromos(promoData.promoCodes);
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Erreur de chargement Marketing" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreateCampaign(event: FormEvent) {
    event.preventDefault();
    setBusy("campaign");
    setStatus(null);
    try {
      const { campaign } = await createMarketingCampaign(campaignForm);
      setGeneratorForm(prev => ({ ...prev, campaignId: campaign.id }));
      setStatus({ type: "success", message: `Campagne créée : ${campaign.name}.` });
      await refresh();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Création de campagne impossible" });
    } finally {
      setBusy(null);
    }
  }

  async function handleGenerate(event: FormEvent) {
    event.preventDefault();
    setBusy("generate");
    setStatus(null);
    try {
      const payload = { ...generatorForm, campaignId: generatorForm.campaignId || undefined };
      const { draft } = await generateMarketingContent(payload);
      setStatus({ type: "success", message: `Contenu généré : ${draft.title}.` });
      await refresh();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Génération impossible" });
    } finally {
      setBusy(null);
    }
  }

  async function handlePromo(event: FormEvent) {
    event.preventDefault();
    setBusy("promo");
    setStatus(null);
    try {
      await createMarketingPromoCode(promoForm);
      setStatus({ type: "success", message: `Code promo ${promoForm.code.toUpperCase()} créé.` });
      await refresh();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Création du code promo impossible" });
    } finally {
      setBusy(null);
    }
  }

  async function handleEmail(event: FormEvent) {
    event.preventDefault();
    setBusy("email");
    setStatus(null);
    try {
      const listIds = emailForm.listIds.split(",").map(value => Number(value.trim())).filter(Number.isFinite);
      const { emailCampaign } = await createMarketingEmailCampaign({ ...emailForm, listIds });
      setStatus({ type: "success", message: `Campagne email enregistrée : ${emailCampaign.subject}.` });
      await refresh();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Création email impossible" });
    } finally {
      setBusy(null);
    }
  }

  async function handleSendEmail(id: string) {
    setBusy(`send-${id}`);
    setStatus(null);
    try {
      await sendMarketingEmailCampaign(id);
      setStatus({ type: "success", message: "Campagne transmise à Brevo. Vérifier Brevo et Render si l’envoi réel est bloqué par la clé API." });
      await refresh();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Envoi Brevo impossible" });
    } finally {
      setBusy(null);
    }
  }

  async function handleSyncContacts() {
    setBusy("sync");
    setStatus(null);
    try {
      const result = await syncMarketingBrevoContacts();
      setStatus({ type: result.skipped ? "info" : "success", message: result.skipped ? (result.message || "Synchronisation Brevo ignorée.") : `${result.synced} contacts synchronisés avec Brevo.` });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Synchronisation Brevo impossible" });
    } finally {
      setBusy(null);
    }
  }

  async function handlePublishBlog(id: string) {
    setBusy(`blog-${id}`);
    setStatus(null);
    try {
      await publishMarketingBlogPost(id);
      setStatus({ type: "success", message: "Brouillon publié dans le blog public." });
      await refresh();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Publication blog impossible" });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-dark-900 via-gray-900 to-primary p-6 text-white shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
              <Sparkles size={14} /> Agent Marketing IA
            </div>
            <h1 className="font-heading text-3xl font-bold">Piloter les campagnes Barber Paradise</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
              Génération de contenus, codes promo, campagnes email et connexion Brevo sont centralisés ici. Sur Render, l’envoi réel nécessite la variable backend <code className="rounded bg-white/10 px-1">BREVO_API_KEY</code>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleSyncContacts} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100" disabled={busy === "sync"}>
              {busy === "sync" ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />} Synchroniser Brevo
            </button>
            <button onClick={refresh} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
              <RefreshCw size={16} /> Actualiser
            </button>
          </div>
        </div>
      </div>

      <StatusBanner status={status} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Campagnes" value={dashboard?.totals.campaigns || 0} icon={Megaphone} />
        <StatCard label="Codes actifs" value={dashboard?.totals.activePromos || 0} icon={Gift} />
        <StatCard label="Articles publiés" value={dashboard?.totals.publishedBlogPosts || 0} icon={BookOpen} />
        <StatCard label="Emails" value={dashboard?.totals.emailCampaigns || 0} icon={Mail} />
        <StatCard label="CA promo 30j" value={`${(dashboard?.revenue.last30Days || 0).toFixed(0)} €`} icon={BarChart3} hint={`${dashboard?.revenue.ordersWithPromoLast30Days || 0} commandes avec promo`} />
      </div>

      <div className={`rounded-2xl border p-4 ${dashboard?.brevo.configured ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex items-start gap-3">
          <CheckCircle2 className={dashboard?.brevo.configured ? "text-emerald-600" : "text-amber-600"} size={20} />
          <div>
            <p className="font-semibold text-gray-900">Statut Brevo : {dashboard?.brevo.status}</p>
            <p className="text-sm text-gray-600">{dashboard?.brevo.message}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ["generate", "Génération IA", PenLine],
          ["promos", "Promotions", Gift],
          ["email", "Email Brevo", Mail],
          ["blog", "Blog & contenus", BookOpen],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setActiveTab(key)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === key ? "bg-primary text-white shadow-sm" : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {activeTab === "generate" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <form onSubmit={handleCreateCampaign} className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-950">Créer une campagne</h2>
            {Object.entries(campaignForm).map(([key, value]) => (
              <label key={key} className="block text-sm font-medium text-gray-700">
                {key}
                <textarea value={String(value)} onChange={event => setCampaignForm(prev => ({ ...prev, [key]: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary" rows={key === "brief" ? 4 : 1} />
              </label>
            ))}
            <button className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white" disabled={busy === "campaign"}>
              {busy === "campaign" ? <Loader2 size={16} className="animate-spin" /> : <Megaphone size={16} />} Créer la campagne
            </button>
          </form>

          <form onSubmit={handleGenerate} className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-950">Générer un contenu IA</h2>
            <label className="block text-sm font-medium text-gray-700">Campagne
              <select value={generatorForm.campaignId} onChange={event => setGeneratorForm(prev => ({ ...prev, campaignId: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="">Sans campagne</option>
                {dashboard?.recentCampaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700">Type
              <select value={generatorForm.type} onChange={event => setGeneratorForm(prev => ({ ...prev, type: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="social_post">Post social</option>
                <option value="email">Email</option>
                <option value="blog_post">Article blog</option>
                <option value="product_push">Push produit</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700">Sujet
              <input value={generatorForm.topic} onChange={event => setGeneratorForm(prev => ({ ...prev, topic: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary" />
            </label>
            <label className="block text-sm font-medium text-gray-700">Ton
              <input value={generatorForm.tone} onChange={event => setGeneratorForm(prev => ({ ...prev, tone: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary" />
            </label>
            <label className="block text-sm font-medium text-gray-700">Brief IA
              <textarea value={generatorForm.prompt} onChange={event => setGeneratorForm(prev => ({ ...prev, prompt: event.target.value }))} rows={5} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary" />
            </label>
            <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white" disabled={busy === "generate"}>
              {busy === "generate" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Générer
            </button>
          </form>
        </div>
      )}

      {activeTab === "promos" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <form onSubmit={handlePromo} className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-950">Créer un code promo</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input value={promoForm.code} onChange={event => setPromoForm(prev => ({ ...prev, code: event.target.value }))} placeholder="Code" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              <input value={promoForm.label} onChange={event => setPromoForm(prev => ({ ...prev, label: event.target.value }))} placeholder="Libellé" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              <select value={promoForm.type} onChange={event => setPromoForm(prev => ({ ...prev, type: event.target.value }))} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                <option value="percent">Pourcentage</option>
                <option value="fixed">Montant fixe</option>
                <option value="free_shipping">Livraison offerte</option>
              </select>
              <input type="number" value={promoForm.value} onChange={event => setPromoForm(prev => ({ ...prev, value: Number(event.target.value) }))} placeholder="Valeur" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              <input type="number" value={promoForm.minAmount} onChange={event => setPromoForm(prev => ({ ...prev, minAmount: Number(event.target.value) }))} placeholder="Minimum" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              <input type="number" value={promoForm.maxUses} onChange={event => setPromoForm(prev => ({ ...prev, maxUses: Number(event.target.value) }))} placeholder="Utilisations max" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </div>
            <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white" disabled={busy === "promo"}>
              {busy === "promo" ? <Loader2 size={16} className="animate-spin" /> : <Gift size={16} />} Créer le code
            </button>
          </form>
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-gray-950">Codes récents</h2>
            <div className="space-y-3">
              {promos.slice(0, 8).map(promo => (
                <div key={promo.id} className="rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-sm font-bold text-gray-950">{promo.code}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">{promo.usedCount}/{promo.maxUses || "∞"}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{promo.label} — {promo.type} {promo.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "email" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <form onSubmit={handleEmail} className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-950">Créer une campagne email</h2>
            {Object.entries(emailForm).map(([key, value]) => (
              <label key={key} className="block text-sm font-medium text-gray-700">
                {key}
                <textarea value={String(value)} onChange={event => setEmailForm(prev => ({ ...prev, [key]: event.target.value }))} rows={key === "htmlContent" ? 7 : 1} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary" />
              </label>
            ))}
            <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white" disabled={busy === "email"}>
              {busy === "email" ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />} Enregistrer l’email
            </button>
          </form>
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-gray-950">Emails récents</h2>
            <div className="space-y-3">
              {dashboard?.recentEmails.map(email => (
                <div key={email.id} className="rounded-xl border border-gray-100 p-4">
                  <p className="font-semibold text-gray-950">{email.subject}</p>
                  <p className="text-sm text-gray-500">{email.status} · {email.senderEmail}</p>
                  <button onClick={() => handleSendEmail(email.id)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gray-950 px-3 py-2 text-xs font-semibold text-white" disabled={busy === `send-${email.id}`}>
                    {busy === `send-${email.id}` ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Envoyer via Brevo
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "blog" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-gray-950">Dernier brouillon généré</h2>
            {latestDraft ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">{latestDraft.type} · {latestDraft.status}</p>
                  <h3 className="mt-1 text-xl font-bold text-gray-950">{latestDraft.title}</h3>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{latestDraft.body}</p>
                <button onClick={() => handlePublishBlog(latestDraft.id)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white" disabled={busy === `blog-${latestDraft.id}`}>
                  {busy === `blog-${latestDraft.id}` ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />} Publier en article blog
                </button>
              </div>
            ) : <p className="text-sm text-gray-500">Aucun contenu généré pour le moment.</p>}
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-gray-950">Flux récent</h2>
            <div className="space-y-3">
              {dashboard?.recentContent.map(draft => (
                <div key={draft.id} className="rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-gray-950">{draft.title}</p>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">{draft.type}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-500">{draft.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
