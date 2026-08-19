import Image from "next/image";
import { Lock, RefreshCcw, Shield } from "lucide-react";

import { Container } from "@/components/shared/primitives";

const trustItems = [
  {
    icon: Shield,
    title: "Premium Retake Servers",
    body: "Low ping. High performance.",
  },
  {
    icon: Lock,
    title: "Secure & Reliable",
    body: "Safe payments via Razorpay.",
  },
  {
    icon: RefreshCcw,
    title: "You're in control",
    body: "VIP ends when the term ends.",
  },
] as const;

export function VipHero() {
  return (
    <section className="relative border-b border-border bg-[#080a0c]">
      {/* Image at 44% width, centred horizontally, fixed max height */}
      <div
        className="relative flex justify-center overflow-hidden"
        style={{ height: "clamp(220px, 40vw, 300px)" }}
      >
        <div className="relative h-full w-[44%]">
          <Image
            src="/vip-hero.png"
            alt="WallBang VIP — tactical soldier on Mirage"
            fill
            priority
            sizes="44vw"
            className="object-cover object-center"
          />
        </div>
        {/* Left → center gradient keeps text readable */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(8,10,12,0.97) 0%, rgba(8,10,12,0.90) 30%, rgba(8,10,12,0.60) 52%, rgba(8,10,12,0.0) 75%)",
          }}
          aria-hidden
        />
        {/* Bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent" aria-hidden />

        {/* Text overlay — left-aligned, vertically centred */}
        <div className="absolute inset-0 flex items-center">
          <Container>
            <h1 className="max-w-lg text-4xl font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Unlock WallBang VIP
            </h1>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground sm:text-base">
              Choose the servers you want access to, pick a duration, and pay once.
              No auto-charge. Renew only when you want.
            </p>

            <ul className="mt-6 flex flex-col gap-3 sm:flex-row sm:gap-8">
              {trustItems.map((item) => (
                <li key={item.title} className="flex items-start gap-2">
                  <item.icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-[0.68rem] font-bold tracking-[0.14em] uppercase">
                      {item.title}
                    </p>
                    <p className="text-[0.68rem] text-muted-foreground">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Container>
        </div>
      </div>
    </section>
  );
}
