import posthog from "posthog-js";
import type { PostHogConfig } from "posthog-js";

/**
 * The analytics contract every app on kalpkan.com follows (portfolio docs/analytics.md):
 * cookieless (`persistence: "memory"`), first-party via the `/ingest` rewrite,
 * autocapture and pageviews on, session replay with every input masked.
 */
export const POSTHOG_INIT_OPTIONS = {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  persistence: "memory",
  autocapture: true,
  capture_pageview: true,
  capture_pageleave: true,
  session_recording: { maskAllInputs: true },
  disable_surveys: true
} satisfies Partial<PostHogConfig>;

let initialised = false;

/** Initialise once per page load; a silent no-op without NEXT_PUBLIC_POSTHOG_KEY. */
export function initPostHog(key: string | undefined = process.env.NEXT_PUBLIC_POSTHOG_KEY): void {
  if (initialised || !key || typeof window === "undefined") return;
  initialised = true;
  posthog.init(key, {
    ...POSTHOG_INIT_OPTIONS,
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || POSTHOG_INIT_OPTIONS.api_host
  });
}

/** Custom events for this app: `session_viewed` (dashboard) and `shot_ingested` (Edge Function). */
export function capture(event: "session_viewed", props?: Record<string, unknown>): void {
  if (!initialised) return;
  posthog.capture(event, props);
}
