import { posthogRewrites } from "./lib/posthog-rewrites.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  // PostHog reverse proxy: the browser talks to /ingest on this origin and
  // Next.js forwards to PostHog's US cloud (portfolio docs/analytics.md).
  async rewrites() {
    return posthogRewrites();
  },
  // PostHog's API endpoints keep their trailing slash (/ingest/e/).
  skipTrailingSlashRedirect: true
};

export default nextConfig;
