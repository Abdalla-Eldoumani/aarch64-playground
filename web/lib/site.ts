// Single source of truth for the site's routes and canonical URLs. The nav, the
// footer, the sitemap, and the robots entry all read from here, so the route list
// and the deployed/repository URLs never drift apart across those surfaces.

export const SITE_URL = "https://aarch64-playground.vercel.app";
export const REPO_URL = "https://github.com/Abdalla-Eldoumani/aarch64-playground";

// Credibility: the facts the footer and the credibility section both state, kept
// here as the single source so the two surfaces can never drift apart. The
// license link is derived from REPO_URL so the repository address has one source.
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
export const LICENSE_LABEL = "MIT";

export const CREDIBILITY = {
  // One-line description of what the project is.
  tagline:
    "A browser-based AArch64 emulator and visual debugger for studying assembly.",
  // The course this is a study aid for.
  courseContext: "A study aid for the CPSC 355 assembly course.",
  // The not-affiliated disclaimer.
  disclaimer:
    "Built for CPSC 355. Not officially affiliated with the University of Calgary.",
  // How the emulator is built (the credibility section's headline note).
  engineNote: "a hand-written Rust interpreter compiled to WebAssembly",
} as const;

export interface NavRoute {
  label: string;
  href: string;
}

// Display labels are capitalized; hrefs stay lowercase. Order is the nav order.
export const NAV_ROUTES: NavRoute[] = [
  { label: "Playground", href: "/playground" },
  { label: "Learn", href: "/learn" },
  { label: "Practice", href: "/practice" },
  { label: "Reference", href: "/reference" },
];

// The active-route rule, shared by the inline nav and the mobile drawer so the
// two can never disagree: an exact match for the path, or (for non-root routes)
// any path nested beneath it, so /learn stays marked while on /learn/loops.
export function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
