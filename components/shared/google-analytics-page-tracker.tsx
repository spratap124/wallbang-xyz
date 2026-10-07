"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { trackGaEvent } from "@/lib/analytics/gtag";

/**
 * Sends page_view on client-side navigations (the tag is configured with
 * send_page_view: false). Query params are stripped so session references and
 * payment tokens never reach Google (PII + noise).
 */
export function GoogleAnalyticsPageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    trackGaEvent("page_view", {
      page_path: pathname,
      page_location:
        window.location.origin + window.location.pathname,
      page_title: document.title,
    });
  }, [pathname]);

  return null;
}
