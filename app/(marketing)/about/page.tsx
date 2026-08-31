import { LegalArticle } from "@/components/legal/legal-article";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "About Us",
  description:
    "About WallBang — a Counter-Strike 2 gaming community and retake server platform operated by Shivani.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <LegalArticle slug="about" breadcrumbName="About Us" breadcrumbPath="/about" />
  );
}
