"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

// A share link's program (#p2=) and a diagnostic link's bundle (#bundle=)
// live after the `#`, so the address each event carries stops before it.
function withoutFragment<T extends { url: string }>(event: T): T {
  const hash = event.url.indexOf("#");
  return hash === -1 ? event : { ...event, url: event.url.slice(0, hash) };
}

export function SiteAnalytics() {
  return (
    <>
      <Analytics beforeSend={withoutFragment} />
      <SpeedInsights beforeSend={withoutFragment} />
    </>
  );
}
