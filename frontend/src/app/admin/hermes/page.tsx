"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  BarChart3,
  Bot,
  Calendar,
  CheckCircle,
  Clock,
  Copy,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mail,
  Megaphone,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useHermesCampaigns } from "@/hooks/useHermesCampaigns";
import { useHermesChat } from "@/hooks/useHermesChat";
import { useHermesConversations } from "@/hooks/useHermesConversations";
import { useHermesDrafts } from "@/hooks/useHermesDrafts";
import { useHermesStats } from "@/hooks/useHermesStats";
import type { HermesCampaignPlan, HermesContentDraft } from "@/lib/admin-api";

const MODULES = [
  { id: null, label: "Workspace", description: "Stratégie, idées, analyses", icon: Sparkles },
  { id: "content", label: "Content", description: "Blog, SEO, réseaux sociaux", icon: MessageSquare },
  { id: "campaigns", label: "Campaigns", description: "Emails, offres et relances", icon: Mail },
  { id: "images", label: "Images", description: "Briefs visuels et concepts", icon: ImageIcon },
  { id: "analytics", label: "Analytics", description: "Lecture performance et KPIs", icon: BarChart3 },
];

const QUICK_PROMPTS = [
  "Propose 5 idées de contenus SEO pour augmenter les ventes de tondeuses professionnelles.",
  "Crée une campagne email B2B pour relancer les barbiers inactifs depuis 60 jours.",
  "Analyse les angles marketing pour vendre des soins barbe premium avant la fête des pères.",
  "Rédige un post Instagram éducatif sur l'entretien d'une tondeuse professionnelle.",
];

const DRAFT_TYPES = [
  { value: "", label: "Tous types" },
  { value: "blog", label: "Blog" },
  { value: "social_post", label: "Social" },
  { value: "email", label: "Email" },
  { value: "product_description", label: "Produit" },
];

const STATUSES = [
  { value: "", label: "Tous statuts" },
  { value: "draft", label: "Brouillon" },
  { value: "review", label: "À relire" },
  { value: "approved", label: "Approuvé" },
  { value: "published", label: "Publié" },
  { value: "rejected", label: "Rejeté" },
];

const CAMPAIGN_STATUSES = [
  { value: "", label: "Tous statuts" },
  { value: "draft", label: "Brouillon" },
  { value: "approved", label: "Approuvée" },
  { value: "scheduled", label: "Planifiée" },
  { value: "sent", label: "Envoyée" },
  { value: "rejected", label: "Rejetée" },
];

