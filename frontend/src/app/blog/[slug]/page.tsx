import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, Eye, ArrowLeft, ShoppingBag } from "lucide-react";
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
    if (text) blocks.push(<p key={`p-${blocks.length}`} className="my-6 text-lg leading-9 text-gray-700">{text}</p>);
    paragraph = [];
  };

  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-6 space-y-3 pl-6 text-lg leading-8 text-gray-700">
        {list.map((item, index) => <li key={index} className="list-disc">{item}</li>)}
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
      blocks.push(<h3 key={`h3-${blocks.length}`} className="mb-4 mt-10 text-2xl font-black text-dark-900">{trimmed.replace(/^###\s+/, "")}</h3>);
      return;
    }
    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push(<h2 key={`h2-${blocks.length}`} className="mb-5 mt-12 text-3xl font-black text-dark-900">{trimmed.replace(/^##\s+/, "")}</h2>);
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
    <main className="bg-[#fbf8f4]">
      <ArticleJsonLd article={article} />
      <article>
        <section className="relative overflow-hidden bg-dark-950 px-4 py-16 text-white sm:px-6 lg:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,162,92,0.34),transparent_42%)]" />
          <div className="relative mx-auto max-w-4xl">
            <Link href="/blog" className="mb-8 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-primary transition hover:text-white">
              <ArrowLeft size={16} /> Retour au blog
            </Link>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-primary">{article.category}</p>
            <h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">{article.title}</h1>
            <p className="mt-6 text-xl leading-9 text-gray-300">{article.excerpt}</p>
            <div className="mt-8 flex flex-wrap items-center gap-5 text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">
              <span className="inline-flex items-center gap-2"><CalendarDays size={16} />{formatDate(article.publishedAt)}</span>
              <span className="inline-flex items-center gap-2"><Clock size={16} />{article.readTime} min</span>
              <span className="inline-flex items-center gap-2"><Eye size={16} />{article.viewCount} vues</span>
            </div>
          </div>
        </section>

        {article.coverImage && (
          <div className="mx-auto -mt-10 max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="relative aspect-[16/8] overflow-hidden rounded-3xl bg-gray-100 shadow-2xl">
              <Image src={article.coverImage} alt={article.title} fill priority className="object-cover" sizes="(max-width: 1024px) 100vw, 1024px" />
            </div>
          </div>
        )}

        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
          <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-10 lg:p-12">
            <div className="prose max-w-none">{renderMarkdown(article.content)}</div>
            <div className="mt-10 flex flex-wrap gap-2 border-t border-gray-100 pt-8">
              {article.tags.map((tag) => (
                <Link key={tag} href={`/blog?tag=${encodeURIComponent(tag)}`} className="rounded-full bg-gray-50 px-4 py-2 text-sm font-bold text-gray-600 transition hover:bg-primary hover:text-white">
                  #{tag}
                </Link>
              ))}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl bg-dark-900 p-6 text-white shadow-sm">
              <p className="text-sm font-black uppercase tracking-[0.24em] text-primary">Conseil pro</p>
              <h2 className="mt-3 text-2xl font-black">Besoin du bon matériel ?</h2>
              <p className="mt-3 text-sm leading-7 text-gray-300">Explorez le catalogue Barber Paradise pour trouver des tondeuses, soins, accessoires et consommables adaptés à votre usage.</p>
              <Link href="/catalogue" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white transition hover:bg-primary-600">
                <ShoppingBag size={16} /> Catalogue
              </Link>
            </div>
            {relatedArticles.length > 0 && (
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-xl font-black text-dark-900">À lire aussi</h2>
                <div className="mt-5 space-y-5">
                  {relatedArticles.map((related) => (
                    <Link key={related.id} href={`/blog/${related.slug}`} className="block border-b border-gray-100 pb-5 last:border-0 last:pb-0">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">{related.category}</p>
                      <h3 className="mt-2 font-black leading-snug text-dark-900 transition hover:text-primary">{related.title}</h3>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </section>
      </article>

      {linkedProducts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-primary">Sélection associée</p>
              <h2 className="mt-2 text-3xl font-black text-dark-900">Produits recommandés dans cet article</h2>
            </div>
            <Link href="/catalogue" className="hidden text-sm font-black uppercase tracking-[0.16em] text-primary hover:text-dark-900 sm:inline-flex">Voir tout</Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {linkedProducts.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </section>
      )}
    </main>
  );
}
