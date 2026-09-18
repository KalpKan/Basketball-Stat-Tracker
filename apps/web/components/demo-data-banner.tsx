import type { DashboardPayload } from "../lib/contracts";

// Visible only when the Supabase env vars are missing, so nobody mistakes the
// built-in sample numbers for real shooting data. Hidden the moment the
// dashboard reads real rows from the hoops schema in Project B.
export function DemoDataBanner({ source }: { source: DashboardPayload["source"] }) {
  if (source !== "mock") {
    return null;
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-1 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-4 text-sm text-amber-100"
    >
      <span className="font-semibold uppercase tracking-[0.2em] text-amber-300">Demo data</span>
      <span className="text-amber-100/80">
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
