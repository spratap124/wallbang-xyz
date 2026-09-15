import { ServersSection } from "@/components/home/servers-section";
import { LiveServersProvider } from "@/components/servers/live-servers-provider";
import { Container, SectionHeading } from "@/components/shared/primitives";
import { JsonLd } from "@/components/shared/json-ld";
import { breadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Servers",
  description:
    "Connect to live WallBang Counter-Strike 2 community servers hosted in India. Open CS2 through Steam and join any online WallBang server. WallBang does not sell the game.",
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
          description="India-hosted Counter-Strike 2 community retake servers with one-click Steam connect. You must already own the game. More regions and modes will appear here as WallBang expands."
        />
      </Container>
      <LiveServersProvider>
        <ServersSection showHeading={false} />
      </LiveServersProvider>
    </div>
  );
}
