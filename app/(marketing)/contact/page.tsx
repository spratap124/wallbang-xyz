import { Container, SectionHeading } from "@/components/shared/primitives";
import { buttonVariants } from "@/components/ui/button";
import { JsonLd } from "@/components/shared/json-ld";
import { siteConfig } from "@/config/site";
import { breadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";
import { cn } from "@/lib/utils";

export const metadata = createPageMetadata({
  title: "Contact",
  description:
    "Contact WallBang via Discord for CS2 retake server support, VIP questions, partnerships, and community feedback.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <div className="py-16 sm:py-20">
      <JsonLd
        id="ld-contact-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ])}
      />
      <Container>
        <SectionHeading
          eyebrow="Contact"
          title="Talk to the WallBang team"
          description="Discord is the primary contact channel for support, feedback, partnerships, and launch updates."
        />

        <div className="max-w-xl rounded-xl border border-border bg-card/50 p-8">
          <h2 className="text-xl font-semibold">Discord community</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Join the WallBang Discord for India-first CS2 retake updates, moderation help,
            and direct access to the team building the platform.
          </p>
          <a
            href={siteConfig.discordUrl}
            rel="noopener noreferrer"
            className={cn(buttonVariants({ size: "lg" }), "mt-6 inline-flex")}
          >
            Open Discord
          </a>
          <p className="mt-6 text-xs text-muted-foreground">
            Prefer email later? A formal support inbox will be published with platform
            auth. Until then, Discord is the source of truth.
          </p>
        </div>
      </Container>
    </div>
  );
}
