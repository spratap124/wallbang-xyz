import { LegalArticle } from "@/components/legal/legal-article";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Refund Policy",
  description:
    "WallBang refund policy for prepaid VIP membership: 7-day eligibility, 5–7 business day processing, and how to request a refund.",
  path: "/refund",
});

export default function RefundPage() {
  return (
    <LegalArticle
      slug="refund"
      breadcrumbName="Refund Policy"
      breadcrumbPath="/refund"
    />
  );
}
