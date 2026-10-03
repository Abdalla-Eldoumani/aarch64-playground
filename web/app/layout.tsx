import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { ToastHost } from "@/components/ui/Toast";
import { OfflineBadge } from "@/components/chrome/OfflineBadge";
import { RegisterSW } from "@/components/chrome/RegisterSW";
import { HOME_DESCRIPTION, HOME_TITLE, SITE_NAME, SITE_URL } from "@/lib/content/site";
import { composeTitle, pageMetadata } from "@/lib/content/seo";
import { PRE_PAINT_SCRIPT } from "@/lib/theme/pre-paint";
import { THEME_TOKENS } from "@/lib/theme/tokens";

// Each font is bound to a CSS variable so utility classes and the --type-*
// tokens in globals.css can pick a family without a Tailwind config change.
// The files live in app/fonts (each with its OFL license), so a build needs
// no font download. Each is the variable Latin subset of the family, and
// `weight` is the range that file covers. A character outside the subset (no
// page of the site uses one; a student's program might) takes the fallback
// face; add the latin-ext file if a page ever needs one.
const fontSerif = localFont({
  src: "./fonts/source-serif-4-latin.woff2",
  weight: "200 900",
  // Upright only: the drawn italic would be one more file on every route for
  // two small captions, which keep `italic` and take the browser's
  // synthesized oblique.
  display: "swap",
  adjustFontFallback: "Times New Roman",
  variable: "--font-serif",
});
const fontSans = localFont({
  src: "./fonts/ibm-plex-sans-latin.woff2",
  weight: "100 700",
  display: "swap",
  variable: "--font-sans",
});
const fontMono = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  weight: "400 800",
  display: "swap",
  variable: "--font-mono",
});

// The home page's card and canonical, as the fallback for any page that
// states none. Relative urls resolve against metadataBase, so the https
// origin is written once. Structured data lives on the pages it describes.
export const metadata: Metadata = {
  ...pageMetadata({ title: HOME_TITLE, description: HOME_DESCRIPTION, path: "/" }),
  metadataBase: new URL(SITE_URL),
  title: {
    default: composeTitle(HOME_TITLE),
    template: `%s · ${SITE_NAME}`,
  },
  // iOS before 16.4 ignores the web manifest and reads a home-screen app's
  // name and standalone launch from these tags.
  appleWebApp: { capable: true, title: SITE_NAME },
  // Search Console URL-prefix verification; the domain property is verified
  // via DNS separately, so this tag is a second anchor, not the primary.
  verification: { google: "RJmIR859S00gRMvoEXI-3lhiav4ygzIp6oUW6lP54j4" },
};

export const viewport: Viewport = {
  // `viewport-fit=cover` lets the safe-area CSS vars we read in globals.css
  // receive real values on notched devices; without it they're 0.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // A soft keyboard shrinks the layout, not just the visible part, so the
  // playground's bottom bars sit above it instead of behind it on Android.
  interactiveWidget: "resizes-content",
  // One entry per OS preference, for a browser that runs no script. The
  // pre-paint script puts the chosen theme's colour in front of both.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_TOKENS.light["bg-base"] },
    { media: "(prefers-color-scheme: dark)", color: THEME_TOKENS.dark["bg-base"] },
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
    // pre-paint script below writes data-theme before React hydrates, so the
    // attribute differs from the server markup by design. The suppression
    // scopes to this element only.
    <html lang="en" className={fontClasses} suppressHydrationWarning>
      <head>
        {/* Runs before first paint so a saved theme never flashes another on
            load; with nothing saved, the OS decides. A fixed script built
            from the theme list, with no user input, which the CSP allows. */}
        <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_SCRIPT }} />
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
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
