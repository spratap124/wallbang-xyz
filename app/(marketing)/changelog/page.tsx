import { Container, SectionHeading } from "@/components/shared/primitives";
import { JsonLd } from "@/components/shared/json-ld";
import { changelog } from "@/content/changelog";
import { breadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Changelog",
  description:
    "WallBang product changelog: website foundation, plugin stack updates, and CS2 platform milestones.",
  path: "/changelog",
});

export default function ChangelogPage() {
  return (
    <div className="py-16 sm:py-20">
      <JsonLd
        id="ld-changelog-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Changelog", path: "/changelog" },
        ])}
      />
      <Container>
        <SectionHeading
          eyebrow="Changelog"
          title="What shipped"
          description="Transparent progress across the WallBang website, plugin stack, and platform foundations."
        />

        <ol className="space-y-8">
          {changelog.map((entry) => (
            <li
              key={entry.id}
              className="rounded-xl border border-border bg-card/50 p-6"
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <p className="font-mono text-sm text-primary">{entry.version}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(entry.date).toLocaleDateString("en-IN", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <h2 className="mt-3 text-xl font-semibold">{entry.title}</h2>
              <ul className="mt-4 space-y-2">
                {entry.highlights.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-sm leading-relaxed text-muted-foreground"
                  >
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Container>
    </div>
  );
}
