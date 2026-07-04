import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, Eye, ChevronRight, ShoppingBag } from "lucide-react";
import { getBlogArticle, type BlogArticle } from "@/lib/api";
import ProductCard from "@/components/ProductCard";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://barberparadise.fr";

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
};

function formatDate(value?: string | null) {
  if (!value) return "À paraître";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function renderMarkdown(content: string) {
  const lines = content.split("\n");
  const blocks: JSX.Element[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    if (text) blocks.push(
      <p key={`p-${blocks.length}`} className="my-6 text-base leading-9 text-white/70">
        {text}
      </p>
    );
    paragraph = [];
  };

  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-6 space-y-3 pl-6 text-base leading-8 text-white/70">
        {list.map((item, index) => (
          <li key={index} className="relative pl-4 before:absolute before:left-0 before:top-3 before:h-1 before:w-1 before:bg-[#ff4a8d]">
            {item}
          </li>
        ))}
      </ul>
    );
    list = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }
    if (trimmed.startsWith("### ")) {
      flushParagraph();
      flushList();
      blocks.push(
        <h3 key={`h3-${blocks.length}`} className="mb-4 mt-10 text-xl font-black uppercase italic tracking-tight text-white">
          <span className="text-[#ff4a8d]">—</span> {trimmed.replace(/^###\s+/, "")}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push(
        <h2 key={`h2-${blocks.length}`} className="mb-5 mt-12 text-2xl font-black uppercase italic tracking-tighter text-white border-l-2 border-[#ff4a8d] pl-4">
          {trimmed.replace(/^##\s+/, "")}
        </h2>
      );
      return;
    }
    if (trimmed.startsWith("# ")) {
      flushParagraph();
      flushList();
      return;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      list.push(trimmed.replace(/^[-*]\s+/, ""));
      return;
    }
    paragraph.push(trimmed.replace(/\*\*/g, ""));
  });

  flushParagraph();
  flushList();
  return blocks;
}

function ArticleJsonLd({ article }: { article: BlogArticle }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.seoMetaDescription || article.excerpt,
    image: article.coverImage ? [article.coverImage] : undefined,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: { "@type": "Organization", name: "Barber Paradise" },
    publisher: { "@type": "Organization", name: "Barber Paradise", url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/blog/${article.slug}`,
    keywords: article.seoKeywords?.join(", "),
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { article } = await getBlogArticle(slug);
    return {
      title: article.seoMetaTitle || `${article.title} | Barber Paradise`,
      description: article.seoMetaDescription || article.excerpt,
      keywords: article.seoKeywords,
      alternates: { canonical: `/blog/${article.slug}` },
      openGraph: {
        title: article.seoMetaTitle || article.title,
        description: article.seoMetaDescription || article.excerpt,
        type: "article",
        publishedTime: article.publishedAt || undefined,
        modifiedTime: article.updatedAt,
        images: article.coverImage ? [{ url: article.coverImage, alt: article.title }] : undefined,
      },
    };
  } catch {
    return { title: "Article introuvable | Barber Paradise" };
  }
}

export default async function BlogArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  let data: Awaited<ReturnType<typeof getBlogArticle>>;
  try {
    data = await getBlogArticle(slug);
  } catch {
    notFound();
  }

  const { article, linkedProducts, relatedArticles } = data;

  return (
    <main className="bg-[#131313] text-[#e5e2e1] min-h-screen">
      <ArticleJsonLd article={article} />

      {/* ── HEADER ARTICLE : image pleine largeur avec titre en overlay ── */}
      <header className="relative overflow-hidden">
        {/* Image de couverture */}
        <div className="relative aspect-[16/7] w-full min-h-[320px] sm:min-h-[420px] lg:min-h-[520px]">
          {article.coverImage ? (
            <Image
              src={article.coverImage}
              alt={article.title}
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a0820] via-[#131313] to-[#0a0a0a]" />
          )}
          {/* Dégradé sombre pour lisibilité overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#131313] via-black/60 to-black/20" />

          {/* Fil d'Ariane */}
          <nav className="absolute left-4 top-6 sm:left-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/50" aria-label="Fil d'Ariane">
            <Link href="/" className="transition-colors hover:text-[#ff4a8d]">Accueil</Link>
            <ChevronRight size={10} className="text-white/30" />
            <Link href="/blog" className="transition-colors hover:text-[#ff4a8d]">Magazine</Link>
            <ChevronRight size={10} className="text-white/30" />
            <span className="text-white/30 line-clamp-1 max-w-[120px] sm:max-w-xs">{article.title}</span>
          </nav>

          {/* Contenu overlay */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-8 sm:px-8 sm:pb-12 lg:px-16 lg:pb-14">
            {/* Badge catégorie */}
            <div className="mb-4 inline-block bg-[#ff4a8d] px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] text-white">
              {article.category}
            </div>
            <h1 className="max-w-4xl text-3xl font-black uppercase italic leading-tight tracking-tighter text-white sm:text-4xl lg:text-6xl">
              {article.title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">{article.excerpt}</p>
            <div className="mt-5 flex flex-wrap items-center gap-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={12} />{formatDate(article.publishedAt)}</span>
              <span className="inline-flex items-center gap-1.5"><Clock size={12} />{article.readTime} min de lecture</span>
              <span className="inline-flex items-center gap-1.5"><Eye size={12} />{article.viewCount} vues</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── CORPS DE L'ARTICLE ── */}
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-8 lg:py-16">
        {/* Contenu principal */}
        <article>
          <div className="border border-white/5 bg-[#1c1b1b] p-6 sm:p-10 lg:p-12">
            {renderMarkdown(article.content)}
          </div>

          {/* Tags */}
          {article.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2 border-t border-white/5 pt-6">
              {article.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/blog?tag=${encodeURIComponent(tag)}`}
                  className="border border-white/10 bg-[#1c1b1b] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/50 transition-colors hover:border-[#ff4a8d]/50 hover:text-[#ff4a8d]"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}
        </article>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* CTA catalogue */}
          <div className="border border-white/5 bg-[#1c1b1b] p-6">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#ff4a8d]">Conseil pro</p>
            <h2 className="mt-3 text-xl font-black uppercase italic tracking-tight text-white">Besoin du bon matériel ?</h2>
            <p className="mt-3 text-sm leading-7 text-white/50">
              Explorez le catalogue Barber Paradise pour trouver des tondeuses, soins, accessoires et consommables adaptés à votre usage.
            </p>
            <Link
              href="/catalogue"
              className="mt-6 inline-flex items-center gap-2 bg-[#ff4a8d] px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-colors hover:bg-[#ff1f70]"
            >
              <ShoppingBag size={14} /> Catalogue
            </Link>
          </div>

          {/* Articles liés */}
          {relatedArticles.length > 0 && (
            <div className="border border-white/5 bg-[#1c1b1b] p-6">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ff4a8d]">À lire aussi</h2>
              <div className="mt-5 space-y-0 divide-y divide-white/5">
                {relatedArticles.map((related) => (
                  <Link
                    key={related.id}
                    href={`/blog/${related.slug}`}
                    className="group block py-5 first:pt-0 last:pb-0"
                  >
                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#ff4a8d]">{related.category}</p>
                    <h3 className="mt-2 text-sm font-black uppercase italic leading-snug tracking-tight text-white transition-colors group-hover:text-[#ff4a8d]">
                      {related.title}
                    </h3>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ── PRODUITS RECOMMANDÉS ── */}
      {linkedProducts.length > 0 && (
        <section className="border-t border-white/5 px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.35em] text-[#ff4a8d]">Sélection associée</p>
                <h2 className="mt-2 text-2xl font-black uppercase italic tracking-tighter text-white">
                  Produits recommandés
                </h2>
              </div>
              <Link
                href="/catalogue"
                className="hidden text-[10px] font-black uppercase tracking-[0.2em] text-white/40 transition-colors hover:text-[#ff4a8d] sm:inline-flex"
              >
                Voir tout
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
              {linkedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
