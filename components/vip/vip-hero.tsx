import Image from "next/image";
import { Lock, RefreshCcw, Shield, Zap } from "lucide-react";

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
    body: "Safe, encrypted checkout.",
  },
  {
    icon: Zap,
    title: "Instant VIP Activation",
    body: "Access granted right after payment.",
  },
  {
    icon: RefreshCcw,
    title: "You're in control",
    body: "VIP ends when the term ends.",
  },
] as const;

export function VipHero() {
  return (
    <div className="bg-[#080a0c]">
      {/* ── Hero image + headline ── */}
      <section className="relative">
        <div
          className="relative flex justify-center overflow-hidden"
          style={{ height: "clamp(220px, 40vw, 300px)" }}
        >
          <div className="relative h-full w-full lg:w-[44%]">
            <Image
              src="/vip-hero.png"
              alt="WallBang VIP — tactical soldier on Mirage"
              fill
              priority
              sizes="44vw"
              className="object-cover object-center"
            />
          </div>
          {/* Left gradient keeps text readable */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(8,10,12,0.3) 0%, rgba(8,10,12,0.75) 100%), linear-gradient(90deg, rgba(8,10,12,0.97) 0%, rgba(8,10,12,0.90) 30%, rgba(8,10,12,0.60) 52%, rgba(8,10,12,0.0) 75%)",
            }}
            aria-hidden
          />

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
            </Container>
          </div>
        </div>
      </section>

      {/* ── Trust strip ── */}
      <div className="bg-[#080a0c]">
        <Container>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-5 py-6 sm:grid-cols-4 sm:gap-x-8">
            {trustItems.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <item.icon className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-bold tracking-[0.08em] uppercase">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </div>
    </div>
  );
}
