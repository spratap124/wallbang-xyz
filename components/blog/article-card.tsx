import Link from "next/link";

import type { BlogPost } from "@/types/content";

export function ArticleCard({ post }: { post: BlogPost }) {
  return (
    <article className="rounded-xl border border-border bg-card/50 p-6 transition-colors hover:border-primary/40">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">
        {new Date(post.publishedAt).toLocaleDateString("en-IN", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}{" "}
        · {post.readingTime}
      </p>
      <h2 className="mt-3 text-xl font-semibold">
        <Link href={`/blog/${post.slug}`} className="hover:text-primary">
          {post.title}
        </Link>
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {post.description}
      </p>
    </article>
  );
}
