import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/content/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    // The label under the home-screen icon, which fits about twelve characters.
    short_name: "AArch64",
    description:
      "Browser-based ARMv8 emulator with a visual debugger, tuned for the cpsc 355 tutorial corpus",
    start_url: "/playground",
    display: "standalone",
    background_color: "#0B0C10",
    theme_color: "#0B0C10",
    orientation: "any",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
