import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  buildDashboardPayload,
  computeEfgPercent,
  formatSessionLabel,
  formatSessionDateLabel,
  getDashboardPayload,
  type SessionRow,
  type ShotRow
} from "./dashboard-data";

// Ground truth is produced by tests/compute-expected-metrics.py (pure Python, no app code, no SQL).
// These tests feed the same raw rows through the app's pure builder and require identical numbers.
const fixtures = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "tests", "fixtures");
const readJson = (name: string) => JSON.parse(readFileSync(join(fixtures, name), "utf8"));

type ExpectedSession = {
  session_id: string;
  attempts: number;
  made: number;
  missed: number;
  fg_percent: number;
  efg_percent: number;
  swish_rate: number;
  best_streak: number;
};
type Expected = {
  dashboard: {
    overall: {
      attempts: number;
      made: number;
      missed: number;
      fg_percent: number;
      swish_rate: number;
      consistency: number | null;
      avg_best_streak: number;
      hidden_shots: number;
      total_shots_in_db: number;
    };
    sessions: ExpectedSession[];
  };
};

function loadCorpus(rowsFile: string, truthFile: string) {
  const rows = readJson(rowsFile) as { sessions: SessionRow[]; shot_events: ShotRow[] };
  const truth = readJson(truthFile) as Expected;
  return { rows, truth };
}

function assertMatchesGroundTruth(rowsFile: string, truthFile: string) {
  const { rows, truth } = loadCorpus(rowsFile, truthFile);
  const payload = buildDashboardPayload(
    { sessions: rows.sessions, shots: rows.shot_events, totalShotsInDb: rows.shot_events.length },
    { now: new Date("2026-09-18T12:00:00Z") }
  );
  const want = truth.dashboard;

  assert.equal(payload.source, "live");
  assert.deepEqual(
    payload.sessions.map(session => session.sessionId),
    want.sessions.map(session => session.session_id),
    "one row per (device, UTC day), newest first, pre-2000 sessions hidden"
  );

  const mismatches: string[] = [];
  const byId = new Map(want.sessions.map(session => [session.session_id, session]));
  for (const session of payload.sessions) {
    const expected = byId.get(session.sessionId)!;
    const pairs: Array<[keyof typeof session, keyof ExpectedSession]> = [
      ["attempts", "attempts"],
      ["made", "made"],
      ["missed", "missed"],
      ["fgPercent", "fg_percent"],
      ["efgPercent", "efg_percent"],
      ["swishRate", "swish_rate"],
      ["bestStreak", "best_streak"]
    ];
    for (const [app, gt] of pairs) {
      if (session[app] !== expected[gt]) mismatches.push(`${session.sessionId}.${app} ${String(session[app])} != ${expected[gt]}`);
    }
    assert.ok(session.efgPercent <= 100, `${session.sessionId} eFG% ${session.efgPercent} must be bounded`);
    assert.ok(session.startedAt >= "2000", `${session.sessionId} is a pre-2000 session and must be hidden`);
  }
  assert.deepEqual(mismatches, []);

  const overview = payload.overview;
  assert.equal(overview.attempts, want.overall.attempts);
  assert.equal(overview.made, want.overall.made);
  assert.equal(overview.missed, want.overall.missed);
  assert.equal(overview.fgPercent, want.overall.fg_percent);
  assert.equal(overview.swishRate, want.overall.swish_rate);
  assert.equal(overview.consistency, want.overall.consistency, "Consistency on the same basis as the table rows");
  assert.equal(overview.avgStreak, want.overall.avg_best_streak, "Avg Streak on the same basis as the table rows");
  assert.equal(payload.hiddenShots, want.overall.hidden_shots);
  assert.equal(payload.totalShotsRecorded, want.overall.total_shots_in_db);
  assert.equal(payload.shotMap.length, want.overall.attempts, "the map holds exactly the kept shots");
  for (const shot of payload.shotMap) {
    assert.ok(payload.sessions.some(session => session.sessionId === shot.sessionId), `shot ${shot.id} belongs to a visible session`);
  }
  return payload;
}

test("snapshot corpus (5 sessions / 95 shots) matches the ground truth on the dashboard basis", () => {
  const payload = assertMatchesGroundTruth("hoops-rows-2026-09-18.json", "hoops-expected-metrics.json");
  assert.equal(payload.sessions.length, 4);
  assert.equal(payload.hiddenShots, 23);
});

test("30-session synthetic corpus: all 30 sessions survive and match the ground truth", () => {
  const payload = assertMatchesGroundTruth("synthetic-30-sessions.json", "synthetic-30-expected-metrics.json");
  assert.equal(payload.sessions.length, 30);
  assert.equal(payload.progress.length, 30);
  assert.equal(payload.shotMap.length, 801);
});

test("eFG% is bounded: a single made swish is 100, not 150", () => {
  assert.equal(computeEfgPercent({ made: 1, swishes: 1, attempts: 1 }), 100);
  assert.equal(computeEfgPercent({ made: 2, swishes: 1, attempts: 3 }), 71.4);
  assert.equal(computeEfgPercent({ made: 0, swishes: 0, attempts: 0 }), 0);
});

