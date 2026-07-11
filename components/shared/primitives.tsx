import Link from "next/link";

import { cn } from "@/lib/utils";

type ContainerProps = {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "main";
};

export function Container({
  children,
  className,
  as: Comp = "div",
}: ContainerProps) {
  return <Comp className={cn("container-wb", className)}>{children}</Comp>;
}

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  align?: "left" | "center";
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
  align = "left",
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "mb-10 max-w-2xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow ? (
        <p className="mb-3 text-xs font-medium tracking-[0.2em] text-primary uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty">
          {description}
        </p>
      ) : null}
    </div>
  );
}

type BrandMarkProps = {
  className?: string;
  as?: "span" | "p" | "h1" | "h2";
  children?: React.ReactNode;
};

export function BrandMark({
  className,
  as: Comp = "span",
  children = "WallBang",
}: BrandMarkProps) {
  return <Comp className={cn("brand-mark", className)}>{children}</Comp>;
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "brand-mark inline-block text-xl text-foreground transition-colors hover:text-primary",
        className,
      )}
      aria-label="WallBang home"
    >
      WallBang
    </Link>
  );
}
