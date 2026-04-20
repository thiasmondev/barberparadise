"use client";

import { useState } from "react";
import {
  Globe,
  FileText,
  BookOpen,
  Download,
  Copy,
  Check,
  Loader2,
  Zap,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api";

interface LlmsTxtResult {
  content: string;
  wordCount: number;
  categoriesCount: number;
  productsCount: number;
}

interface GuideResult {
  title: string;
  content: string;
  wordCount: number;
  category: string;
}

interface GeoAuditResult {
  score: number;
  items: { label: string; status: "ok" | "warn" | "error"; detail: string }[];
}

export default function GeoToolsPage() {
  // llms.txt
  const [llmsLoading, setLlmsLoading] = useState(false);
  const [llmsResult, setLlmsResult] = useState<LlmsTxtResult | null>(null);
  const [llmsCopied, setLlmsCopied] = useState(false);
  const [llmsDeploying, setLlmsDeploying] = useState(false);
  const [llmsDeployed, setLlmsDeployed] = useState(false);

  // Guide d'achat
  const [guideCategory, setGuideCategory] = useState("tondeuses");
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideResult, setGuideResult] = useState<GuideResult | null>(null);
  const [guideCopied, setGuideCopied] = useState(false);

  // Audit GEO
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<GeoAuditResult | null>(null);

  // Générer llms.txt
  const handleGenerateLlms = async () => {
    setLlmsLoading(true);
    setLlmsResult(null);
    setLlmsDeployed(false);
    try {
      const data = await adminFetch<LlmsTxtResult>("/api/admin/seo/generate-llms-txt", { method: "POST" });
      setLlmsResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLlmsLoading(false);
    }
  };

  // Déployer llms.txt (sauvegarder en base pour être servi par le backend)
  const handleDeployLlms = async () => {
    if (!llmsResult) return;
    setLlmsDeploying(true);
    try {
      await adminFetch("/api/admin/seo/deploy-llms-txt", {
        method: "POST",
        body: JSON.stringify({ content: llmsResult.content }),
      });
      setLlmsDeployed(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLlmsDeploying(false);
    }
  };

  const handleCopyLlms = () => {
    if (!llmsResult) return;
    navigator.clipboard.writeText(llmsResult.content);
    setLlmsCopied(true);
    setTimeout(() => setLlmsCopied(false), 2000);
  };

  // Générer guide d'achat
  const handleGenerateGuide = async () => {
    setGuideLoading(true);
    setGuideResult(null);
    try {
      const data = await adminFetch<GuideResult>("/api/admin/seo/generate-buying-guide", {
        method: "POST",
        body: JSON.stringify({ category: guideCategory }),
      });
      setGuideResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setGuideLoading(false);
    }
  };

  const handleCopyGuide = () => {
    if (!guideResult) return;
    navigator.clipboard.writeText(guideResult.content);
    setGuideCopied(true);
    setTimeout(() => setGuideCopied(false), 2000);
  };

  // Audit GEO
  const handleAudit = async () => {
    setAuditLoading(true);
    setAuditResult(null);
    try {
      const data = await adminFetch<GeoAuditResult>("/api/admin/seo/geo-audit");
      setAuditResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setAuditLoading(false);
    }
  };

  const categories = [
    "tondeuses", "rasoirs", "ciseaux", "peignes", "brosses",
    "capes-de-coupe", "produits-coiffants", "soins-barbe",
    "accessoires", "materiel-professionnel",
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Globe size={28} />
          <h1 className="text-2xl font-bold">Outils GEO</h1>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Generative Engine Optimization</span>
        </div>
        <p className="text-emerald-100 text-sm leading-relaxed">
          Optimisez Barber Paradise pour être cité par <strong>ChatGPT, Claude, Perplexity et Gemini</strong>.
          Ces outils génèrent les fichiers et contenus nécessaires pour que les IA vous recommandent automatiquement.
        </p>
      </div>

      {/* Audit GEO global */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={20} className="text-violet-500" />
            <h2 className="font-bold text-gray-900">Audit GEO du site</h2>
          </div>
          <button
            onClick={handleAudit}
            disabled={auditLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
          >
            {auditLoading ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
            {auditLoading ? "Analyse en cours..." : "Lancer l'audit"}
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Analyse l'état GEO global du site : présence du Schema.org, fichier llms.txt, FAQ produits, qualité des descriptions, etc.
        </p>
        {auditResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className={`text-3xl font-black ${auditResult.score >= 80 ? "text-emerald-600" : auditResult.score >= 60 ? "text-blue-600" : auditResult.score >= 40 ? "text-amber-600" : "text-red-600"}`}>
                {auditResult.score}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Score GEO global</p>
                <p className="text-xs text-gray-500">
                  {auditResult.score >= 80 ? "Excellent — vous êtes bien positionné pour les IA" :
                   auditResult.score >= 60 ? "Bon — quelques améliorations à apporter" :
                   auditResult.score >= 40 ? "Moyen — des actions prioritaires sont nécessaires" :
                   "Faible — commencez par les actions ci-dessous"}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {auditResult.items.map((item, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${
                  item.status === "ok" ? "bg-emerald-50 border-emerald-200" :
                  item.status === "warn" ? "bg-amber-50 border-amber-200" :
                  "bg-red-50 border-red-200"
                }`}>
                  <div className={`mt-0.5 ${item.status === "ok" ? "text-emerald-500" : item.status === "warn" ? "text-amber-500" : "text-red-500"}`}>
                    {item.status === "ok" ? <Check size={14} /> : <AlertCircle size={14} />}
                  </div>
                  <div>
                    <p className={`text-xs font-semibold ${
                      item.status === "ok" ? "text-emerald-800" :
                      item.status === "warn" ? "text-amber-800" : "text-red-800"
                    }`}>{item.label}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Générateur llms.txt */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText size={20} className="text-blue-500" />
          <h2 className="font-bold text-gray-900">Générateur llms.txt</h2>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Standard 2025</span>
        </div>
        <p className="text-sm text-gray-500 mb-4 leading-relaxed">
          Le fichier <code className="bg-gray-100 px-1 rounded text-xs">llms.txt</code> est le nouveau standard pour guider les IA vers votre contenu.
          Comme le <code className="bg-gray-100 px-1 rounded text-xs">robots.txt</code> mais pour ChatGPT, Claude et Perplexity.
          Plus de <strong>844 000 sites</strong> l'ont déjà adopté.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleGenerateLlms}
            disabled={llmsLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {llmsLoading ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
            {llmsLoading ? "Génération en cours..." : llmsResult ? "Régénérer" : "Générer llms.txt"}
          </button>
          {llmsResult && (
            <a
              href="https://barberparadise.vercel.app/llms.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <ExternalLink size={12} /> Voir en ligne
            </a>
          )}
        </div>

        {llmsResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              <span>📦 <strong>{llmsResult.productsCount}</strong> produits référencés</span>
              <span>📁 <strong>{llmsResult.categoriesCount}</strong> catégories</span>
              <span>📝 <strong>{llmsResult.wordCount}</strong> mots</span>
            </div>
            <div className="relative">
              <textarea
                value={llmsResult.content}
                onChange={(e) => setLlmsResult({ ...llmsResult, content: e.target.value })}
                rows={16}
                className="w-full font-mono text-xs text-gray-800 bg-gray-900 text-green-400 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLlms}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50"
              >
                {llmsCopied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                {llmsCopied ? "Copié !" : "Copier"}
              </button>
              <button
                onClick={handleDeployLlms}
                disabled={llmsDeploying || llmsDeployed}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {llmsDeploying ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                {llmsDeployed ? "Déployé sur /llms.txt ✓" : "Déployer sur le site"}
              </button>
            </div>
            {llmsDeployed && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-700 text-xs flex items-center gap-2">
                <Check size={13} />
                Le fichier est accessible sur{" "}
                <a href="https://barberparadise.vercel.app/llms.txt" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                  barberparadise.vercel.app/llms.txt
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Générateur de guide d'achat */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen size={20} className="text-orange-500" />
          <h2 className="font-bold text-gray-900">Générateur de guide d&apos;achat IA</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4 leading-relaxed">
          Les IA citent massivement les guides d&apos;achat informationnels. Ce générateur crée un article
          complet &quot;Guide d&apos;achat [catégorie] 2026&quot; optimisé pour être cité par ChatGPT et Claude
          quand un barbier demande des conseils.
        </p>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <select
            value={guideCategory}
            onChange={(e) => setGuideCategory(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-300"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
              </option>
            ))}
          </select>
          <button
            onClick={handleGenerateGuide}
            disabled={guideLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
          >
            {guideLoading ? <Loader2 size={15} className="animate-spin" /> : <BookOpen size={15} />}
            {guideLoading ? "Génération en cours (~30s)..." : guideResult ? "Régénérer" : "Générer le guide"}
          </button>
        </div>

        {guideResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              <span>📝 <strong>{guideResult.wordCount}</strong> mots</span>
              <span>📁 Catégorie : <strong>{guideResult.category}</strong></span>
            </div>
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <h3 className="font-bold text-gray-900 text-base mb-3">{guideResult.title}</h3>
              <div
                className="prose prose-sm max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: guideResult.content }}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyGuide}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50"
              >
                {guideCopied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                {guideCopied ? "Copié !" : "Copier le HTML"}
              </button>
              <span className="text-xs text-gray-400">Publiez ce guide dans votre blog pour maximiser les citations IA</span>
            </div>
          </div>
        )}
      </div>

      {/* Checklist GEO */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw size={20} className="text-gray-500" />
          <h2 className="font-bold text-gray-900">Checklist GEO — Actions prioritaires</h2>
        </div>
        <div className="space-y-2">
          {[
            { action: "Générer et déployer le fichier llms.txt", priority: "haute", tool: "Outil ci-dessus" },
            { action: "Optimiser les 10 produits les plus vendus avec l'onglet GEO de l'agent SEO", priority: "haute", tool: "Agent SEO → onglet GEO" },
            { action: "Générer les guides d'achat pour les 3 catégories principales", priority: "haute", tool: "Outil ci-dessus" },
            { action: "Vérifier que le Schema.org JSON-LD est injecté sur toutes les fiches produit", priority: "moyenne", tool: "Agent SEO → onglet GEO → Appliquer" },
            { action: "Ajouter 5 FAQ par produit phare", priority: "moyenne", tool: "Agent SEO → onglet GEO → FAQ" },
            { action: "S'assurer que les 150 premiers mots de chaque description répondent directement à une question", priority: "moyenne", tool: "Agent SEO → onglet GEO → Introduction" },
            { action: "Obtenir des mentions sur des forums barber (Reddit, forums pro)", priority: "basse", tool: "Action manuelle" },
            { action: "Créer une page 'À propos' détaillée avec l'histoire de Barber Paradise", priority: "basse", tool: "Action manuelle" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
              <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                item.priority === "haute" ? "bg-red-500" :
                item.priority === "moyenne" ? "bg-amber-500" : "bg-gray-400"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">{item.action}</p>
                <p className="text-xs text-gray-400 mt-0.5">→ {item.tool}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                item.priority === "haute" ? "bg-red-100 text-red-700" :
                item.priority === "moyenne" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
              }`}>
                {item.priority}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
