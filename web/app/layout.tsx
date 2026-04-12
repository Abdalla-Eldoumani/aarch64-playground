import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "aarch64 playground",
  description:
    "Browser-based ARMv8 emulator with a visual debugger",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
