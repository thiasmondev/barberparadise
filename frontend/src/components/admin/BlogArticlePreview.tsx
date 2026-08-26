import { CalendarDays, Clock, Eye, ShoppingBag, X } from "lucide-react";
import type { Product } from "@/types";
import { renderBlogMarkdown } from "@/lib/blog-markdown";

type PreviewArticle = {
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  tags: string[];
};

type BlogArticlePreviewProps = {
  article: PreviewArticle;
  products: Product[];
  onClose: () => void;
};

export default function BlogArticlePreview({ article, products, onClose }: BlogArticlePreviewProps) {
  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Prévisualisation de l’article">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl bg-[#131313] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#131313]/95 px-4 py-3 backdrop-blur sm:px-6">
          <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ff4a8d]">Prévisualisation brouillon</p><p className="text-xs text-white/60">Ce rendu n’enregistre ni ne publie l’article.</p></div>
          <button onClick={onClose} className="rounded-full border border-white/15 p-2 text-white hover:bg-white/10" aria-label="Fermer la prévisualisation"><X size={18} /></button>
        </div>
        <main className="min-h-screen bg-[#131313] text-[#e5e2e1]">
          <header className="relative overflow-hidden">
            <div className="relative min-h-[300px] aspect-[16/7] w-full sm:min-h-[400px]">
              {article.coverImage ? <img src={article.coverImage} alt={article.title} className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 bg-gradient-to-br from-[#0a0820] via-[#131313] to-[#0a0a0a]" />}
              <div className="absolute inset-0 bg-gradient-to-t from-[#131313] via-black/60 to-black/20" />
              <div className="absolute bottom-0 left-0 right-0 px-5 pb-8 sm:px-10 sm:pb-12">
                <div className="mb-4 inline-block bg-[#ff4a8d] px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] text-white">{article.category || "Conseils barbier"}</div>
                <h1 className="max-w-4xl text-3xl font-black uppercase italic leading-tight tracking-tighter text-white sm:text-4xl lg:text-6xl">{article.title || "Titre de l’article"}</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">{article.excerpt || "L’extrait de l’article apparaîtra ici."}</p>
                <div className="mt-5 flex flex-wrap items-center gap-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50"><span className="inline-flex items-center gap-1.5"><CalendarDays size={12} />À paraître</span><span className="inline-flex items-center gap-1.5"><Clock size={12} />Aperçu</span><span className="inline-flex items-center gap-1.5"><Eye size={12} />0 vues</span></div>
              </div>
            </div>
          </header>
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-8 lg:py-16">
            <article><div className="border border-white/5 bg-[#1c1b1b] p-6 sm:p-10 lg:p-12">{renderBlogMarkdown(article.content)}</div>{article.tags.length > 0 && <div className="mt-6 flex flex-wrap gap-2 border-t border-white/5 pt-6">{article.tags.map((tag) => <span key={tag} className="border border-white/10 bg-[#1c1b1b] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/50">#{tag}</span>)}</div>}</article>
            <aside className="space-y-6"><div className="border border-white/5 bg-[#1c1b1b] p-6"><p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#ff4a8d]">Conseil pro</p><h2 className="mt-3 text-xl font-black uppercase italic tracking-tight text-white">Besoin du bon matériel ?</h2><p className="mt-3 text-sm leading-7 text-white/50">Explorez le catalogue Barber Paradise pour trouver les produits adaptés à votre usage.</p><span className="mt-6 inline-flex items-center gap-2 bg-[#ff4a8d] px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white"><ShoppingBag size={14} /> Catalogue</span></div></aside>
          </div>
          {products.length > 0 && <section className="border-t border-white/5 px-4 py-14 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><p className="text-[9px] font-black uppercase tracking-[0.35em] text-[#ff4a8d]">Sélection associée</p><h2 className="mt-2 text-2xl font-black uppercase italic tracking-tighter text-white">Produits recommandés</h2><div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">{products.map((product) => <article key={product.id} className="overflow-hidden border border-white/10 bg-[#1c1b1b]"><div className="aspect-square bg-black/20">{product.images?.[0] ? <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-[#0a0820] to-[#1c1b1b]" />}</div><div className="p-3"><p className="line-clamp-2 text-xs font-black uppercase leading-snug text-white">{product.name}</p><p className="mt-2 text-sm font-bold text-[#ff4a8d]">{Number(product.price || 0).toFixed(2).replace(".", ",")} €</p></div></article>)}</div></div></section>}
        </main>
      </div>
    </div>
  );
}
