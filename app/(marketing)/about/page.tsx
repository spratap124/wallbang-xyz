import { LegalArticle } from "@/components/legal/legal-article";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "About Us",
  description:
    "About WallBang — privately managed Counter-Strike 2 community and retake servers operated by Shivani.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <LegalArticle slug="about" breadcrumbName="About Us" breadcrumbPath="/about" />
  );
}
