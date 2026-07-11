import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import readingTime from "reading-time";

import type { BlogFrontmatter, BlogPost } from "@/types/content";

const BLOG_DIR = path.join(process.cwd(), "content/blog");

function isBlogFrontmatter(data: unknown): data is BlogFrontmatter {
  if (!data || typeof data !== "object") return false;
  const value = data as Record<string, unknown>;
  return (
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.publishedAt === "string" &&
    typeof value.author === "string" &&
    Array.isArray(value.tags)
  );
}

export function getBlogSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.replace(/\.mdx$/, ""));
}

export function getPostBySlug(slug: string): BlogPost | null {
  const fullPath = path.join(BLOG_DIR, `${slug}.mdx`);
  if (!fs.existsSync(fullPath)) return null;

  const raw = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(raw);

  if (!isBlogFrontmatter(data) || data.draft) return null;

  return {
    ...data,
    tags: data.tags.map(String),
    slug,
    content,
    readingTime: readingTime(content).text,
  };
}

export function getAllPosts(): BlogPost[] {
  return getBlogSlugs()
    .map((slug) => getPostBySlug(slug))
    .filter((post): post is BlogPost => Boolean(post))
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
}
