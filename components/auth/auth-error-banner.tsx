"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const MESSAGES: Record<string, string> = {
  failed: "Steam sign-in failed. Please try again.",
  unavailable: "Steam sign-in is temporarily unavailable.",
  database: "Sign-in could not reach the database. Try again later.",
  rate_limit: "Too many sign-in attempts. Wait a moment and try again.",
};

export function AuthErrorBanner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const code = searchParams.get("authError");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setMessage(null);
      return;
    }
    setMessage(MESSAGES[code] ?? "Sign-in failed. Please try again.");
    const next = new URLSearchParams(searchParams.toString());
    next.delete("authError");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [code, pathname, router, searchParams]);

  if (!message) return null;

  return (
    <div
      role="alert"
      className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive"
    >
      {message}
    </div>
  );
}
