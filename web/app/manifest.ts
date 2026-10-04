import type { MetadataRoute } from "next";
import { NAV_ROUTES, SITE_NAME } from "@/lib/content/site";
import { THEME_TOKENS } from "@/lib/theme/tokens";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    // The label under the home-screen icon, which fits about twelve characters.
    short_name: "AArch64",
    description:
      "Write, run, and step through ARMv8 assembly in the browser, watching the registers, stack, and memory change.",
    start_url: "/playground",
    display: "standalone",
    // The installed app opens on /playground before any script runs, in the
    // default dark theme.
    background_color: THEME_TOKENS.dark["bg-base"],
    theme_color: THEME_TOKENS.dark["bg-base"],
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
    // A long press on the home-screen icon opens these. The playground is
    // left out because the icon itself opens it.
    shortcuts: NAV_ROUTES.filter((route) => route.href !== "/playground").map((route) => ({
      name: route.label,
      url: route.href,
    })),
  };
}
