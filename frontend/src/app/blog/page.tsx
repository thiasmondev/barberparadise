import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Clock, Eye, Tag } from "lucide-react";
import { getBlogArticles, getBlogCategories, type BlogArticle } from "@/lib/api";

export const metadata: Metadata = {
  title: "Blog barbier & coiffure homme | Barber Paradise",
  description:
    "Conseils experts, guides d’achat et inspirations pour barbiers, coiffeurs et passionnés de grooming masculin par Barber Paradise.",
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
    <article className={`group overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${featured ? "lg:grid lg:grid-cols-2" : ""}`}>
      <Link href={`/blog/${article.slug}`} className={`relative block overflow-hidden bg-gray-100 ${featured ? "min-h-[320px]" : "aspect-[16/10]"}`}>
        {article.coverImage ? (
          <Image
            src={article.coverImage}
            alt={article.title}
            fill
            className="object-cover transition duration-500 group-hover:scale-105"
            sizes={featured ? "(max-width: 1024px) 100vw, 50vw" : "(max-width: 768px) 100vw, 33vw"}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-dark-900 via-dark-700 to-primary-700" />
        )}
        <div className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-primary shadow-sm">
          {article.category}
        </div>
      </Link>
      <div className={featured ? "p-8 lg:p-10" : "p-6"}>
        <div className="mb-4 flex flex-wrap items-center gap-4 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
          <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />{formatDate(article.publishedAt)}</span>
          <span className="inline-flex items-center gap-1.5"><Clock size={14} />{article.readTime} min</span>
          <span className="inline-flex items-center gap-1.5"><Eye size={14} />{article.viewCount} vues</span>
        </div>
        <Link href={`/blog/${article.slug}`}>
          <h2 className={`${featured ? "text-3xl lg:text-4xl" : "text-xl"} font-black leading-tight text-dark-900 transition group-hover:text-primary`}>
            {article.title}
          </h2>
        </Link>
        <p className="mt-4 line-clamp-3 text-sm leading-7 text-gray-600">{article.excerpt}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {article.tags.slice(0, 4).map((tag) => (
            <Link key={tag} href={`/blog?tag=${encodeURIComponent(tag)}`} className="rounded-full bg-gray-50 px-3 py-1 text-xs font-bold text-gray-600 transition hover:bg-primary hover:text-white">
              #{tag}
            </Link>
          ))}
        </div>
        <Link href={`/blog/${article.slug}`} className="mt-7 inline-flex items-center font-black uppercase tracking-[0.18em] text-primary transition hover:text-dark-900">
          Lire l’article
        </Link>
      </div>
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
    <main className="bg-[#fbf8f4]">
      <section className="relative overflow-hidden bg-dark-950 px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(214,162,92,0.35),transparent_42%)]" />
        <div className="relative mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-primary">Barber Paradise Magazine</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
            Blog barbier, coiffure homme et matériel professionnel
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-300">
            Retrouvez des guides concrets pour choisir vos tondeuses, entretenir vos outils, perfectionner vos prestations et développer votre culture barber.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold text-gray-500">{total} article{total > 1 ? "s" : ""} publié{total > 1 ? "s" : ""}</p>
            {(category || tag) && <p className="mt-1 text-sm text-gray-500">Filtre actif : <strong>{category || `#${tag}`}</strong></p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/blog" className="rounded-full bg-dark-900 px-4 py-2 text-sm font-black text-white transition hover:bg-primary">Tous</Link>
            {categories.map((item) => (
              <Link key={item.name} href={`/blog?category=${encodeURIComponent(item.name)}`} className="rounded-full border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition hover:border-primary hover:text-primary">
                {item.name} <span className="text-gray-400">({item.count})</span>
              </Link>
            ))}
          </div>
        </div>

        {featured ? (
          <div className="space-y-8">
            {page === 1 && !category && !tag && <BlogCard article={featured} featured />}
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {(page === 1 && !category && !tag ? rest : articles).map((article) => <BlogCard key={article.id} article={article} />)}
            </div>
          </div>
        ) : (
          <div className="rounded-3xl bg-white p-12 text-center shadow-sm">
            <Tag className="mx-auto text-primary" size={36} />
            <h2 className="mt-4 text-2xl font-black text-dark-900">Aucun article disponible</h2>
            <p className="mt-2 text-gray-600">Les prochains conseils Barber Paradise arrivent bientôt.</p>
          </div>
        )}

        {totalPages > 1 && (
          <nav className="mt-12 flex justify-center gap-3" aria-label="Pagination blog">
            {Array.from({ length: totalPages }).map((_, index) => {
              const current = index + 1;
              const params = new URLSearchParams();
              if (current > 1) params.set("page", String(current));
              if (category) params.set("category", category);
              if (tag) params.set("tag", tag);
              return (
                <Link key={current} href={`/blog${params.toString() ? `?${params.toString()}` : ""}`} className={`h-11 w-11 rounded-full text-center text-sm font-black leading-11 transition ${current === page ? "bg-primary text-white" : "bg-white text-dark-900 hover:bg-dark-900 hover:text-white"}`}>
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
