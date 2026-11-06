"use client";

import dynamic from "next/dynamic";

/**
 * A frame's step over, step out and run to cursor, behind their own chunk:
 * the landing hero has no step, so its document never ships them. Rendered
 * on the server, so a lesson's run row does not grow once the chunk lands.
 * Module scope, because a dynamic() call per render remounts the buttons.
 */
export const StepGoals = dynamic(() =>
  import("@/components/playground/StepGoals").then((m) => m.StepGoals),
);
