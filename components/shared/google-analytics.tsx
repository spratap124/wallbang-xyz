import Script from "next/script";

import { gaMeasurementId, isGaWebConfigured } from "@/lib/analytics/gtag";

/**
 * Google tag (gtag.js) for the whole app. Renders nothing until
 * NEXT_PUBLIC_GA_MEASUREMENT_ID is set. Page views for client-side
 * navigations are sent by `GoogleAnalyticsPageTracker`; the `_ga` cookie
 * value never leaves the browser except as a numeric client id captured at
 * checkout.
 */
export function GoogleAnalytics() {
  if (!isGaWebConfigured()) return null;
  const measurementId = gaMeasurementId();

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}', {
  send_page_view: false,
  page_location: window.location.origin + window.location.pathname,
});`}
      </Script>
    </>
  );
}
