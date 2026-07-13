import { RoadmapSection } from "@/components/home/roadmap-section";
import { Container, SectionHeading } from "@/components/shared/primitives";
import { JsonLd } from "@/components/shared/json-ld";
import { breadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Roadmap",
  description:
    "WallBang CS2 roadmap: live Mumbai retakes, VIP and Steam login next, then player profiles, leaderboards, and tournaments.",
  path: "/roadmap",
});

export default function RoadmapPage() {
  return (
    <div className="py-16 sm:py-20">
      <JsonLd
        id="ld-roadmap-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Roadmap", path: "/roadmap" },
        ])}
      />
      <Container>
        <SectionHeading
          eyebrow="Roadmap"
          title="Where WallBang is headed"
          description="Retake #1 is live in Mumbai. Here’s what we’ve shipped and what’s coming next for the competitive platform."
        />
      </Container>
      <RoadmapSection showViewAll={false} showHeading={false} />
    </div>
  );
}
