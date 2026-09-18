"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { initPostHog } from "../lib/posthog";

/** Boots PostHog once on the client; renders nothing extra. */
export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);
  return <>{children}</>;
}
