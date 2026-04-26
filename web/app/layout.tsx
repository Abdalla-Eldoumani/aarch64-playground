import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { ToastHost } from "@/components/Toast";
import { OfflineBadge } from "@/components/OfflineBadge";
import { RegisterSW } from "@/components/RegisterSW";

// Engineering-notebook trio: Source Serif 4 in editorial chrome (page
// titles, empty-state heads), IBM Plex Sans in the controls and labels,
// JetBrains Mono everywhere code or registers appear. Each font is
// pinned to a CSS variable so component-level utility classes can pull
// the right family without a Tailwind config rewrite.
const fontSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-serif",
});
const fontSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-sans",
});
const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "cpsc 355 playground",
  description:
    "Browser-based ARMv8 emulator with a visual debugger, tuned for the cpsc 355 tutorial corpus",
};

export const viewport: Viewport = {
  // `viewport-fit=cover` lets the safe-area CSS vars we read in globals.css
  // receive real values on notched devices; without it they're 0.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f1117",
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
