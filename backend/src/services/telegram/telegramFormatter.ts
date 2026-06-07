const TELEGRAM_MAX_LENGTH = 4000;

export function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function restoreAllowedTelegramTags(text: string): string {
  return text
    .replace(/&lt;(\/?)(b|i|u|s|code|pre)&gt;/g, "<$1$2>")
    .replace(/&lt;a href=&quot;([^&]+)&quot;&gt;/g, '<a href="$1">')
    .replace(/&lt;\/a&gt;/g, "</a>");
}

export function markdownToTelegramHtml(text: string): string {
  let result = text
    .replace(/\[DRAFT:(blog|social|email|product)\]/g, "")
    .replace(/\[\/DRAFT\]/g, "")
    .trim();

  result = escapeTelegramHtml(result);

  result = result.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => `<pre>${code.trim()}</pre>`);
  result = result.replace(/`([^`]+)`/g, "<code>$1</code>");
  result = result.replace(/^### (.+)$/gm, "<b>$1</b>");
  result = result.replace(/^## (.+)$/gm, "<b>$1</b>");
  result = result.replace(/^# (.+)$/gm, "<b>$1</b>");
  result = result.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  result = result.replace(/__(.+?)__/g, "<b>$1</b>");
  result = result.replace(/(^|\s)\*(?!\s)([^*]+?)(?<!\s)\*(?=\s|$|[.,;:!?])/g, "$1<i>$2</i>");
  result = result.replace(/(^|\s)_(?!\s)([^_]+?)(?<!\s)_(?=\s|$|[.,;:!?])/g, "$1<i>$2</i>");
  result = result.replace(/^[-*] (.+)$/gm, "• $1");
  result = result.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
  result = result.replace(/\n{3,}/g, "\n\n");

  return restoreAllowedTelegramTags(result).trim();
}

export function splitTelegramMessage(text: string, maxLength = TELEGRAM_MAX_LENGTH): string[] {
  if (text.length <= maxLength) return [text];

  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      parts.push(remaining);
      break;
    }

    let cutIndex = remaining.lastIndexOf("\n\n", maxLength);
    if (cutIndex === -1 || cutIndex < maxLength * 0.5) {
      cutIndex = remaining.lastIndexOf("\n", maxLength);
    }
    if (cutIndex === -1 || cutIndex < maxLength * 0.5) {
      cutIndex = remaining.lastIndexOf(" ", maxLength);
    }
    if (cutIndex === -1 || cutIndex < maxLength * 0.5) {
      cutIndex = maxLength;
    }

    parts.push(remaining.substring(0, cutIndex).trim());
    remaining = remaining.substring(cutIndex).trimStart();
  }

  return parts.filter(Boolean);
}

export function extractDraftSummaries(text: string): { type: string; title: string }[] {
  const draftRegex = /\[DRAFT:(blog|social|email|product)\]([\s\S]*?)\[\/DRAFT\]/g;
  const summaries: { type: string; title: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = draftRegex.exec(text)) !== null) {
    const type = match[1];
    const content = match[2].trim();
    const firstLine = content.split("\n")[0]?.replace(/^#+\s*/, "").trim();
    summaries.push({ type, title: firstLine?.slice(0, 80) || `Brouillon ${type}` });
  }

  return summaries;
}
