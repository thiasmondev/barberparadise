"use client";

import { useState } from "react";
import Link from "next/link";
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
  BarChart2,
  Shield,
  Mic,
  Search,
  ArrowRight,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";
import {
  adminFetch,
  runGeoAudit,
  generateLlmsTxt,
  deployLlmsTxt,
  generateBuyingGuide,
  type GeoAuditResult,
} from "@/lib/admin-api";

export default function GeoToolsPage() {
  // llms.txt
  const [llmsLoading, setLlmsLoading] = useState(false);
  const [llmsContent, setLlmsContent] = useState("");
  const [llmsCopied, setLlmsCopied] = useState(false);
  const [llmsDeploying, setLlmsDeploying] = useState(false);
  const [llmsDeployed, setLlmsDeployed] = useState(false);
  const [llmsError, setLlmsError] = useState("");

  // Guide d'achat
  const [guideCategory, setGuideCategory] = useState("tondeuses");
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideResult, setGuideResult] = useState<{ title: string; content: string; slug: string; excerpt: string; tags: string[]; readTime: number } | null>(null);
  const [guideCopied, setGuideCopied] = useState(false);
  const [guideError, setGuideError] = useState("");

  // Audit GEO
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<GeoAuditResult | null>(null);
  const [auditError, setAuditError] = useState("");

  // Générer llms.txt
  const handleGenerateLlms = async () => {
    setLlmsLoading(true);
    setLlmsError("");
    setLlmsDeployed(false);
    try {
      const data = await generateLlmsTxt();
      setLlmsContent(data.content);
    } catch (e: any) {
      setLlmsError(e.message || "Erreur lors de la génération");
    } finally {
      setLlmsLoading(false);
    }
  };

  const handleDeployLlms = async () => {
    if (!llmsContent) return;
    setLlmsDeploying(true);
    try {
      await deployLlmsTxt(llmsContent);
      setLlmsDeployed(true);
    } catch (e: any) {
      setLlmsError(e.message || "Erreur lors du déploiement");
    } finally {
      setLlmsDeploying(false);
    }
  };

  const handleCopyLlms = () => {
    navigator.clipboard.writeText(llmsContent);
    setLlmsCopied(true);
    setTimeout(() => setLlmsCopied(false), 2000);
  };

  // Générer guide d'achat
  const handleGenerateGuide = async () => {
    setGuideLoading(true);
    setGuideResult(null);
    setGuideError("");
    try {
      const data = await generateBuyingGuide(guideCategory);
      setGuideResult(data);
    } catch (e: any) {
      setGuideError(e.message || "Erreur lors de la génération");
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
    setAuditError("");
    try {
      const data = await runGeoAudit();
      setAuditResult(data);
    } catch (e: any) {
      setAuditError(e.message || "Erreur lors de l'audit");
    } finally {
      setAuditLoading(false);
    }
  };

  const categories = [
    "tondeuses", "rasoirs", "ciseaux", "peignes", "brosses",
    "capes-de-coupe", "produits-coiffants", "soins-barbe",
    "accessoires", "materiel-professionnel",
  ];

  const statusIcon = (status: "ok" | "warning" | "error") => {
    if (status === "ok") return <CheckCircle size={15} className="text-emerald-500 shrink-0" />;
    if (status === "warning") return <AlertCircle size={15} className="text-amber-500 shrink-0" />;
    return <XCircle size={15} className="text-red-500 shrink-0" />;
  };

  const statusBg = (status: "ok" | "warning" | "error") => {
    if (status === "ok") return "bg-emerald-50 border-emerald-200";
    if (status === "warning") return "bg-amber-50 border-amber-200";
    return "bg-red-50 border-red-200";
  };

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
        <div className="flex flex-wrap gap-3 mt-4">
          {[
            { icon: <Shield size={13} />, label: "Schema.org" },
            { icon: <Mic size={13} />, label: "Snippets vocaux" },
            { icon: <Search size={13} />, label: "Longue traîne" },
            { icon: <BarChart2 size={13} />, label: "Comparatifs" },
            { icon: <FileText size={13} />, label: "llms.txt" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1 text-xs text-white">
              {item.icon} {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Audit GEO global — enrichi */}
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
            {auditLoading ? "Analyse en cours..." : auditResult ? "Relancer" : "Lancer l'audit"}
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Analyse l'état GEO complet du site : Schema.org, FAQ, introductions directes, snippets vocaux, llms.txt.
        </p>

        {auditError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm mb-4 flex items-center gap-2">
            <AlertCircle size={15} /> {auditError}
          </div>
        )}

        {auditResult && (
          <div className="space-y-4">
            {/* Score global + stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <div className={`text-4xl font-black mb-1 ${
                  auditResult.globalScore >= 80 ? "text-emerald-600" :
                  auditResult.globalScore >= 60 ? "text-blue-600" :
                  auditResult.globalScore >= 40 ? "text-amber-600" : "text-red-600"
                }`}>{auditResult.globalScore}</div>
                <p className="text-xs text-gray-500 font-medium">Score GEO global</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-emerald-700 mb-1">{auditResult.productsWithSchema}</div>
                <p className="text-xs text-gray-500">Produits avec Schema.org</p>
                <p className="text-xs text-gray-400">/ {auditResult.totalProducts}</p>
              </div>
              <div className="bg-violet-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-violet-700 mb-1">{auditResult.productsWithFaq}</div>
                <p className="text-xs text-gray-500">Produits avec FAQ</p>
                <p className="text-xs text-gray-400">/ {auditResult.totalProducts}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-700 mb-1">{auditResult.productsWithDirectAnswer}</div>
                <p className="text-xs text-gray-500">Introductions directes</p>
                <p className="text-xs text-gray-400">/ {auditResult.totalProducts}</p>
              </div>
              <div className="bg-teal-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-teal-700 mb-1">{auditResult.productsWithVoiceSnippet}</div>
                <p className="text-xs text-gray-500">Snippets vocaux</p>
                <p className="text-xs text-gray-400">/ {auditResult.totalProducts}</p>
              </div>
              <div className={`rounded-xl p-4 text-center ${auditResult.llmsTxtExists ? "bg-emerald-50" : "bg-red-50"}`}>
                <div className={`text-2xl font-bold mb-1 ${auditResult.llmsTxtExists ? "text-emerald-700" : "text-red-600"}`}>
                  {auditResult.llmsTxtExists ? "✓" : "✗"}
                </div>
                <p className="text-xs text-gray-500">llms.txt déployé</p>
              </div>
            </div>

            {/* Checks détaillés */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Vérifications détaillées</p>
              {auditResult.checks.map((check) => (
                <div key={check.id} className={`flex items-start gap-3 p-3 rounded-lg border ${statusBg(check.status)}`}>
                  {statusIcon(check.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold text-gray-800">{check.label}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        check.priority === "haute" ? "bg-red-100 text-red-700" :
                        check.priority === "moyenne" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                      }`}>{check.priority}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{check.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Top opportunités */}
            {auditResult.topOpportunities.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Top {auditResult.topOpportunities.length} produits prioritaires à optimiser
                </p>
                <div className="space-y-1.5">
                  {auditResult.topOpportunities.map((opp) => (
                    <div key={opp.productId} className="flex items-center gap-3 p-2.5 border border-gray-100 rounded-lg hover:bg-gray-50">
                      <div className={`text-sm font-bold w-8 text-center rounded-lg py-0.5 ${
                        opp.geoScore >= 60 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50"
                      }`}>{opp.geoScore}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{opp.productName}</p>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {opp.missingElements.map((el) => (
                            <span key={el} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">manque : {el}</span>
                          ))}
                        </div>
                      </div>
                      <Link
                        href={`/admin/seo/produit?id=${opp.productId}`}
                        className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 shrink-0"
                      >
                        Optimiser <ArrowRight size={11} />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
          Plus de <strong>844 000 sites</strong> l&apos;ont déjà adopté.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleGenerateLlms}
            disabled={llmsLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {llmsLoading ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
            {llmsLoading ? "Génération en cours..." : llmsContent ? "Régénérer" : "Générer llms.txt"}
          </button>
          {llmsContent && (
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

        {llmsError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm mb-3 flex items-center gap-2">
            <AlertCircle size={15} /> {llmsError}
          </div>
        )}

        {llmsContent && (
          <div className="space-y-3">
            <div className="relative">
              <textarea
                value={llmsContent}
                onChange={(e) => setLlmsContent(e.target.value)}
                rows={16}
                className="w-full font-mono text-xs text-green-400 bg-gray-900 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
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
                {llmsDeployed ? "Déployé ✓" : "Déployer sur /llms.txt"}
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

        {guideError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm mb-3 flex items-center gap-2">
            <AlertCircle size={15} /> {guideError}
          </div>
        )}

        {guideResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-3 flex-wrap">
              <span>⏱ <strong>{guideResult.readTime} min</strong> de lecture</span>
              <span>🏷 {guideResult.tags.slice(0, 4).join(", ")}</span>
              <span className="text-gray-400 font-mono text-xs">/blog/{guideResult.slug}</span>
            </div>
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 max-h-96 overflow-y-auto">
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

      {/* Checklist GEO enrichie */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw size={20} className="text-gray-500" />
          <h2 className="font-bold text-gray-900">Checklist GEO — Actions prioritaires</h2>
        </div>
        <div className="space-y-2">
          {[
            { action: "Générer et déployer le fichier llms.txt", priority: "haute", tool: "Outil ci-dessus", icon: <FileText size={13} /> },
            { action: "Lancer l'audit GEO pour identifier les produits prioritaires", priority: "haute", tool: "Outil ci-dessus", icon: <TrendingUp size={13} /> },
            { action: "Optimiser les 10 produits les plus vendus — onglet GEO Base (Schema + FAQ)", priority: "haute", tool: "Agent SEO → GEO Base", icon: <Globe size={13} /> },
            { action: "Générer le GEO Enrichi pour les produits phares (snippet vocal + E-E-A-T)", priority: "haute", tool: "Agent SEO → GEO Enrichi", icon: <Zap size={13} /> },
            { action: "Générer les guides d'achat pour les 3 catégories principales", priority: "haute", tool: "Outil ci-dessus", icon: <BookOpen size={13} /> },
            { action: "Ajouter les questions longue traîne pour les produits phares", priority: "moyenne", tool: "Agent SEO → GEO Enrichi → Longue traîne", icon: <Search size={13} /> },
            { action: "Vérifier que le Schema.org JSON-LD est injecté sur toutes les fiches produit", priority: "moyenne", tool: "Agent SEO → GEO Base → Appliquer", icon: <Shield size={13} /> },
            { action: "Compléter le contenu E-E-A-T pour renforcer la crédibilité", priority: "moyenne", tool: "Agent SEO → GEO Enrichi → E-E-A-T", icon: <Shield size={13} /> },
            { action: "Obtenir des mentions sur des forums barber (Reddit, forums pro)", priority: "basse", tool: "Action manuelle", icon: <Info size={13} /> },
            { action: "Créer une page 'À propos' détaillée avec l'histoire de Barber Paradise", priority: "basse", tool: "Action manuelle", icon: <Info size={13} /> },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
              <div className={`mt-0.5 p-1 rounded-md flex-shrink-0 ${
                item.priority === "haute" ? "bg-red-100 text-red-600" :
                item.priority === "moyenne" ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-500"
              }`}>{item.icon}</div>
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
