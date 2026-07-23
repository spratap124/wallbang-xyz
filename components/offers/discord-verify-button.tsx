"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type VerifyResponse = {
  ok: boolean;
  data?: { status: string };
  error?: string;
};

export function DiscordVerifyButton({
  className,
}: {
  className?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/discord/verify", {
          method: "POST",
        });
        const json = (await res.json()) as VerifyResponse;
        if (!json.ok) {
          setError(json.error ?? "Verification failed.");
          return;
        }
        router.refresh();
      } catch {
        setError("Verification failed. Try again.");
      }
    });
  }

  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        disabled={pending}
        onClick={onClick}
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        {pending ? "Checking…" : "I've joined — verify membership"}
      </button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
