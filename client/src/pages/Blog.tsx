import { blogPosts } from "@/lib/data";
import { Link, useParams } from "wouter";
import { ArrowRight, Clock, User, ChevronRight, Loader2 } from "lucide-react";
import { useBlogPosts } from "@/hooks/useApi";


export default function Blog() {
  const { slug } = useParams<{ slug?: string }>();
  const post = slug ? blogPosts.find((p) => p.slug === slug) : null;

  if (slug && !post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-black text-gray-200 mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            ARTICLE INTROUVABLE
          </h1>
          <Link href="/blog" className="btn-primary">
            Retour au blog
          </Link>
        </div>
      </div>
    );
  }

  if (post) {
    return (
      <div className="min-h-screen bg-white">
        <div className="bg-gray-50 border-b border-gray-200">
          <div className="container py-3">
            <nav className="flex items-center gap-2 text-xs text-gray-500">
              <Link href="/" className="hover:text-primary">
                Accueil
              </Link>
              <ChevronRight size={12} />
              <Link href="/blog" className="hover:text-primary">
                Blog
              </Link>
              <ChevronRight size={12} />
              <span className="text-gray-800 font-medium truncate">{post.title}</span>
            </nav>
          </div>
        </div>

        <div className="relative h-96 overflow-hidden bg-gray-900">
          <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          <div className="absolute inset-0 flex items-end">
            <div className="container pb-8">
              <span className="inline-block bg-primary text-white text-xs font-black uppercase tracking-widest px-3 py-1 mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                {post.category}
              </span>
              <h1 className="text-4xl md:text-5xl font-black text-white leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                {post.title}
              </h1>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 border-b border-gray-200">
          <div className="container py-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <User size={14} />
              {post.author}
            </div>
            <div className="flex items-center gap-2">
              <Clock size={14} />
              {new Date(post.date).toLocaleDateString("fr-FR")}
            </div>
            <div className="flex items-center gap-2">
              <Clock size={14} />
              {post.readTime} min de lecture
            </div>
          </div>
        </div>

        <div className="container py-12">
          <div className="max-w-2xl mx-auto">
            <p className="text-gray-700 leading-relaxed text-lg mb-6">{post.excerpt}</p>
            <div className="text-gray-600 leading-relaxed space-y-4">
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </p>
              <h2 className="text-2xl font-black text-gray-800 mt-8 mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                Section Principale
              </h2>
              <p>
                Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 border-t border-gray-200 py-12">
          <div className="container">
            <h2 className="section-title mb-8">Articles Similaires</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {blogPosts
                .filter((p: typeof blogPosts[0]) => p.id !== post!.id)
                .slice(0, 3)
                .map((p: typeof blogPosts[0]) => (
                  <Link key={p.id} href={`/blog/${p.slug}`} className="group">
                    <div className="overflow-hidden bg-gray-200 aspect-video mb-4 border border-gray-200 group-hover:border-primary/30 transition-colors">
                      <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                    <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">{p.category}</p>
                    <h3 className="font-bold text-gray-800 group-hover:text-primary transition-colors leading-tight mb-2">{p.title}</h3>
                    <p className="text-xs text-gray-500">{p.readTime} min de lecture</p>
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-secondary text-white py-8">
        <div className="container">
          <h1 className="text-3xl md:text-4xl font-black uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Blog
          </h1>
          <p className="text-gray-400 text-sm mt-1">Conseils, guides et actualités de la barberie</p>
        </div>
      </div>

      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {blogPosts.map((post: typeof blogPosts[0]) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="group">
              <div className="overflow-hidden bg-gray-200 aspect-video mb-4 border border-gray-200 group-hover:border-primary/30 transition-colors">
                <img src={post.image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
              <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-2">{post.category}</p>
              <h3 className="text-lg font-bold text-gray-800 group-hover:text-primary transition-colors leading-tight mb-2">{post.title}</h3>
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">{post.excerpt}</p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{new Date(post.date).toLocaleDateString("fr-FR")}</span>
                <span>{post.readTime} min</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
