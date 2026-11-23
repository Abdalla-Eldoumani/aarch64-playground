// Pins that analytics and speed measurements record a page's address without
// the part after `#`, where a share link's program and a diagnostic link's
// bundle live: the query and every other field of the event are kept.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

type BeforeSend = (event: Record<string, unknown>) => unknown;

// The real components inject a vendor script, so both are replaced by stubs
// that keep the beforeSend each one is given.
const received = vi.hoisted(() => ({}) as { analytics?: BeforeSend; speedInsights?: BeforeSend });
vi.mock("@vercel/analytics/next", () => ({
  Analytics: ({ beforeSend }: { beforeSend?: BeforeSend }) => {
    received.analytics = beforeSend;
    return null;
  },
}));
vi.mock("@vercel/speed-insights/next", () => ({
  SpeedInsights: ({ beforeSend }: { beforeSend?: BeforeSend }) => {
    received.speedInsights = beforeSend;
    return null;
  },
}));

import { SiteAnalytics } from "@/components/chrome/SiteAnalytics";

function analytics(): BeforeSend {
  expect(typeof received.analytics).toBe("function");
  return received.analytics as BeforeSend;
}

function speedInsights(): BeforeSend {
  expect(typeof received.speedInsights).toBe("function");
  return received.speedInsights as BeforeSend;
}

beforeEach(() => {
  delete received.analytics;
  delete received.speedInsights;
  render(<SiteAnalytics />);
});

afterEach(cleanup);

describe("analytics", () => {
  it("sends a share link's page view without its program", () => {
    const event = {
      type: "pageview",
      url: "https://aarch64-playground.com/playground?example=hello#p2=N4IgzgplAuIE4FcCmQ",
    };
    expect(analytics()(event)).toEqual({
      type: "pageview",
      url: "https://aarch64-playground.com/playground?example=hello",
    });
  });

  it("sends a diagnostic link's event without its bundle", () => {
    const event = {
      type: "event",
      url: "https://aarch64-playground.com/playground#bundle=N4IgbiBcBMA0I",
    };
    expect(analytics()(event)).toEqual({
      type: "event",
      url: "https://aarch64-playground.com/playground",
    });
  });

  it("sends an address with no fragment as it is", () => {
    const event = { type: "pageview", url: "https://aarch64-playground.com/learn?tab=2" };
    expect(analytics()(event)).toEqual({
      type: "pageview",
      url: "https://aarch64-playground.com/learn?tab=2",
    });
  });
});

describe("speed insights", () => {
  it("sends a diagnostic link's vital without its bundle, keeping the route", () => {
    const event = {
      type: "vital",
      url: "https://aarch64-playground.com/playground?run=1#bundle=N4IgbiBcBMA0I",
      route: "/playground",
    };
    expect(speedInsights()(event)).toEqual({
      type: "vital",
      url: "https://aarch64-playground.com/playground?run=1",
      route: "/playground",
    });
  });

  it("sends a share link's vital without its program", () => {
    const event = {
      type: "vital",
      url: "https://aarch64-playground.com/playground#p2=N4IgzgplAuIE4FcCmQ",
      route: "/playground",
    };
    expect(speedInsights()(event)).toEqual({
      type: "vital",
      url: "https://aarch64-playground.com/playground",
      route: "/playground",
    });
  });

  it("sends an address with no fragment as it is", () => {
    const event = { type: "vital", url: "https://aarch64-playground.com/", route: "/" };
    expect(speedInsights()(event)).toEqual({
      type: "vital",
      url: "https://aarch64-playground.com/",
      route: "/",
    });
  });
});
