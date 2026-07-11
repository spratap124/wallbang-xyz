import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="container-wb flex min-h-[70svh] flex-col items-center justify-center py-20 text-center">
      <p className="text-xs tracking-[0.2em] text-primary uppercase">404</p>
      <h1 className="mt-4 text-4xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        That route does not exist yet. Head home or jump into Discord while WallBang
        keeps shipping.
      </p>
      <Link href="/" className={cn(buttonVariants({ size: "lg" }), "mt-8")}>
        Back to home
      </Link>
    </div>
  );
}
