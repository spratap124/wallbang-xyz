import { FaqSection } from "@/components/home/faq-section";
import { Container, SectionHeading } from "@/components/shared/primitives";
import { JsonLd } from "@/components/shared/json-ld";
import { faqs } from "@/content/faq";
import { breadcrumbJsonLd, faqJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "FAQ",
  description:
    "Frequently asked questions about WallBang: India-hosted Counter-Strike 2 community servers, what you pay for, whether you need to own CS2, and Valve affiliation.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <div className="py-16 sm:py-20">
      <JsonLd id="ld-faq" data={faqJsonLd(faqs)} />
      <JsonLd
        id="ld-faq-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "FAQ", path: "/faq" },
        ])}
      />
      <Container>
        <SectionHeading
          eyebrow="FAQ"
          title="Frequently asked questions"
          description="Answers about WallBang hosted Counter-Strike 2 community servers in India, Hosted Server Access, duration, and refunds."
        />
      </Container>
      <FaqSection items={faqs} showViewAll={false} />
    </div>
  );
}
