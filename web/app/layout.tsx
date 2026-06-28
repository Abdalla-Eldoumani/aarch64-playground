import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { ToastHost } from "@/components/Toast";
import { OfflineBadge } from "@/components/OfflineBadge";
import { RegisterSW } from "@/components/RegisterSW";
import { SITE_URL } from "@/lib/site";

// Engineering-notebook trio: Source Serif 4 in editorial chrome (page
// titles, empty-state heads), Hanken Grotesk for display, body, and
// controls, JetBrains Mono everywhere code or registers appear. Each font is
// pinned to a CSS variable so component-level utility classes can pull
// the right family without a Tailwind config rewrite.
const fontSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-serif",
});
const fontSans = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-sans",
});
const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-mono",
});

const DESCRIPTION =
  "Browser-based ARMv8 emulator with a visual debugger, tuned for the cpsc 355 tutorial corpus";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "cpsc 355 playground",
    template: "%s — cpsc 355 playground",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "cpsc 355 playground",
    title: "cpsc 355 playground",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "cpsc 355 playground",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  // `viewport-fit=cover` lets the safe-area CSS vars we read in globals.css
  // receive real values on notched devices; without it they're 0.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B0C0E",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fontClasses = `${fontSerif.variable} ${fontSans.variable} ${fontMono.variable}`;
  return (
    <html lang="en" className={fontClasses}>
      <body className="flex flex-col h-dvh font-mono">
        <RegisterSW />
        <OfflineBadge />
        <ToastHost>{children}</ToastHost>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
