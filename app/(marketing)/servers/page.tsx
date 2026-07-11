import { ServersSection } from "@/components/home/servers-section";
import { Container, SectionHeading } from "@/components/shared/primitives";
import { JsonLd } from "@/components/shared/json-ld";
import { breadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Servers",
  description:
    "Connect to live WallBang CS2 retake servers in India. Open Counter-Strike 2 through Steam and join [WallBang] Retake #1 [HYD].",
  path: "/servers",
});

export default function ServersPage() {
  return (
    <div className="py-16 sm:py-20">
      <JsonLd
        id="ld-servers-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Servers", path: "/servers" },
        ])}
      />
      <Container>
        <SectionHeading
          eyebrow="Servers"
          title="Live WallBang CS2 servers"
          description="India-first retake servers with one-click Steam connect. More regions and modes will appear here as WallBang expands."
        />
      </Container>
      <ServersSection showHeading={false} />
    </div>
  );
}
