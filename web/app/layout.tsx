import type { Metadata, Viewport } from "next";
import "./globals.css";

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
  return (
    <html lang="en">
      <body className="flex flex-col min-h-dvh">{children}</body>
    </html>
  );
}
