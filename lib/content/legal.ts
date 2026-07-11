import fs from "node:fs";
import path from "node:path";

export function getLegalDocument(slug: "privacy" | "terms"): string {
  const fullPath = path.join(process.cwd(), "content/legal", `${slug}.md`);
  return fs.readFileSync(fullPath, "utf8");
}

/** Minimal markdown → HTML for legal docs (headings + paragraphs + links). */
export function renderSimpleMarkdown(markdown: string): string {
  const lines = markdown.trim().split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    if (text) {
      html.push(`<p>${linkify(text)}</p>`);
    }
    paragraph = [];
  };

  for (const line of lines) {
    if (line.startsWith("# ")) {
      flush();
      html.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      html.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();

  return html.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function linkify(value: string): string {
  return escapeHtml(value).replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" rel="noopener noreferrer">$1</a>',
  );
}
