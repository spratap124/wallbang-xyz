import { DedicatedServersPage } from "@/components/servers/dedicated-servers-page";
import { LiveServersProvider } from "@/components/servers/live-servers-provider";
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
      <LiveServersProvider>
        <DedicatedServersPage />
      </LiveServersProvider>
    </div>
  );
}
