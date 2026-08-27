import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Rendu Markdown partagé par l’article public et la prévisualisation admin.
 * Le HTML brut n’est volontairement pas activé : le contenu Markdown reste rendu
 * de façon sûre, avec le support GitHub Flavored Markdown pour les tableaux.
 */
const components: Components = {
  h1: ({ children }) => (
    <h1 className="mb-6 mt-12 text-3xl font-black uppercase italic tracking-tighter text-white sm:text-4xl">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-5 mt-12 border-l-2 border-[#ff4a8d] pl-4 text-2xl font-black uppercase italic tracking-tighter text-white">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-4 mt-10 text-xl font-black uppercase italic tracking-tight text-white">
      <span className="text-[#ff4a8d]">—</span> {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-3 mt-8 text-lg font-bold text-white">{children}</h4>
  ),
  p: ({ children }) => <p className="my-6 text-base leading-9 text-white/70">{children}</p>,
  strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-white/85">{children}</em>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-semibold text-[#ff4a8d] underline decoration-[#ff4a8d]/40 underline-offset-4 transition hover:text-white"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="my-6 space-y-3 pl-6 text-base leading-8 text-white/70 marker:text-[#ff4a8d]">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-6 list-decimal space-y-3 pl-6 text-base leading-8 text-white/70 marker:font-bold marker:text-[#ff4a8d]">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-8 border-l-2 border-[#ff4a8d] bg-white/[0.03] px-5 py-4 text-lg italic leading-8 text-white/85">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-10 border-white/10" />,
  code: ({ children, className }) => (
    <code className={`${className || ""} rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.9em] text-[#ffd4e5]`}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-8 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-7 text-white/85">{children}</pre>
  ),
  img: ({ src, alt }) => (
    <img
      src={src || ""}
      alt={alt || "Illustration de l’article"}
      loading="lazy"
      className="my-8 h-auto w-full rounded-xl border border-white/10 object-cover shadow-2xl shadow-black/20"
    />
  ),
  table: ({ children }) => (
    <div className="my-8 overflow-x-auto rounded-xl border border-white/10">
      <table className="min-w-full border-collapse text-left text-sm text-white/75">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-[#0f056b]/70 text-xs uppercase tracking-wide text-white">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-white/10">{children}</tbody>,
  tr: ({ children }) => <tr className="transition hover:bg-white/[0.035]">{children}</tr>,
  th: ({ children }) => <th className="whitespace-nowrap px-4 py-3 font-bold">{children}</th>,
  td: ({ children }) => <td className="px-4 py-3 align-top leading-6">{children}</td>,
};

export function renderBlogMarkdown(content: string) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
