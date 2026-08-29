import { Container } from "@/components/shared/primitives";
import { JsonLd } from "@/components/shared/json-ld";
import { getLegalDocument, renderSimpleMarkdown } from "@/lib/content/legal";
import { breadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "WallBang Business Information",
  description:
    "WallBang business information — brand name, business category, support contact, and registered business details for wallbang.xyz.",
  path: "/business-information",
});

export default function BusinessInformationPage() {
  const html = renderSimpleMarkdown(getLegalDocument("business-information"));

  return (
    <div className="py-16 sm:py-20">
      <JsonLd
        id="ld-business-information-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Business Information", path: "/business-information" },
        ])}
      />
      <Container>
        <article
          className="prose-legal max-w-3xl [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_h1]:mb-6 [&_h1]:text-4xl [&_h1]:font-bold [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_p]:mb-4 [&_p]:leading-relaxed [&_p]:text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </Container>
    </div>
  );
}
