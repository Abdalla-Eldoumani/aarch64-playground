import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { ToastHost } from "@/components/ui/Toast";
import { OfflineBadge } from "@/components/chrome/OfflineBadge";
import { RegisterSW } from "@/components/chrome/RegisterSW";
import { SHARE_CARD_IMAGE, SITE_URL } from "@/lib/content/site";

// Datasheet trio: Source Serif 4 in editorial chrome (reading-surface
// titles, leads, empty-state heads), IBM Plex Sans for UI controls, body,
// and display headlines, JetBrains Mono everywhere code, registers, labels,
// or document rules appear. Each font is pinned to a CSS variable so
// component-level utility classes can pull the right family without a
// Tailwind config rewrite.
const fontSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-serif",
});
const fontSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans",
});
const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-mono",
});

const DESCRIPTION =
  "Browser-based ARMv8 emulator with a visual debugger, tuned for the cpsc 355 tutorial corpus";

// Structured data, code-authored literals only: no user input reaches either
// object, so JSON.stringify into a ld+json script is the whole story. The
// WebSite entry names the site; the SoftwareApplication entry says what it is
// (a free, browser-run educational tool) for the search surfaces that show it.
const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "cpsc 355 playground",
  url: SITE_URL,
  description: DESCRIPTION,
};

const APPLICATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "cpsc 355 playground",
  url: SITE_URL,
  description: DESCRIPTION,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: 0,
    priceCurrency: "CAD",
  },
  audience: {
    "@type": "EducationalAudience",
    educationalRole: "student",
  },
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "cpsc 355 playground",
    template: "%s -- cpsc 355 playground",
  },
  description: DESCRIPTION,
  // Relative canonical: resolved against metadataBase, so the one origin above
  // is the only place the production host is written. Every addressable route
  // restates its own; the 404 deliberately has none.
  alternates: { canonical: "/" },
  // Search Console URL-prefix verification; the domain property is verified
  // via DNS separately, so this tag is a second anchor, not the primary.
  verification: { google: "RJmIR859S00gRMvoEXI-3lhiav4ygzIp6oUW6lP54j4" },
  openGraph: {
    type: "website",
    siteName: "cpsc 355 playground",
    title: "cpsc 355 playground",
    description: DESCRIPTION,
    url: "/",
    images: [SHARE_CARD_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "cpsc 355 playground",
    description: DESCRIPTION,
    images: [SHARE_CARD_IMAGE],
  },
};

export const viewport: Viewport = {
  // `viewport-fit=cover` lets the safe-area CSS vars we read in globals.css
  // receive real values on notched devices; without it they're 0.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // One entry per OS preference, matching the --bg-base of the theme the
  // pre-paint script picks: an OS-light visitor gets a light browser chrome
  // around a light first paint instead of a dark band above it.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FCFCFD" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0C10" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fontClasses = `${fontSerif.variable} ${fontSans.variable} ${fontMono.variable}`;
  return (
    // suppressHydrationWarning covers exactly one attribute mismatch: the
    // pre-paint script below writes data-theme before React hydrates, so a
    // saved light/high-contrast theme differs from the server markup by
    // design. The suppression scopes to this element only.
    <html lang="en" className={fontClasses} suppressHydrationWarning>
      <head>
        {/* Set data-theme from the saved preference BEFORE first paint, so a
            light or high-contrast user does not see a flash of the default
            dark theme every load. With nothing saved the OS preference
            decides: an OS-light first visitor used to get a dark first paint
            that only healed after hydration. Nothing is persisted here -- the
            choice is still the student's to make; use-theme writes on mount.
            Static, code-authored script (no user input); the CSP permits
            inline scripts. Kept in lockstep with the
            "aarch64-playground:theme" key in lib/hooks/use-theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var d=document.documentElement,t=localStorage.getItem("aarch64-playground:theme");if(t==="light"||t==="dark"||t==="high-contrast")d.setAttribute("data-theme",t);else if(window.matchMedia("(prefers-color-scheme: light)").matches)d.setAttribute("data-theme","light");}catch(e){}',
          }}
        />
      </head>
      <body className="flex flex-col min-h-dvh font-mono">
        {/* First focusable element in the document: a keyboard visitor reaches
            the page's own content in one tab instead of walking the nav on
            every route. Every route renders exactly one <main id="main">. */}
        <a href="#main" className="skip-link">
          skip to content
        </a>
        <RegisterSW />
        <OfflineBadge />
        <ToastHost>{children}</ToastHost>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSON_LD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(APPLICATION_JSON_LD) }}
        />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
