import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { ToastHost } from "@/components/ui/Toast";
import { OfflineBadge } from "@/components/chrome/OfflineBadge";
import { RegisterSW } from "@/components/chrome/RegisterSW";
import { HOME_DESCRIPTION, HOME_TITLE, SITE_NAME, SITE_URL } from "@/lib/content/site";
import { composeTitle, pageMetadata } from "@/lib/content/seo";

// Datasheet trio: Source Serif 4 in editorial chrome (reading-surface
// titles, leads, empty-state heads), IBM Plex Sans for UI controls, body,
// and display headlines, JetBrains Mono everywhere code, registers, labels,
// or document rules appear. Each font is pinned to a CSS variable so
// component-level utility classes can pull the right family without a
// Tailwind config rewrite.
const fontSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  // Upright only: the drawn italic costs twelve @font-face rules and four
  // woff2 files in the render-blocking stylesheet on every route, for two
  // small captions. Those two keep `italic` and take the browser's
  // synthesized oblique.
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
  // iOS takes a home-screen app's name and standalone launch from these
  // tags, not from the web manifest.
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
            decides. Nothing is persisted here: use-theme writes the choice
            on mount. Static, code-authored script (no user input); the CSP
            permits inline scripts. Kept in lockstep with the
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
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
