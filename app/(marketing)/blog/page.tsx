import { ArticleCard } from "@/components/blog/article-card";
import { Container, SectionHeading } from "@/components/shared/primitives";
import { JsonLd } from "@/components/shared/json-ld";
import { getAllPosts } from "@/lib/content/blog";
import { breadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Blog",
  description:
    "WallBang blog: CS2 retake tips, aim training insights, and competitive Counter-Strike 2 guides for India-first players.",
  path: "/blog",
});

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="py-16 sm:py-20">
      <JsonLd
        id="ld-blog-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
        ])}
      />
      <Container>
        <SectionHeading
          eyebrow="Blog"
          title="Guides for serious CS2 players"
          description="Retake tactics, aim development, and platform updates from the WallBang team."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {posts.map((post) => (
            <ArticleCard key={post.slug} post={post} />
          ))}
        </div>
      </Container>
    </div>
  );
}
