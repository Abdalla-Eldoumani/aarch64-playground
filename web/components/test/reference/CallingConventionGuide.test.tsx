// Pins the calling-convention guide: its thirteen sections in order with a
// contents link to each, the AAPCS64 statements the verifier checked against
// the spec, one runnable example at a time with the server's output beside
// it, and links to pitfall cards that exist.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("@/components/playground/EmbeddablePlayground", () => ({
  EmbeddablePlayground: ({ startSource }: { startSource: string }) => (
    <div data-testid="embed">{startSource.split("\n")[0]}</div>
  ),
}));

import { CallingConventionGuide } from "@/components/reference/CallingConventionGuide";
import { GUIDE_EXAMPLES } from "@/lib/content/calling-convention-examples";
import { PITFALLS } from "@/lib/content/pitfall-data";

const TITLES = [
  "Integer registers",
  "One vector register, many names",
  "What a call keeps of the vector registers",
  "Arguments past the eighth",
  "Structs as arguments",
  "Results larger than 16 bytes",
  "Variadic calls such as printf",
  "Saving callee-saved registers",
  "The frame record",
  "The frame chain",
  "Recursion, one frame per call",
  "16-byte stack alignment",
  "Rules that are easy to break",
];

beforeAll(async () => {
  // Warm the mocked embed's dynamic import so the first findBy does not
  // absorb the transform.
  await import("@/components/playground/EmbeddablePlayground");
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

function text(): string {
  return document.body.textContent ?? "";
}

describe("CallingConventionGuide", () => {
  it("heads thirteen sections, in order, each named by a level-two heading", () => {
    render(<CallingConventionGuide />);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(TITLES);
  });

  it("links the contents to every section, and every link resolves", () => {
    render(<CallingConventionGuide />);
    const nav = screen.getByRole("navigation", { name: "On this page" });
    // Two copies render (folded and rail); CSS shows one.
    const hrefs = within(nav)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href") ?? "");
    expect(hrefs.length).toBe(TITLES.length * 2);
    for (const href of hrefs) {
      expect(href.startsWith("#calling-convention-"), href).toBe(true);
      expect(document.getElementById(href.slice(1)), href).not.toBeNull();
    }
    const first = within(nav).getAllByRole("link", { name: /Integer registers/ })[0];
    expect(first.textContent).toBe("01Integer registers");
  });

  it("brings the section a link names into view once the guide renders", () => {
    const scrolled: string[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
    try {
      window.history.replaceState(null, "", "/reference#calling-convention-frame-chain");
      render(<CallingConventionGuide />);
      expect(scrolled).toContain("calling-convention-frame-chain");
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it("mounts every diagram", () => {
    render(<CallingConventionGuide />);
    for (const label of [
      "aapcs64 register file",
      "one vector register, every name",
      "aapcs64 vector register file",
      "the outgoing area at the bl",
      "print_multiples' frame",
      "frame walk",
      "three frame records, chained",
      "factorial walk",
      "stack alignment",
    ]) {
      expect(screen.getByLabelText(label), label).toBeTruthy();
    }
  });

  it("teaches the register views and the pc", () => {
    render(<CallingConventionGuide />);
    const body = text();
    expect(body).toContain("low 32 bits");
    expect(body).toContain("nothing is promised about the top half of x0");
    expect(body).toContain("There is no register named pc");
    expect(body).toContain("the pc moves on to the next one by itself");
    expect(body).not.toContain("only branches change it");
    expect(body).toContain("h0 the low 16 and b0 the low 8");
    expect(body).toContain("lane 0 at the low end");
  });

  it("teaches the vector registers' roles as AAPCS64 states them", () => {
    render(<CallingConventionGuide />);
    const body = text();
    expect(body).toContain("v0 to v7 carry the first eight");
    expect(body).toContain("callee-saved, but only their low 64 bits");
    expect(body).toContain("v0-v7 and v16-v31 are caller-saved");
  });

  it("teaches stack arguments, the separate banks, and no backfill", () => {
    render(<CallingConventionGuide />);
    const body = text();
    expect(body).toContain("each extra argument in its own 8-byte slot");
    expect(body).toContain("[fp, dealloc]");
    expect(body).toContain("[fp, 16] and [fp, 24]");
    expect(body).toContain("puts the doubles in d0-d2 and only the ninth long on the stack");
    expect(body).toContain("never into x7");
  });

  it("teaches struct passing, HFAs, and the x8 result", () => {
    render(<CallingConventionGuide />);
    const body = text();
    expect(body).toContain("A struct of up to 16 bytes travels by value");
    expect(body).toContain("passes the copy's address");
    expect(body).toContain("at most four of them");
    expect(body).toContain("consecutive v registers");
    expect(body).toContain("8 or 16 bytes each");
    expect(body).toContain("puts its address in x8");
  });

  it("says a float reaches printf widened to a double, and names Apple's difference", () => {
    render(<CallingConventionGuide />);
    const body = text();
    expect(body).toContain("C passes a float to a variadic routine as a double");
    expect(body).toContain("fcvt d1, s1");
    expect(body).toContain("Apple's arm64 passes every variadic argument in 8-byte stack slots");
    expect(body).not.toContain("before handing a float to");
  });

  it("teaches the course frame shape: locals above fp at positive offsets", () => {
    render(<CallingConventionGuide />);
    const body = text();
    expect(body).toContain("[fp, 16]");
    expect(body).not.toContain("[fp, -16]");
    expect(body).toContain("[sp, alloc]!");
    expect(body).toContain("[sp], dealloc");
  });

  it("places a misaligned sp's fault at the call into printf, where the server faults", () => {
    render(<CallingConventionGuide />);
    const body = text();
    expect(body).toContain("usually comes at the call into printf, in the short stub the linker puts in front of it");
    expect(body).not.toContain("deep inside printf");
  });

  it("shows each example's excerpt and the server's output beside it", () => {
    const { container } = render(<CallingConventionGuide />);
    const outputs = [...container.querySelectorAll("pre")].map((pre) => pre.textContent);
    for (const example of Object.values(GUIDE_EXAMPLES)) {
      expect(outputs, example.id).toContain(example.stdout);
    }
    expect(text()).toContain("str     x9, [sp]");
  });

  it("runs one example at a time and closes it again", async () => {
    render(<CallingConventionGuide />);
    const runTen = screen.getByRole("button", { name: "run the whole program: the ten-argument call" });
    fireEvent.click(runTen);
    expect((await screen.findByTestId("embed")).textContent).toBe(
      GUIDE_EXAMPLES["ten-arguments"].source.split("\n")[0],
    );
    expect(runTen.getAttribute("aria-pressed")).toBe("true");

    // Opening another closes the first.
    fireEvent.click(screen.getByRole("button", { name: "run the whole program: the factorial" }));
    const embeds = await screen.findAllByTestId("embed");
    expect(embeds.length).toBe(1);
    expect(embeds[0].textContent).toBe(GUIDE_EXAMPLES.factorial.source.split("\n")[0]);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "close the program: the factorial" }));
    });
    expect(screen.queryByTestId("embed")).toBeNull();
  });

  it("keeps a run button's width by swapping which label is invisible, not the text", () => {
    render(<CallingConventionGuide />);
    const button = screen.getByRole("button", { name: "run the whole program: the large result" });
    const label = (text: string) => within(button).getByText(text);
    expect(label("run the whole program").className).not.toContain("invisible");
    expect(label("close").className).toContain("invisible");
    fireEvent.click(button);
    expect(label("run the whole program").className).toContain("invisible");
    expect(label("close").className).not.toContain("invisible");
  });

  it("opens each example in the playground with its whole program", () => {
    render(<CallingConventionGuide />);
    const links = screen.getAllByRole("link", { name: /Open in playground/ });
    expect(links.length).toBe(Object.keys(GUIDE_EXAMPLES).length);
    for (const link of links) {
      expect(link.getAttribute("href")?.startsWith("/playground#p2=")).toBe(true);
    }
  });

  it("links only to pitfall cards that exist", () => {
    const { container } = render(<CallingConventionGuide />);
    const slugs = new Set(PITFALLS.map((p) => p.slug));
    const linked = [...container.querySelectorAll<HTMLAnchorElement>('a[href^="/reference#pitfall-"]')].map(
      (a) => a.getAttribute("href")!.replace("/reference#pitfall-", ""),
    );
    expect(linked.length).toBeGreaterThanOrEqual(10);
    for (const slug of linked) expect(slugs.has(slug), slug).toBe(true);
  });

  it("routes the prose through LessonMarkdown, so register names carry their roles", () => {
    render(<CallingConventionGuide />);
    expect(screen.getAllByText("printf", { selector: "code" }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByLabelText(/system call number \(x8\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/callee-saved register \(x19-x28\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/store pair; mirrors ldp/i).length).toBeGreaterThan(0);
  });
});
