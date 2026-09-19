import type { DashboardPayload } from "../lib/contracts";

// Visible only when the page is on sample data, so nobody mistakes the built-in sample
// numbers for real shooting data. Two reasons are told apart: the Supabase settings are
// missing (a configuration problem, amber) or they are present but the database could not
// be reached (an outage, red). Hidden the moment the dashboard reads real rows.
export function DemoDataBanner({ source, dataError }: { source: DashboardPayload["source"]; dataError?: string }) {
  if (source !== "mock") {
    return null;
  }

  if (dataError) {
    return (
      <div
        role="alert"
        className="flex flex-col gap-1 rounded-2xl border border-red-400/40 bg-red-400/10 px-5 py-4 text-sm text-red-100"
      >
        <span className="font-semibold uppercase tracking-[0.2em] text-red-300">Sample data</span>
        <span className="text-red-100/90">
          The database could not be reached, so the numbers below are built-in sample shots, not real sessions. The
          page retries every few seconds.
        </span>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-1 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-4 text-sm text-amber-100"
    >
      <span className="font-semibold uppercase tracking-[0.2em] text-amber-300">Sample data</span>
      <span className="text-amber-100/90">
        This dashboard is showing sample shots because it is not connected to a database. Set
        {" "}
        <code className="rounded bg-black/30 px-1 py-0.5 text-xs">SUPABASE_URL</code> and
        {" "}
        <code className="rounded bg-black/30 px-1 py-0.5 text-xs">SUPABASE_SERVICE_ROLE_KEY</code> in the
        hosting settings and redeploy to see real data.
      </span>
    </div>
  );
}
