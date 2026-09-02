"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/playground/register-sw";

/**
 * Mounted near the root so registration never gates other UI.
 */
export function RegisterSW() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return null;
}
