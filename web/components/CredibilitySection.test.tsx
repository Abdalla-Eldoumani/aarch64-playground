import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CredibilitySection } from "./CredibilitySection";
import { REPO_URL, CREDIBILITY } from "@/lib/site";

afterEach(() => cleanup());

describe("CredibilitySection", () => {
  it("renders the disclaimer and the Rust-to-WASM note from the shared constants", () => {
    render(<CredibilitySection />);
    // Read the same constants the component reads, so a future drift in site.ts
    // fails here instead of passing against a hard-coded copy in the section.
    expect(screen.getByText(CREDIBILITY.disclaimer)).toBeTruthy();
    expect(screen.getByText(CREDIBILITY.engineNote)).toBeTruthy();
  });

  it("links the repository and the MIT license, both rel-hardened", () => {
    render(<CredibilitySection />);
    const links = screen.getAllByRole("link");

    const repo = links.find((l) => l.getAttribute("href") === REPO_URL);
    expect(repo).toBeTruthy();
    expect(repo!.getAttribute("rel")).toBe("noreferrer noopener");

    const license = links.find((l) =>
      l.getAttribute("href")?.endsWith("/blob/main/LICENSE"),
    );
    expect(license).toBeTruthy();
    expect(license!.getAttribute("rel")).toBe("noreferrer noopener");
  });

  it("gives the inline license link a persistent underline, not a hover-only one", () => {
    render(<CredibilitySection />);
    const license = screen
      .getAllByRole("link")
      .find((l) => l.getAttribute("href")?.endsWith("/blob/main/LICENSE"));
    expect(license).toBeTruthy();
    // The license link sits inline in a sentence, so it must be distinguishable
    // without relying on color: a standalone "underline" utility that holds at
    // rest, never only "hover:underline". This guards the fixed
    // link-in-text-block.
    expect(license!.classList.contains("underline")).toBe(true);
    expect(license!.className).not.toContain("hover:underline");
  });

  it("leaks no email and no author name into the rendered body", () => {
    const { container } = render(<CredibilitySection />);
    expect(container.textContent).not.toMatch(/@/);
    // Derive the author handle from the single repo source rather than hardcode
    // it, so the test asserts the name's absence without itself embedding the
    // author's name. The owner segment of REPO_URL (and its first token) must
    // not appear in the rendered body -- the name lives in the LICENSE only.
    const owner = new URL(REPO_URL).pathname.split("/").filter(Boolean)[0];
    expect(container.textContent).not.toContain(owner);
    expect(container.textContent).not.toContain(owner.split("-")[0]);
  });
});
