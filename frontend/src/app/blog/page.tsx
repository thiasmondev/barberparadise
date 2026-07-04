import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Clock, BookOpen } from "lucide-react";
import { getBlogArticles, getBlogCategories, type BlogArticle } from "@/lib/api";

export const metadata: Metadata = {
  title: "Blog barbier & coiffure homme | Barber Paradise",
  description:
    "Conseils experts, guides d'achat et inspirations pour barbiers, coiffeurs et passionnés de grooming masculin par Barber Paradise.",
  alternates: { canonical: "/blog" },
};

type BlogPageProps = {
  searchParams?: Promise<{ page?: string; category?: string; tag?: string }>;
};

function formatDate(value?: string | null) {
  if (!value) return "À paraître";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function BlogCard({ article, featured = false }: { article: BlogArticle; featured?: boolean }) {
  return (
    <article className={`group relative overflow-hidden bg-[#1c1b1b] border border-white/5 transition-all duration-300 hover:border-[#ff4a8d]/40 ${featured ? "lg:col-span-2" : ""}`}>
      <Link href={`/blog/${article.slug}`} className={`relative block overflow-hidden ${featured ? "aspect-[16/7]" : "aspect-[4/5]"}`}>
        {article.coverImage ? (
          <Image
            src={article.coverImage}
            alt={article.title}
            fill
            className="object-cover transition duration-700 group-hover:scale-105"
            sizes={featured ? "(max-width: 1024px) 100vw, 66vw" : "(max-width: 768px) 100vw, 33vw"}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#131313] via-[#1c1b1b] to-[#0a0a0a]" />
        )}
        {/* Dégradé sombre en bas pour la lisibilité du texte overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        {/* Badge catégorie */}
        <div className="absolute left-4 top-4 bg-[#ff4a8d] px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] text-white">
          {article.category}
        </div>

        {/* Texte overlay en bas de l'image */}
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
            <span className="inline-flex items-center gap-1.5"><CalendarDays size={11} />{formatDate(article.publishedAt)}</span>
            <span className="inline-flex items-center gap-1.5"><Clock size={11} />{article.readTime} min</span>
          </div>
          <h2 className={`font-black uppercase tracking-tight leading-tight text-white transition-colors group-hover:text-[#ff4a8d] ${featured ? "text-2xl sm:text-3xl lg:text-4xl" : "text-lg sm:text-xl"}`}>
            {article.title}
          </h2>
          {featured && (
            <p className="mt-3 line-clamp-2 text-sm leading-7 text-white/60">{article.excerpt}</p>
          )}
        </div>
      </Link>
    </article>
  );
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const resolvedParams = await searchParams;
  const page = Math.max(Number(resolvedParams?.page || 1), 1);
  const category = resolvedParams?.category;
  const tag = resolvedParams?.tag;
  const [{ articles, total, totalPages }, { categories }] = await Promise.all([
    getBlogArticles({ page, limit: 9, category, tag }),
    getBlogCategories(),
  ]);
  const [featured, ...rest] = articles;

  return (
    <main className="bg-[#131313] text-[#e5e2e1] min-h-screen">
      {/* ── HERO ── */}
      <section className="relative overflow-hidden border-b border-white/5 px-4 py-20 sm:px-6 lg:px-8">
        {/* Fond dégradé navy → noir */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0820] via-[#131313] to-[#0a0a0a]" />
        {/* Halo rose discret */}
        <div className="absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-[#ff4a8d]/5 blur-3xl" />
        <div className="absolute -left-20 bottom-0 h-[300px] w-[300px] rounded-full bg-[#ff4a8d]/3 blur-3xl" />

        <div className="relative mx-auto max-w-7xl">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#ff4a8d]">Barber Paradise</p>
          <h1 className="mt-4 max-w-4xl text-5xl font-black uppercase italic leading-none tracking-tighter text-white sm:text-6xl lg:text-8xl">
            MAGAZINE
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-7 text-white/50 tracking-wide">
            Conseils experts, guides d'achat et inspirations pour barbiers, coiffeurs et passionnés de grooming masculin.
          </p>
          {total > 0 && (
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
              {total} article{total > 1 ? "s" : ""} publié{total > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </section>

      {/* ── FILTRES CATÉGORIES ── */}
      <section className="border-b border-white/5 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/blog"
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${!category && !tag ? "bg-[#ff4a8d] text-white" : "border border-white/10 bg-[#1c1b1b] text-white/60 hover:border-[#ff4a8d]/50 hover:text-white"}`}
            >
              Tous
            </Link>
            {categories.map((item) => (
              <Link
                key={item.name}
                href={`/blog?category=${encodeURIComponent(item.name)}`}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${category === item.name ? "bg-[#ff4a8d] text-white" : "border border-white/10 bg-[#1c1b1b] text-white/60 hover:border-[#ff4a8d]/50 hover:text-white"}`}
              >
                {item.name}
                <span className="ml-1.5 text-white/30">({item.count})</span>
              </Link>
            ))}
          </div>
          {tag && (
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#ff4a8d]">
              Tag actif : #{tag}
            </p>
          )}
        </div>
      </section>

      {/* ── GRILLE ARTICLES ── */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {featured ? (
          <div className="space-y-4">
            {/* Article featured (1ère page sans filtre) */}
            {page === 1 && !category && !tag && (
              <div className="grid gap-4 lg:grid-cols-3">
                <BlogCard article={featured} featured />
                {rest.slice(0, 1).map((article) => (
                  <BlogCard key={article.id} article={article} />
                ))}
              </div>
            )}
            {/* Grille standard */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(page === 1 && !category && !tag ? rest.slice(1) : articles).map((article) => (
                <BlogCard key={article.id} article={article} />
              ))}
            </div>
          </div>
        ) : (
          /* État vide */
          <div className="border border-white/5 bg-[#1c1b1b] p-16 text-center">
            <BookOpen className="mx-auto text-[#ff4a8d]" size={40} strokeWidth={1.5} />
            <h2 className="mt-6 text-2xl font-black uppercase italic tracking-tighter text-white">
              Aucun article disponible
            </h2>
            <p className="mt-3 text-sm text-white/40">Les prochains conseils Barber Paradise arrivent bientôt.</p>
            <Link
              href="/blog"
              className="mt-8 inline-flex items-center gap-2 border border-[#ff4a8d]/40 px-6 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-[#ff4a8d] transition-colors hover:bg-[#ff4a8d] hover:text-white"
            >
              Voir tous les articles
            </Link>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="mt-12 flex justify-center gap-2" aria-label="Pagination blog">
            {Array.from({ length: totalPages }).map((_, index) => {
              const current = index + 1;
              const params = new URLSearchParams();
              if (current > 1) params.set("page", String(current));
              if (category) params.set("category", category);
              if (tag) params.set("tag", tag);
              return (
                <Link
                  key={current}
                  href={`/blog${params.toString() ? `?${params.toString()}` : ""}`}
                  className={`flex h-10 w-10 items-center justify-center text-xs font-black uppercase tracking-widest transition-colors ${current === page ? "bg-[#ff4a8d] text-white" : "border border-white/10 bg-[#1c1b1b] text-white/60 hover:border-[#ff4a8d]/50 hover:text-white"}`}
                >
                  {current}
                </Link>
              );
            })}
          </nav>
        )}
      </section>
    </main>
  );
}
