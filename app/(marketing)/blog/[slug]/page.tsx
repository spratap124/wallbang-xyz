import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleContent } from "@/components/blog/article-content";
import { Container } from "@/components/shared/primitives";
import { JsonLd } from "@/components/shared/json-ld";
import { getBlogSlugs, getPostBySlug } from "@/lib/content/blog";
import { articleJsonLd, breadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return createPageMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
    type: "article",
    keywords: post.tags,
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  return (
    <article className="py-16 sm:py-20">
      <JsonLd
        id="ld-article"
        data={articleJsonLd({
          title: post.title,
          description: post.description,
          slug: post.slug,
          publishedAt: post.publishedAt,
          updatedAt: post.updatedAt,
        })}
      />
      <JsonLd
        id="ld-article-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: post.title, path: `/blog/${post.slug}` },
        ])}
      />
      <Container>
        <header className="mb-10 max-w-3xl">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            {new Date(post.publishedAt).toLocaleDateString("en-IN", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}{" "}
            · {post.readingTime}
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            {post.title}
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">{post.description}</p>
        </header>
        <ArticleContent source={post.content} />
      </Container>
    </article>
  );
}
