// Single source of truth for the site's routes and canonical URLs. The nav, the
// footer, the sitemap, and the robots entry all read from here, so the route list
// and the deployed/repository URLs never drift apart across those surfaces.

export const SITE_URL = "https://aarch64-playground.com";
export const REPO_URL = "https://github.com/Abdalla-Eldoumani/aarch64-playground";

// The cover messengers unfurl. Open Graph and Twitter cards do not deep-merge
// across route segments, so every restated card pulls this one image; the url
// stays relative and resolves through metadataBase to the production origin.
export const SHARE_CARD_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "cpsc 355 playground: the debugger mid-step, with the current instruction and a changed register highlighted",
} as const;

// Credibility: the facts the footer states, kept here so the copy has one
// source. The license link is derived from REPO_URL so the repository address
// has one source too.
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
export const LICENSE_LABEL = "AGPL-3.0";

export const CREDIBILITY = {
  tagline:
    "A browser-based AArch64 emulator and visual debugger for studying assembly.",
  courseContext: "A study aid for the CPSC 355 assembly course.",
  disclaimer:
    "Built for CPSC 355. Not officially affiliated with the University of Calgary.",
  engineNote: "a hand-written Rust interpreter compiled to WebAssembly",
  // The host's analytics are cookieless aggregate counts; everything a
  // student writes stays in their browser.
  privacyNote: "No accounts · cookieless visit counts only · programs stay in your browser",
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
