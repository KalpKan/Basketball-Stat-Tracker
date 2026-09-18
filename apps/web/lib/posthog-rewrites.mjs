/**
 * Rewrite rules for next.config.mjs: `/ingest/*` on this origin becomes
 * PostHog's US cloud, so analytics requests are first-party and ad blockers
 * do not drop them. Same contract as the hub (portfolio docs/analytics.md).
 */
export function posthogRewrites() {
  return [
    { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
    { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" }
  ];
}
