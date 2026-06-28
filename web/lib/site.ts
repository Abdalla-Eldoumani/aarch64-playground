// Single source of truth for the site's routes and canonical URLs. The nav, the
// footer, the sitemap, and the robots entry all read from here, so the route list
// and the deployed/repository URLs never drift apart across those surfaces.

export const SITE_URL = "https://aarch64-playground.vercel.app";
export const REPO_URL = "https://github.com/Abdalla-Eldoumani/aarch64-playground";

export interface NavRoute {
  label: string;
  href: string;
}

// Display labels are capitalized; hrefs stay lowercase. Order is the nav order.
export const NAV_ROUTES: NavRoute[] = [
  { label: "Playground", href: "/" },
  { label: "Learn", href: "/learn" },
  { label: "Practice", href: "/practice" },
  { label: "Reference", href: "/reference" },
];
