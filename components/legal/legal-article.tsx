import { Container } from "@/components/shared/primitives";
import { JsonLd } from "@/components/shared/json-ld";
import {
  getLegalDocument,
  renderSimpleMarkdown,
  type LegalDocumentSlug,
} from "@/lib/content/legal";
import { breadcrumbJsonLd } from "@/seo/json-ld";

const articleClassName =
  "prose-legal max-w-3xl [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_h1]:mb-6 [&_h1]:text-4xl [&_h1]:font-bold [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_p]:mb-4 [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6 [&_li]:leading-relaxed [&_li]:text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground";

type LegalArticleProps = {
  slug: LegalDocumentSlug;
  breadcrumbName: string;
  breadcrumbPath: string;
};

export function LegalArticle({
  slug,
  breadcrumbName,
  breadcrumbPath,
}: LegalArticleProps) {
  const html = renderSimpleMarkdown(getLegalDocument(slug));

  return (
    <div className="py-16 sm:py-20">
      <JsonLd
        id={`ld-${slug}-breadcrumb`}
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: breadcrumbName, path: breadcrumbPath },
        ])}
      />
      <Container>
        <article
          className={articleClassName}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </Container>
    </div>
  );
}