test("date labels are formatted once, in UTC, and carry the year only when it is not the current year", () => {
  const now = new Date("2026-09-18T12:00:00Z");
  // 2026-09-18 19:40 UTC is Sep 19 in Tokyo and still Sep 18 in Toronto; the label must say Sep 18 everywhere.
  assert.equal(formatSessionLabel("2026-09-18T19:40:00.000Z", now), "Sep 18");
  assert.equal(formatSessionDateLabel("2026-09-18T19:40:00.000Z", now), "Fri, Sep 18");
  // 2026-04-16 06:50 UTC is Apr 16 in UTC but Apr 15 in Toronto.
  assert.equal(formatSessionLabel("2026-04-16T06:50:29.019Z", now), "Apr 16");
  assert.equal(formatSessionLabel("2026-04-16T06:50:29.019Z", new Date("2027-01-01T00:00:00Z")), "Apr 16, 2026");
  assert.equal(formatSessionDateLabel("2026-04-16T06:50:29.019Z", new Date("2027-01-01T00:00:00Z")), "Thu, Apr 16, 2026");
});

test("pill, chart and table share one label per session; two sessions on one day are told apart", () => {
  const { rows } = loadCorpus("hoops-rows-2026-09-18.json", "hoops-expected-metrics.json");
  const payload = buildDashboardPayload(
    { sessions: rows.sessions, shots: rows.shot_events, totalShotsInDb: rows.shot_events.length },
    { now: new Date("2026-09-18T12:00:00Z") }
  );
  const labels = payload.sessions.map(session => session.label);
  assert.equal(new Set(labels).size, labels.length, `labels must be unique: ${labels.join(" | ")}`);
  assert.deepEqual(
    payload.progress.map(point => point.label),
    payload.sessions
      .slice()
      .reverse()
      .map(session => session.label),
    "chart labels are the session labels in chronological order"
  );
  assert.deepEqual(
    payload.progress.map(point => point.sessionId),
    payload.sessions
      .slice()
      .reverse()
      .map(session => session.sessionId)
  );
  const smokeTest = payload.sessions.find(session => session.sessionId === "90000000-0000-4000-8000-000000000100")!;
  assert.equal(smokeTest.title, "Frontend Backend Smoke Test");
  assert.match(smokeTest.label, /^Apr 15/);
  assert.match(smokeTest.dateLabel, /^Wed, Apr 15/);
  assert.ok(payload.sessions.every(session => session.deviceId.length > 0));
});

// A minimal stand-in for the supabase-js query builder: enough for getDashboardPayload's queries.
function fakeClient(tables: Record<string, unknown[]> | Error) {
  return {
    from(table: string) {
      const chain = {
        _from: 0,
        _to: Infinity,
        _order: null as null | [string, boolean],
        select() {
          return chain;
        },
        order(column: string, options?: { ascending?: boolean }) {
          chain._order = [column, options?.ascending ?? true];
          return chain;
        },
        limit(count: number) {
          chain._to = chain._from + count - 1;
          return chain;
        },
        range(from: number, to: number) {
          chain._from = from;
          chain._to = to;
          return chain;
        },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          if (tables instanceof Error) {
            return Promise.resolve({ data: null, error: { message: tables.message }, count: null }).then(resolve, reject);
          }
          const rows = (tables[table] ?? []).slice() as Array<Record<string, string>>;
          if (chain._order) {
            const [column, ascending] = chain._order;
            rows.sort((left, right) => (ascending ? 1 : -1) * String(left[column]).localeCompare(String(right[column])));
          }
          const data = rows.slice(chain._from, chain._to === Infinity ? undefined : chain._to + 1);
          return Promise.resolve({ data, error: null, count: rows.length }).then(resolve, reject);
        }
      };
      return chain;
    }
  };
}

test("getDashboardPayload pages through every shot and reports live data", async () => {
  const { rows } = loadCorpus("synthetic-30-sessions.json", "synthetic-30-expected-metrics.json");
  const client = fakeClient({ sessions: rows.sessions, shot_events: rows.shot_events });
  const payload = await getDashboardPayload(client as never);
  assert.equal(payload.source, "live");
  assert.equal(payload.dataError, undefined);
  assert.equal(payload.sessions.length, 30);
  assert.equal(payload.shotMap.length, 801);
  assert.equal(payload.totalShotsRecorded, 801);
});

test("getDashboardPayload says the database could not be reached when a query fails", async () => {
  const payload = await getDashboardPayload(fakeClient(new Error("connection refused")) as never);
  assert.equal(payload.source, "mock");
  assert.match(payload.dataError ?? "", /connection refused/);
  assert.ok(payload.sessions.length > 0, "the page still renders sample rows");
});

test("getDashboardPayload without a client returns sample data with no dataError", async () => {
  const payload = await getDashboardPayload(null);
  assert.equal(payload.source, "mock");
  assert.equal(payload.dataError, undefined);
  assert.ok(payload.sessions.every(session => session.efgPercent <= 100));
});