export default function HermesAdminPage() {
  const [input, setInput] = useState("");
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [usePro, setUsePro] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "drafts" | "campaigns">("chat");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const chat = useHermesChat();
  const conversations = useHermesConversations();
  const stats = useHermesStats();
  const drafts = useHermesDrafts();
  const campaigns = useHermesCampaigns();

  const selectedModuleLabel = useMemo(
    () => MODULES.find((module) => module.id === selectedModule)?.label || "Workspace",
    [selectedModule]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim()) return;
    const message = input;
    setInput("");
    await chat.sendMessage({ message, module: selectedModule, usePro });
    await Promise.all([conversations.refresh(), stats.refresh(), drafts.refresh(), campaigns.refresh()]);
  };

  const handleLoadConversation = async (id: string) => {
    const conversation = await conversations.loadConversation(id);
    chat.setConversationId(conversation.id);
    chat.replaceMessages(conversation.messages || []);
    setActiveTab("chat");
  };

  const startNewConversation = () => {
    conversations.setSelectedConversation(null);
    chat.resetConversation();
    setActiveTab("chat");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-primary/90 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-100">
              <Bot size={14} /> Hermes Agent Phase 2
            </div>
            <h1 className="mt-3 text-3xl font-heading font-bold">Workspace marketing IA</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-200">
              Assistant marketing Barber Paradise pour générer des contenus, préparer des campagnes Brevo,
              sauvegarder des brouillons éditoriaux et piloter les KPIs marketing en français.
            </p>
          </div>
          <button
            onClick={startNewConversation}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            <Plus size={16} /> Nouvelle conversation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Conversations" value={stats.stats?.totalConversations ?? 0} loading={stats.loading} />
        <StatCard label="Brouillons" value={drafts.drafts.length} loading={drafts.loading} />
        <StatCard label="Campagnes" value={campaigns.campaigns.length} loading={campaigns.loading} />
        <StatCard label="Temps moyen" value={`${stats.stats?.avgResponseTimeMs ?? 0} ms`} loading={stats.loading} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Modules</h2>
            <div className="mt-3 space-y-2">
              {MODULES.map((module) => {
                const Icon = module.icon;
                const active = module.id === selectedModule;
                return (
                  <button
                    key={module.label}
                    onClick={() => setSelectedModule(module.id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      active ? "border-primary bg-primary/10 text-primary" : "border-gray-200 hover:border-primary/50 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Icon size={16} /> {module.label}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{module.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Historique</h2>
              {conversations.loading && <Loader2 className="animate-spin text-gray-400" size={16} />}
            </div>
            {conversations.error && <p className="mt-2 text-xs text-red-600">{conversations.error}</p>}
            <div className="mt-3 max-h-[480px] space-y-2 overflow-y-auto pr-1">
              {conversations.conversations.length === 0 && !conversations.loading ? (
                <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">Aucune conversation active.</p>
              ) : (
                conversations.conversations.map((conversation) => (
                  <div key={conversation.id} className="rounded-xl border border-gray-200 p-3 hover:bg-gray-50">
                    <button onClick={() => handleLoadConversation(conversation.id)} className="w-full text-left">
                      <div className="line-clamp-1 text-sm font-semibold text-gray-900">
                        {conversation.title || "Conversation Hermes"}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                        <span>{conversation._count?.messages ?? conversation.messages?.length ?? 0} messages</span>
                        <span>{new Date(conversation.updatedAt).toLocaleDateString("fr-FR")}</span>
                      </div>
                    </button>
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        onClick={() => conversations.archiveConversation(conversation.id)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600"
                        title="Archiver"
                      >
                        <Archive size={14} />
                      </button>
                      <button
                        onClick={() => conversations.deleteConversation(conversation.id)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-heading font-bold text-gray-900">Hermes Marketing OS</h2>
                <p className="text-sm text-gray-500">Module actif : {selectedModuleLabel}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <TabButton active={activeTab === "chat"} onClick={() => setActiveTab("chat")} icon={MessageSquare} label="Chat" />
                <TabButton active={activeTab === "drafts"} onClick={() => setActiveTab("drafts")} icon={FileText} label="Content Drafts" />
                <TabButton active={activeTab === "campaigns"} onClick={() => setActiveTab("campaigns")} icon={Megaphone} label="Campaigns" />
              </div>
            </div>
          </div>

          {activeTab === "chat" && (
            <ChatPanel
              chat={chat}
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              usePro={usePro}
              setUsePro={setUsePro}
              bottomRef={bottomRef}
            />
          )}

          {activeTab === "drafts" && <DraftsPanel draftsHook={drafts} />}
          {activeTab === "campaigns" && <CampaignsPanel campaignsHook={campaigns} />}
        </section>
      </div>
    </div>
  );
}

function ChatPanel({ chat, input, setInput, handleSubmit, usePro, setUsePro, bottomRef }: any) {
  return (
    <>
      <div className="border-b border-gray-200 p-4">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm">
          <input type="checkbox" checked={usePro} onChange={(event) => setUsePro(event.target.checked)} />
          Mode Pro
        </label>
      </div>
      <div className="h-[560px] overflow-y-auto bg-gray-50 p-4">
        {chat.messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 rounded-2xl bg-primary/10 p-4 text-primary">
              <Sparkles size={32} />
            </div>
            <h3 className="text-xl font-heading font-bold text-gray-900">Comment puis-je aider Barber Paradise ?</h3>
            <p className="mt-2 max-w-xl text-sm text-gray-500">
              Demande un contenu encadré par [DRAFT:blog], une fiche produit, un email ou une stratégie de campagne.
            </p>
            <div className="mt-6 grid max-w-2xl grid-cols-1 gap-2 md:grid-cols-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setInput(prompt)}
                  className="rounded-xl border border-gray-200 bg-white p-3 text-left text-sm text-gray-700 shadow-sm hover:border-primary hover:text-primary"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {chat.messages.map((message: any) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[86%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === "user" ? "bg-primary text-white" : "border border-gray-200 bg-white text-gray-800"
                  }`}
                >
                  {message.content || (chat.isStreaming && message.role === "assistant" ? "Hermes réfléchit..." : "")}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4">
        {chat.error && <p className="mb-2 text-sm text-red-600">{chat.error}</p>}
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Demande à Hermes de créer, analyser ou optimiser..."
            className="min-h-[54px] flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            type="submit"
            disabled={chat.isStreaming || !input.trim()}
            className="inline-flex h-[54px] items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {chat.isStreaming ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            Envoyer
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Les blocs [DRAFT:blog], [DRAFT:social], [DRAFT:email] et [DRAFT:product] sont automatiquement sauvegardés.
        </p>
      </form>
    </>
  );
}

function DraftsPanel({ draftsHook }: { draftsHook: ReturnType<typeof useHermesDrafts> }) {
  const [preview, setPreview] = useState<HermesContentDraft | null>(null);

  return (
    <div className="space-y-4 bg-gray-50 p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <MiniStat label="Draft" value={draftsHook.stats?.byStatus?.draft ?? 0} />
        <MiniStat label="Approuvés" value={draftsHook.stats?.byStatus?.approved ?? 0} />
        <MiniStat label="Publiés 30j" value={draftsHook.stats?.publishedLast30Days ?? 0} />
        <MiniStat label="Total affiché" value={draftsHook.drafts.length} />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <select value={draftsHook.type} onChange={(event) => draftsHook.setType(event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
            {DRAFT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          <select value={draftsHook.status} onChange={(event) => draftsHook.setStatus(event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
            {STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
        </div>
        <button onClick={draftsHook.refresh} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">
          <RefreshCw size={16} /> Actualiser
        </button>
      </div>

      {draftsHook.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{draftsHook.error}</p>}
      {draftsHook.loading ? (
        <LoadingBlock />
      ) : draftsHook.drafts.length === 0 ? (
        <EmptyBlock text="Aucun brouillon Hermes ne correspond aux filtres." />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {draftsHook.drafts.map((draft) => (
            <article key={draft.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold uppercase text-primary">{draft.type}</span>
                  <h3 className="mt-2 line-clamp-2 font-heading text-lg font-bold text-gray-900">{draft.title}</h3>
                  <p className="mt-1 text-xs text-gray-500">{new Date(draft.createdAt).toLocaleString("fr-FR")}</p>
                </div>
                <StatusBadge status={draft.status} />
              </div>
              <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm text-gray-600">{draft.content}</p>
              {draft.seoMetaDescription && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">SEO : {draft.seoMetaDescription}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => setPreview(draft)} className="ActionButton"><Eye size={14} /> Prévisualiser</button>
                <button onClick={() => navigator.clipboard?.writeText(draft.content)} className="ActionButton"><Copy size={14} /> Copier</button>
                <button onClick={() => draftsHook.changeStatus(draft.id, "approved")} className="ActionButton"><CheckCircle size={14} /> Approuver</button>
                <button onClick={() => draftsHook.publish(draft.id)} className="ActionButton"><Send size={14} /> Publier</button>
                <button onClick={() => draftsHook.removeDraft(draft.id)} className="ActionDanger"><Trash2 size={14} /> Supprimer</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreview(null)}>
          <div className="max-h-[86vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-primary">{preview.type}</p>
                <h3 className="mt-1 text-2xl font-heading font-bold text-gray-900">{preview.title}</h3>
              </div>
              <button onClick={() => setPreview(null)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">Fermer</button>
            </div>
            <pre className="mt-5 whitespace-pre-wrap rounded-2xl bg-gray-50 p-4 text-sm leading-relaxed text-gray-800">{preview.content}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function CampaignsPanel({ campaignsHook }: { campaignsHook: ReturnType<typeof useHermesCampaigns> }) {
  const [form, setForm] = useState({ name: "", targetAudience: "b2c", subject: "", preheader: "", scheduledAt: "" });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await campaignsHook.createPlan({
      name: form.name,
      targetAudience: form.targetAudience,
      subject: form.subject,
      preheader: form.preheader || undefined,
      scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
      htmlContent: "<p>Contenu à enrichir depuis Hermes.</p>",
    });
    setForm({ name: "", targetAudience: "b2c", subject: "", preheader: "", scheduledAt: "" });
  };

  return (
    <div className="space-y-4 bg-gray-50 p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <MiniStat label="Draft" value={campaignsHook.stats?.byStatus?.draft ?? 0} />
        <MiniStat label="Approuvées" value={campaignsHook.stats?.byStatus?.approved ?? 0} />
        <MiniStat label="Planifiées" value={campaignsHook.stats?.byStatus?.scheduled ?? 0} />
        <MiniStat label="Brevo" value={campaignsHook.stats?.brevoConfigured ? "OK" : "À configurer"} />
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 lg:grid-cols-5">
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nom campagne" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" required />
        <select value={form.targetAudience} onChange={(event) => setForm({ ...form, targetAudience: event.target.value })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
          <option value="b2c">B2C</option>
          <option value="b2b">B2B</option>
          <option value="inactifs">Inactifs</option>
          <option value="all">Tous</option>
        </select>
        <input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Objet email" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" required />
        <input type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">Créer</button>
        <input value={form.preheader} onChange={(event) => setForm({ ...form, preheader: event.target.value })} placeholder="Preheader" className="rounded-xl border border-gray-200 px-3 py-2 text-sm lg:col-span-5" />
      </form>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <select value={campaignsHook.status} onChange={(event) => campaignsHook.setStatus(event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
            {CAMPAIGN_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
          <select value={campaignsHook.targetAudience} onChange={(event) => campaignsHook.setTargetAudience(event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
            <option value="">Toutes audiences</option>
            <option value="b2c">B2C</option>
            <option value="b2b">B2B</option>
            <option value="inactifs">Inactifs</option>
            <option value="all">Tous</option>
          </select>
        </div>
        <button onClick={campaignsHook.refresh} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">
          <RefreshCw size={16} /> Actualiser
        </button>
      </div>

      {campaignsHook.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{campaignsHook.error}</p>}
      {campaignsHook.loading ? (
        <LoadingBlock />
      ) : campaignsHook.campaigns.length === 0 ? (
        <EmptyBlock text="Aucune campagne Hermes ne correspond aux filtres." />
      ) : (
        <div className="space-y-3">
          {campaignsHook.campaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} campaignsHook={campaignsHook} />)}
        </div>
      )}
    </div>
  );
}

function CampaignCard({ campaign, campaignsHook }: { campaign: HermesCampaignPlan; campaignsHook: ReturnType<typeof useHermesCampaigns> }) {
  const [scheduleValue, setScheduleValue] = useState("");
  const openRate = campaign.metricsSent ? Math.round(((campaign.metricsOpened || 0) / campaign.metricsSent) * 100) : 0;
  const clickRate = campaign.metricsSent ? Math.round(((campaign.metricsClicked || 0) / campaign.metricsSent) * 100) : 0;

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={campaign.status} />
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-600">{campaign.targetAudience}</span>
            {campaign.brevoCampaignId && <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">Brevo #{campaign.brevoCampaignId}</span>}
          </div>
          <h3 className="mt-2 font-heading text-lg font-bold text-gray-900">{campaign.name}</h3>
          <p className="mt-1 text-sm font-medium text-gray-700">{campaign.subject}</p>
          {campaign.preheader && <p className="mt-1 text-sm text-gray-500">{campaign.preheader}</p>}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <Metric label="Envoyés" value={campaign.metricsSent ?? 0} />
          <Metric label="Ouverture" value={`${openRate}%`} />
          <Metric label="Clic" value={`${clickRate}%`} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => campaignsHook.approvePlan(campaign.id)} className="ActionButton"><CheckCircle size={14} /> Approuver Brevo</button>
        <button onClick={() => campaignsHook.sendNow(campaign.id)} className="ActionButton"><Send size={14} /> Envoyer</button>
        <button onClick={() => campaignsHook.syncStats(campaign.id)} className="ActionButton"><RefreshCw size={14} /> Stats</button>
        <button onClick={() => campaignsHook.removePlan(campaign.id)} className="ActionDanger"><Trash2 size={14} /> Supprimer</button>
      </div>

      <div className="mt-3 flex flex-col gap-2 rounded-xl bg-gray-50 p-3 md:flex-row md:items-center">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-600"><Calendar size={14} /> Planifier</div>
        <input type="datetime-local" value={scheduleValue} onChange={(event) => setScheduleValue(event.target.value)} className="rounded-lg border border-gray-200 px-2 py-1 text-sm" />
        <button
          onClick={() => scheduleValue && campaignsHook.schedulePlan(campaign.id, new Date(scheduleValue).toISOString())}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Confirmer
        </button>
        {campaign.scheduledAt && <span className="text-xs text-gray-500"><Clock size={12} className="inline" /> {new Date(campaign.scheduledAt).toLocaleString("fr-FR")}</span>}
      </div>
    </article>
  );
}

function StatCard({ label, value, loading }: { label: string; value: number | string; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <div className="mt-2 text-2xl font-heading font-bold text-gray-900">
        {loading ? <Loader2 className="animate-spin text-gray-400" size={22} /> : value}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-heading font-bold text-gray-900">{value}</p>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
        active ? "bg-primary text-white" : "border border-gray-200 bg-white text-gray-600 hover:border-primary hover:text-primary"
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    review: "bg-amber-100 text-amber-700",
    approved: "bg-emerald-100 text-emerald-700",
    published: "bg-blue-100 text-blue-700",
    scheduled: "bg-purple-100 text-purple-700",
    sent: "bg-slate-900 text-white",
    rejected: "bg-red-100 text-red-700",
  };
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${colors[status] || "bg-gray-100 text-gray-700"}`}>{status}</span>;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2">
      <p className="font-heading text-lg font-bold text-gray-900">{value}</p>
      <p className="text-gray-500">{label}</p>
    </div>
  );
}

function LoadingBlock() {
  return <div className="flex justify-center rounded-2xl bg-white p-8"><Loader2 className="animate-spin text-primary" size={24} /></div>;
}

function EmptyBlock({ text }: { text: string }) {
  return <p className="rounded-2xl bg-white p-6 text-center text-sm text-gray-500">{text}</p>;
}
