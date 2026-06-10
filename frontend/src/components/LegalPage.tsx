import ReactMarkdown from "react-markdown";
import type { LegalPage as LegalPageData } from "@/lib/api";

function formatUpdatedAt(value?: string) {
  if (!value) return null;

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export default function LegalPage({ page }: { page: LegalPageData }) {
  const updatedAt = formatUpdatedAt(page.updatedAt);

  return (
    <main className="min-h-screen bg-[#131313] text-[#e5e2e1] selection:bg-[#ff4a8d] selection:text-white">
      <section className="relative overflow-hidden border-b border-white/5 bg-[radial-gradient(circle_at_top_right,rgba(255,74,141,0.16),transparent_36%),linear-gradient(135deg,#101010_0%,#171717_50%,#0b0b0b_100%)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ff4a8d]/60 to-transparent" />
        <div className="max-w-[1100px] mx-auto px-6 md:px-8 pt-28 pb-16 md:pt-36 md:pb-24">
          <p className="mb-5 text-[10px] font-black uppercase tracking-[0.35em] text-[#ffb1c4]">Barber Paradise · Informations légales</p>
          <h1 className="max-w-4xl text-4xl md:text-6xl lg:text-7xl font-black uppercase italic tracking-tighter leading-[0.9] text-white">
            {page.title}
          </h1>
          <p className="mt-7 max-w-3xl text-base md:text-lg leading-8 text-gray-400">
            Cette page est administrable depuis le back-office Barber Paradise et son contenu est rendu en Markdown.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
            {updatedAt ? <span className="border border-white/10 px-4 py-2">Mis à jour le {updatedAt}</span> : null}
          </div>
        </div>
      </section>

      <section className="max-w-[1100px] mx-auto px-6 md:px-8 py-14 md:py-20">
        <article className="rounded-none border border-white/10 bg-[#181818]/90 p-6 md:p-10 lg:p-14 shadow-2xl shadow-black/30">
          <ReactMarkdown
            components={{
              h1: ({ children }) => null,
              h2: ({ children }) => (
                <h2 className="mt-14 mb-5 text-2xl md:text-3xl font-black tracking-tight uppercase italic text-[#ffb1c4] first:mt-0">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="mt-10 mb-4 text-lg md:text-xl font-black tracking-wide uppercase text-white">
                  {children}
                </h3>
              ),
              p: ({ children }) => <p className="mb-5 text-sm md:text-base leading-8 text-gray-300">{children}</p>,
              ul: ({ children }) => <ul className="mb-7 space-y-2">{children}</ul>,
              ol: ({ children }) => <ol className="mb-7 ml-5 list-decimal space-y-2">{children}</ol>,
              li: ({ children }) => (
                <li className="ml-5 list-disc pl-2 text-sm md:text-base leading-8 text-gray-300 marker:text-[#ff4a8d]">
                  {children}
                </li>
              ),
              strong: ({ children }) => <strong className="font-black text-white">{children}</strong>,
              a: ({ href, children }) => (
                <a href={href} className="text-[#ffb1c4] underline underline-offset-4 hover:text-white">
                  {children}
                </a>
              ),
            }}
          >
            {page.content}
          </ReactMarkdown>
        </article>
      </section>
    </main>
  );
}
