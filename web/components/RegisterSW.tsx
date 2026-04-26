"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/register-sw";

/**
 * Tiny client component whose only job is to call
 * `registerServiceWorker` once on mount. Mounted near the root so the
 * registration is best-effort and doesn't gate any other UI.
 */
export function RegisterSW() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return null;
}
