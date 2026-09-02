// Pins the playground route's chrome data: the layout runs the same star
// lookup the content layout runs and puts the count where the page reads it,
// so the slim bar wears it, and a failed lookup still reaches the nav as null.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const fetchStarCount = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/github", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/content/github")>()),
  fetchStarCount,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/playground" }));

import PlaygroundLayout from "@/app/playground/layout";
import { SiteNav } from "@/components/chrome/SiteNav";
import { useStarCount } from "@/components/chrome/StarCount";

// The two lines the playground page itself carries: read the count the layout
// looked up, hand it to the slim bar.
function NavProbe() {
  return <SiteNav variant="slim" stars={useStarCount()} />;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PlaygroundLayout", () => {
  it("passes the looked-up count down to the slim nav", async () => {
    fetchStarCount.mockResolvedValue(214);
    render(await PlaygroundLayout({ children: <NavProbe /> }));
    expect(fetchStarCount).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("link", { name: "source on github, 214 stars" }),
    ).toBeTruthy();
  });

  it("leaves the nav on its icon-only link when the lookup fails", async () => {
    fetchStarCount.mockResolvedValue(null);
    render(await PlaygroundLayout({ children: <NavProbe /> }));
    expect(screen.getByRole("link", { name: "source on github" })).toBeTruthy();
  });
});
