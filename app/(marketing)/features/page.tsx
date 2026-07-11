import { FeaturesSection } from "@/components/home/features-section";
import { Container, SectionHeading } from "@/components/shared/primitives";
import { JsonLd } from "@/components/shared/json-ld";
import { breadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Features",
  description:
    "Explore WallBang CS2 platform features: low latency India retake servers, VIP, skins, Steam login, statistics, leaderboards, and tournament-ready architecture.",
  path: "/features",
});

export default function FeaturesPage() {
  return (
    <div className="py-16 sm:py-20">
      <JsonLd
        id="ld-features-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Features", path: "/features" },
        ])}
      />
      <Container>
        <SectionHeading
          eyebrow="Features"
          title="Everything WallBang is building"
          description="A competitive CS2 platform stack — from India-first retakes to VIP cosmetics, stats, leaderboards, and future tournaments."
        />
      </Container>
      <FeaturesSection showViewAll={false} />
    </div>
  );
}
