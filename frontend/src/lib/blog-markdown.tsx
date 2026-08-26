import { ReactNode } from "react";

/**
 * Rendu Markdown volontairement limité au format éditorial accepté par le blog public.
 * Cette fonction est partagée entre l’article public et la prévisualisation admin.
 */
export function renderBlogMarkdown(content: string): ReactNode[] {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    if (text) {
      blocks.push(<p key={`p-${blocks.length}`} className="my-6 text-base leading-9 text-white/70">{text}</p>);
    }
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
      blocks.push(<h3 key={`h3-${blocks.length}`} className="mb-4 mt-10 text-xl font-black uppercase italic tracking-tight text-white"><span className="text-[#ff4a8d]">—</span> {trimmed.replace(/^###\s+/, "")}</h3>);
      return;
    }
    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push(<h2 key={`h2-${blocks.length}`} className="mb-5 mt-12 border-l-2 border-[#ff4a8d] pl-4 text-2xl font-black uppercase italic tracking-tighter text-white">{trimmed.replace(/^##\s+/, "")}</h2>);
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
