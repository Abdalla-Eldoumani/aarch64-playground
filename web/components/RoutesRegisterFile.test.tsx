import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RoutesRegisterFile } from "./RoutesRegisterFile";
import { ROUTE_REGISTERS } from "@/lib/landing-content";

afterEach(() => cleanup());

describe("RoutesRegisterFile", () => {
  it("renders exactly one link per route with the canonical hrefs", () => {
    render(<RoutesRegisterFile />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);

    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toEqual(
      expect.arrayContaining(["/playground", "/learn", "/practice", "/reference"]),
    );

    // Data-driven: every ROUTE_REGISTERS href renders, so the block can never
    // drift from the single route source.
    for (const route of ROUTE_REGISTERS) {
      expect(hrefs).toContain(route.href);
    }
  });

  it("marks Open the playground as the primary destination at /playground", () => {
    render(<RoutesRegisterFile />);
    const primary = ROUTE_REGISTERS.find((r) => r.primary);
    expect(primary).toBeTruthy();
    expect(primary!.label).toBe("Open the playground");
    expect(primary!.href).toBe("/playground");

    const link = screen.getByRole("link", { name: /open the playground/i });
    expect(link.getAttribute("href")).toBe("/playground");
  });

  it("renders each register label as text (the register-file motif is data-driven)", () => {
    render(<RoutesRegisterFile />);
    for (const route of ROUTE_REGISTERS) {
      expect(screen.getByText(route.reg)).toBeTruthy();
    }
  });
});
