import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

export const brandLogoSrc = "/logo.png";

type BrandLogoProps = {
  className?: string;
  alt?: string;
  priority?: boolean;
};

export function BrandLogo({
  className,
  alt = "WallBang",
  priority = false,
}: BrandLogoProps) {
  return (
    <Image
      src={brandLogoSrc}
      alt={alt}
      width={1024}
      height={1024}
      className={cn("rounded-md", className)}
      priority={priority}
    />
  );
}

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

export function Logo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2.5 text-foreground transition-colors hover:text-primary",
        className,
      )}
      aria-label="WallBang home"
    >
      <BrandLogo alt="" className="size-8" priority={priority} />
      <span className="brand-mark text-xl">WallBang</span>
    </Link>
  );
}
