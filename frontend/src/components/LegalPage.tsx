import type { LegalBlock, LegalPageContent } from "@/lib/legalPages";

function looksLikeSectionTitle(text: string) {
  return /^(Article\s+\d+|Étape\s+\d+|\d+\/|\d+\.|[0-9]+ ?-)/i.test(text.trim());
}

function LegalBlockView({ block }: { block: LegalBlock }) {
  if (block.kind === "heading1") {
    return null;
  }

  if (block.kind === "heading2") {
    return (
      <h2 className="mt-14 mb-5 text-2xl md:text-3xl font-black tracking-tight uppercase italic text-[#ffb1c4]">
        {block.text}
      </h2>
    );
  }

  if (block.kind === "heading3" || looksLikeSectionTitle(block.text)) {
    return (
      <h3 className="mt-10 mb-4 text-lg md:text-xl font-black tracking-wide uppercase text-white">
        {block.text}
      </h3>
    );
  }

  if (block.kind === "list_item") {
    return (
      <li className="ml-5 list-disc pl-2 text-sm md:text-base leading-8 text-gray-300 marker:text-[#ff4a8d]">
        {block.text}
      </li>
    );
  }

  return <p className="mb-5 text-sm md:text-base leading-8 text-gray-300">{block.text}</p>;
}

export default function LegalPage({ content, updatedAt }: { content: LegalPageContent; updatedAt?: string }) {
  return (
    <main className="min-h-screen bg-[#131313] text-[#e5e2e1] selection:bg-[#ff4a8d] selection:text-white">
      <section className="relative overflow-hidden border-b border-white/5 bg-[radial-gradient(circle_at_top_right,rgba(255,74,141,0.16),transparent_36%),linear-gradient(135deg,#101010_0%,#171717_50%,#0b0b0b_100%)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ff4a8d]/60 to-transparent" />
        <div className="max-w-[1100px] mx-auto px-6 md:px-8 pt-28 pb-16 md:pt-36 md:pb-24">
          <p className="mb-5 text-[10px] font-black uppercase tracking-[0.35em] text-[#ffb1c4]">Barber Paradise · Informations légales</p>
          <h1 className="max-w-4xl text-4xl md:text-6xl lg:text-7xl font-black uppercase italic tracking-tighter leading-[0.9] text-white">
            {content.title}
          </h1>
          <p className="mt-7 max-w-3xl text-base md:text-lg leading-8 text-gray-400">{content.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
            {updatedAt ? <span className="border border-white/10 px-4 py-2">Mis à jour le {updatedAt}</span> : null}
          </div>
        </div>
      </section>

      <section className="max-w-[1100px] mx-auto px-6 md:px-8 py-14 md:py-20">
        <article className="rounded-none border border-white/10 bg-[#181818]/90 p-6 md:p-10 lg:p-14 shadow-2xl shadow-black/30">
          <div className="prose prose-invert max-w-none">
            {content.blocks.map((block, index) => (
              <LegalBlockView key={`${block.kind}-${index}-${block.text.slice(0, 24)}`} block={block} />
            ))}
          </div>
        </article>

      </section>
    </main>
  );
}
