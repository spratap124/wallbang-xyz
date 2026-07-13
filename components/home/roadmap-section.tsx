import Link from "next/link";

import { Container, SectionHeading } from "@/components/shared/primitives";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { roadmap } from "@/content/roadmap";
import { cn } from "@/lib/utils";

const statusLabel = {
  planned: "Planned",
  "in-progress": "In progress",
  completed: "Live",
} as const;

type RoadmapSectionProps = {
  showViewAll?: boolean;
  showHeading?: boolean;
};

export function RoadmapSection({
  showViewAll = true,
  showHeading = true,
}: RoadmapSectionProps) {
  return (
    <section id="roadmap" className="py-20 sm:py-24">
      <Container>
        {showHeading ? (
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              eyebrow="Roadmap"
              title="Retakes are live. The platform comes next."
              description="Phase 1 public retakes are online in Mumbai. Next up: VIP, Steam login, and player statistics — then profiles, rankings, and tournaments."
              className="mb-0"
            />
            {showViewAll ? (
              <Link
                href="/roadmap"
                className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
              >
                Full roadmap
              </Link>
            ) : null}
          </div>
        ) : null}

        <ol className={cn("space-y-6", showHeading && "mt-12")}>
          {roadmap.map((phase) => (
            <li
              key={phase.id}
              className="grid gap-4 rounded-xl border border-border bg-card/50 p-6 md:grid-cols-[12rem_1fr]"
            >
              <div>
                <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                  {phase.phase}
                </p>
                <h3 className="mt-2 text-xl font-semibold">{phase.title}</h3>
                <Badge
                  variant="secondary"
                  className={cn(
                    "mt-3",
                    phase.status === "completed" &&
                      "bg-primary/15 text-primary hover:bg-primary/15",
                    phase.status === "in-progress" &&
                      "bg-foreground/10 text-foreground hover:bg-foreground/10",
                  )}
                >
                  {statusLabel[phase.status]}
                </Badge>
              </div>
              <ul className="space-y-2">
                {phase.items.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-sm leading-relaxed text-muted-foreground"
                  >
                    <span
                      className={cn(
                        "mt-2 size-1.5 shrink-0 rounded-full",
                        phase.status === "completed" ? "bg-primary" : "bg-border",
                        phase.status === "in-progress" && "bg-primary/70",
                      )}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
