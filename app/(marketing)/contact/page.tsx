import { LegalArticle } from "@/components/legal/legal-article";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Contact Us",
  description:
    "Contact WallBang for CS2 community server support, VIP membership, payments, refunds, cancellations, and technical issues.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <LegalArticle
      slug="contact"
      breadcrumbName="Contact Us"
      breadcrumbPath="/contact"
    />
  );
}
