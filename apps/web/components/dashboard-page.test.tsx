import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardPage, ProgressChart } from "./dashboard-page";
import { DemoDataBanner } from "./demo-data-banner";
import type { DashboardPayload, DashboardProgressPoint } from "../lib/contracts";

const points: DashboardProgressPoint[] = [
  { sessionId: "a", label: "Apr 15", fgPercent: 65.2, efgPercent: 69.6, streak: 3 },
  { sessionId: "b", label: "Apr 16", fgPercent: 75.4, efgPercent: 78.1, streak: 30 },
  { sessionId: "c", label: "Sep 18", fgPercent: 58.3, efgPercent: 70.8, streak: 7 }
];

function payload(overrides: Partial<DashboardPayload> = {}): DashboardPayload {
  return {
    overview: { attempts: 3, made: 2, missed: 1, fgPercent: 66.7, consistency: 64, avgStreak: 1, swishRate: 50 },
    sessions: [
      {
        sessionId: "a",
        deviceId: "t11-sample",
        title: "T1.1 sample",
        startedAt: "2026-09-18T19:40:00.000Z",
        lastShotAt: "2026-09-18T19:40:06.000Z",
        utcDay: "2026-09-18",
        label: "Sep 18",
        dateLabel: "Fri, Sep 18",
        attempts: 3,
        made: 2,
        missed: 1,
        fgPercent: 66.7,
        efgPercent: 71.4,
        swishRate: 50,
        bestStreak: 1
      }
    ],
    progress: [points[2]],
    shotMap: [],
    totalShotsRecorded: 26,
    hiddenShots: 23,
    source: "live",
    updatedAt: "2026-09-18T20:00:00.000Z",
    ...overrides
  };
}

// Percentage heights inside an auto-height flex column resolve to 0 px (the round-1 blocker),
// so every bar must be sized in pixels from a fixed plot height.
test("progress bars are sized in pixels, print their value and sit on a 0-100 axis", () => {
  const html = renderToStaticMarkup(<ProgressChart points={points} mode="fg" />);
  const heights = [...html.matchAll(/data-bar="([^"]+)"[^>]*style="height:(\d+)px"/g)].map(m => [m[1], Number(m[2])] as const);
  assert.equal(heights.length, 3, `expected one px-sized bar per point, got ${heights.length}: ${html.slice(0, 400)}`);
  for (const [, px] of heights) assert.ok(px > 0, "bar height must be > 0 px");
  const [[, a], [, b], [, c]] = heights;
  assert.ok(b > a && a > c, "taller value, taller bar");
  assert.doesNotMatch(html, /style="height:[\d.]+%"/, "no percentage heights");
  for (const value of ["65.2%", "75.4%", "58.3%"]) assert.match(html, new RegExp(value.replace(".", "\\.")), `value ${value} printed`);
  for (const tick of ["100", "50", "0"]) assert.match(html, new RegExp(`data-tick="${tick}"`), `axis tick ${tick}`);
  assert.match(html, /overflow-x-auto/, "30 bars scroll inside the chart instead of widening the page");
});

test("streak mode labels the maximum and scales bars to it", () => {
  const html = renderToStaticMarkup(<ProgressChart points={points} mode="streak" />);
  const heights = [...html.matchAll(/data-bar="([^"]+)"[^>]*style="height:(\d+)px"/g)].map(m => Number(m[2]));
  assert.equal(heights.length, 3);
  assert.equal(Math.max(...heights), heights[1], "the 30-streak bar is the tallest");
  assert.match(html, /data-tick="30"/, "the axis names the max streak");
});

test("the page says the iPhone app is not available, links the repo and shows the hidden-shot note", () => {
  const html = renderToStaticMarkup(<DashboardPage initialData={payload()} />);
  assert.match(html, /not available yet/i);
  assert.match(html, /href="https:\/\/github\.com\/KalpKan\/Basketball-Stat-Tracker"/);
  assert.match(html, /23 shots with an invalid timestamp hidden/);
  assert.doesNotMatch(html, /download|app store/i);
  // one label per session, used by pill, chart and row alike
  assert.equal((html.match(/Sep 18/g) ?? []).length >= 2, true);
  assert.match(html, /Fri, Sep 18/);
  assert.match(html, /T1\.1 sample/, "the table names the session");
  assert.match(html, /over 1 session/, "cards name their basis");
});

test("the Session History table scrolls inside its own container on a phone", () => {
  const html = renderToStaticMarkup(<DashboardPage initialData={payload()} />);
  const wrapper = html.match(/<div class="([^"]*)"><table/);
  assert.ok(wrapper, "table wrapper found");
  assert.match(wrapper![1], /overflow-x-auto/);
  assert.doesNotMatch(wrapper![1], /overflow-hidden/);
  assert.match(html, /<table class="[^"]*min-w-\[/, "the table keeps a minimum width so columns are never squashed");
  assert.doesNotMatch(html, /text-white\/(35|40|45)/, "secondary text meets 4.5:1");
});

test("the banner tells a database failure apart from missing settings", () => {
  const outage = renderToStaticMarkup(<DemoDataBanner source="mock" dataError="fetch failed" />);
  assert.match(outage, /could not be reached/i);
  assert.doesNotMatch(outage, /SUPABASE_URL/);
  const unconfigured = renderToStaticMarkup(<DemoDataBanner source="mock" />);
  assert.match(unconfigured, /SUPABASE_URL/);
  assert.equal(renderToStaticMarkup(<DemoDataBanner source="live" />), "");
});

test("a single-session selection has no consistency value", () => {
  const html = renderToStaticMarkup(<DashboardPage initialData={payload({ overview: { ...payload().overview, consistency: null } })} />);
  assert.match(html, /n\/a/);
});
