import Link from "next/link";
import {
  BarChart3,
  Calendar,
  Crosshair,
  Crown,
  Hand,
  LogIn,
  Medal,
  MessageCircle,
  Network,
  Rocket,
  Sword,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Container, SectionHeading } from "@/components/shared/primitives";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { features } from "@/content/features";
import { cn } from "@/lib/utils";

const iconMap: Record<string, LucideIcon> = {
  Zap,
  Crown,
  Sword,
  Crosshair,
  Hand,
  BarChart3,
  Trophy,
  LogIn,
  MessageCircle,
  Network,
  Calendar,
  Rocket,
  Users,
  Medal,
};

type FeaturesSectionProps = {
  limit?: number;
  showViewAll?: boolean;
};

export function FeaturesSection({
  limit,
  showViewAll = true,
}: FeaturesSectionProps) {
  const items = typeof limit === "number" ? features.slice(0, limit) : features;

  return (
    <section id="features" className="py-20 sm:py-24">
      <Container>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            eyebrow="Features"
            title="Built for the full competitive lifecycle"
            description="Retakes today. Profiles, VIP cosmetics, statistics, and tournaments as WallBang scales into a complete CS2 platform."
            className="mb-0"
          />
          {showViewAll ? (
            <Link
              href="/features"
              className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
            >
              View all features
            </Link>
          ) : null}
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((feature) => {
            const Icon = iconMap[feature.icon] ?? Zap;
            return (
              <Card
                key={feature.id}
                className="border-border/80 bg-card/60 transition-colors hover:border-primary/40"
              >
                <CardHeader className="gap-3">
                  <div className="flex size-10 items-center justify-center rounded-md border border-border bg-secondary text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
