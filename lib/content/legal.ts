import fs from "node:fs";
import path from "node:path";

export type LegalDocumentSlug =
  | "privacy"
  | "terms"
  | "refund"
  | "about"
  | "services"
  | "cancellation"
  | "contact"
  | "business-information"
  | "shipping-and-delivery";

export function getLegalDocument(slug: LegalDocumentSlug): string {
  const fullPath = path.join(process.cwd(), "content/legal", `${slug}.md`);
  return fs.readFileSync(fullPath, "utf8");
}

const UNORDERED_LIST = /^[-*] (.+)$/;
const ORDERED_LIST = /^\d+\. (.+)$/;

/** Minimal markdown → HTML for legal docs (headings, lists, bold, links). */
export function renderSimpleMarkdown(markdown: string): string {
  const lines = markdown.trim().split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    if (text) {
      html.push(`<p>${formatInline(text)}</p>`);
    }
    paragraph = [];
  };

  const flushList = () => {
    if (!listType || !listItems.length) return;
    const items = listItems.map((item) => `<li>${formatInline(item)}</li>`).join("");
    html.push(`<${listType}>${items}</${listType}>`);
    listType = null;
    listItems = [];
  };

  const startList = (type: "ul" | "ol", item: string) => {
    flushParagraph();
    if (listType && listType !== type) flushList();
    listType = type;
    listItems.push(item);
  };

  for (const line of lines) {
    if (line.startsWith("# ")) {
      flushParagraph();
      flushList();
      html.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      html.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      html.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
      continue;
    }

    const unordered = line.match(UNORDERED_LIST);
    if (unordered) {
      startList("ul", unordered[1] ?? "");
      continue;
    }

    const ordered = line.match(ORDERED_LIST);
    if (ordered) {
      startList("ol", ordered[1] ?? "");
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();

  return html.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatInline(value: string): string {
  return applyBold(linkify(value));
}

function linkify(value: string): string {
  return escapeHtml(value).replace(
    /\[([^\]]+)\]\((mailto:[^)]+|https?:\/\/[^)]+)\)/g,
    '<a href="$2" rel="noopener noreferrer">$1</a>',
  );
}

function applyBold(html: string): string {
  return html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
