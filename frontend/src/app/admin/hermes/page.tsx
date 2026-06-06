"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  BarChart3,
  Bot,
  Image as ImageIcon,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useHermesChat } from "@/hooks/useHermesChat";
import { useHermesConversations } from "@/hooks/useHermesConversations";
import { useHermesStats } from "@/hooks/useHermesStats";

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

export default function HermesAdminPage() {
  const [input, setInput] = useState("");
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [usePro, setUsePro] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const chat = useHermesChat();
  const conversations = useHermesConversations();
  const stats = useHermesStats();

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
    await conversations.refresh();
    await stats.refresh();
  };

  const handleLoadConversation = async (id: string) => {
    const conversation = await conversations.loadConversation(id);
    chat.setConversationId(conversation.id);
    chat.replaceMessages(conversation.messages || []);
  };

  const startNewConversation = () => {
    conversations.setSelectedConversation(null);
    chat.resetConversation();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-primary/90 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-100">
              <Bot size={14} /> Hermes Agent
            </div>
            <h1 className="mt-3 text-3xl font-heading font-bold">Workspace marketing IA</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-200">
              Assistant marketing Barber Paradise pour générer des contenus, préparer des campagnes,
              rédiger des briefs et structurer des analyses commerciales en français.
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
        <StatCard label="Actives" value={stats.stats?.activeConversations ?? 0} loading={stats.loading} />
        <StatCard label="Messages 30j" value={stats.stats?.last30DaysMessages ?? 0} loading={stats.loading} />
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
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-heading font-bold text-gray-900">Chat Hermes</h2>
                <p className="text-sm text-gray-500">Module actif : {selectedModuleLabel}</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm">
                <input type="checkbox" checked={usePro} onChange={(event) => setUsePro(event.target.checked)} />
                Mode Pro
              </label>
            </div>
          </div>

          <div className="h-[560px] overflow-y-auto bg-gray-50 p-4">
            {chat.messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 rounded-2xl bg-primary/10 p-4 text-primary">
                  <Sparkles size={32} />
                </div>
                <h3 className="text-xl font-heading font-bold text-gray-900">Comment puis-je aider Barber Paradise ?</h3>
                <p className="mt-2 max-w-xl text-sm text-gray-500">
                  Lance une idée de campagne, demande une fiche produit, un plan SEO, un script social ou une analyse marketing.
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
                {chat.messages.map((message) => (
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
              Les réponses sont sauvegardées dans l’historique Hermes. Configure `DEEPSEEK_API_KEY` côté backend pour activer la génération réelle.
            </p>
          </form>
        </section>
      </div>
    </div>
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
