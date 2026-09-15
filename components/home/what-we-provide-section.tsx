import {
  Lock,
  Server,
  Timer,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Container, SectionHeading } from "@/components/shared/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { wallbangProvides } from "@/content/business";

const iconMap: Record<string, LucideIcon> = {
  Server,
  Users,
  Wrench,
  Lock,
  Timer,
  Zap,
};

export function WhatWeProvideSection() {
  return (
    <section id="what-we-provide" className="py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Infrastructure"
          title="What WallBang provides"
          description="WallBang is the independent company operating and hosting Counter-Strike 2 community server infrastructure in India. These are services we provide — not the game itself."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wallbangProvides.map((item) => {
            const Icon = iconMap[item.icon] ?? Server;
            return (
              <Card
                key={item.id}
                className="border-border/80 bg-card/60 transition-colors hover:border-primary/40"
              >
                <CardHeader className="gap-3">
                  <div className="flex size-10 items-center justify-center rounded-md border border-border bg-secondary text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {item.description}
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
