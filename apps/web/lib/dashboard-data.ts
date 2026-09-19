import type {
  DashboardPayload,
  DashboardProgressPoint,
  SessionSummary,
  ShotEvent
} from "./contracts";
import { getSupabaseAdmin } from "./supabase-admin";

// Raw rows as they come out of hoops.sessions and hoops.shot_events (PostgREST timestamptz
// strings such as "2026-04-15T05:10:00+00:00"; the test fixtures use Postgres' "2026-04-15 05:10:00+00").
export interface SessionRow {
  id: string;
  device_id: string;
  started_at: string;
  title?: string | null;
}

export interface ShotRow {
  id: string;
  session_id: string;
  captured_at: string;
  result: string;
  x: number | null;
  y: number | null;
  confidence: number | null;
  frame_id?: string | null;
  swish?: boolean | null;
}

/** Sessions and shots stamped before this are treated as clock failures (an old iOS build sent epoch zero). */
export const MIN_VALID_TIMESTAMP = "2000-01-01T00:00:00.000Z";
/** Newest sessions read per load; shots are read for these only. */
export const MAX_SESSIONS = 200;
const SHOT_PAGE_SIZE = 1000;
const MAX_SHOT_PAGES = 10;

type SupabaseLike = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

function round1(value: number) {
  return Number(value.toFixed(1));
}

function toIso(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

export function getUtcDateKey(isoValue: string) {
  return isoValue.slice(0, 10);
}

/**
 * eFG% for a mini hoop: swishes count half a make extra, but the score is bounded at 100 because the
 * bonus is added to the denominator too: (made + 0.5 * swishes) / (attempts + 0.5 * swishes).
 * The v1 proxy divided by attempts only and reached 150 % on a single swish.
 */
export function computeEfgPercent({ made, swishes, attempts }: { made: number; swishes: number; attempts: number }) {
  if (attempts === 0) return 0;
  return round1((100 * (made + 0.5 * swishes)) / (attempts + 0.5 * swishes));
}

export function calculateBestMakeStreak(shots: Pick<ShotEvent, "id" | "capturedAt" | "result">[]) {
  let bestStreak = 0;
  let currentStreak = 0;
  const ordered = shots.slice().sort((left, right) => left.capturedAt.localeCompare(right.capturedAt) || left.id.localeCompare(right.id));

  for (const shot of ordered) {
    if (shot.result === "made") {
      currentStreak += 1;
      bestStreak = Math.max(bestStreak, currentStreak);
      continue;
    }
    currentStreak = 0;
  }

  return bestStreak;
}

function sampleStdDev(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** 100 - 2 * sample stddev of FG% across the visible sessions; null when there is nothing to compare. */
export function computeConsistency(fgPercents: number[]) {
  if (fgPercents.length < 2) return null;
  return round1(Math.max(0, Math.min(100, 100 - 2 * sampleStdDev(fgPercents))));
}

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const shortDateWithYear = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const longDateWithYear = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// Dates are formatted here, on the server, in UTC (the merge key is the UTC day). The browser only
// ever renders these strings, so a Toronto or Tokyo visitor sees the same label the server sent and
// React never hydrates against a different one.
export function formatSessionLabel(isoValue: string, now = new Date()) {
  const date = new Date(isoValue);
  return (date.getUTCFullYear() === now.getUTCFullYear() ? shortDate : shortDateWithYear).format(date);
}

export function formatSessionDateLabel(isoValue: string, now = new Date()) {
  const date = new Date(isoValue);
  return (date.getUTCFullYear() === now.getUTCFullYear() ? longDate : longDateWithYear).format(date);
}

function summarize(shots: ShotEvent[]) {
  const attempts = shots.length;
  const made = shots.filter(shot => shot.result === "made").length;
  const swishes = shots.filter(shot => shot.swish === true).length;
  return {
    attempts,
    made,
    missed: attempts - made,
    fgPercent: attempts === 0 ? 0 : round1((100 * made) / attempts),
    efgPercent: computeEfgPercent({ made, swishes, attempts }),
    swishRate: made === 0 ? 0 : round1((100 * swishes) / made),
    bestStreak: calculateBestMakeStreak(shots),
    lastShotAt: shots.length === 0 ? null : shots.map(shot => shot.capturedAt).sort().at(-1)!
  };
}

/**
 * Merges raw sessions into one row per (device, UTC day), which is also the backend's own rule
 * (hoops-ingest-shot reuses the device's session for the day and 0004 adds the unique index), drops
 * anything stamped before 2000 and computes every number from the kept shots.
 */
export function buildDailySessions(
  sessionRows: SessionRow[],
  shotRows: ShotRow[],
  now = new Date()
): { sessions: SessionSummary[]; shotMap: ShotEvent[]; hiddenShots: number } {
  const validSessions = sessionRows
    .map(row => ({ ...row, started_at: toIso(row.started_at) }))
    .filter(row => row.id && row.device_id && row.started_at >= MIN_VALID_TIMESTAMP)
    .sort((left, right) => left.started_at.localeCompare(right.started_at) || left.id.localeCompare(right.id));

  // canonical id per (device, UTC day) = the earliest session of that device that day
  const canonicalBySession = new Map<string, string>();
  const groups = new Map<string, { canonical: SessionRow; members: SessionRow[] }>();
  for (const session of validSessions) {
    const key = `${session.device_id}|${getUtcDateKey(session.started_at)}`;
    const group = groups.get(key);
    if (group) {
      group.members.push(session);
    } else {
      groups.set(key, { canonical: session, members: [session] });
    }
    canonicalBySession.set(session.id, groups.get(key)!.canonical.id);
  }

  let hiddenShots = 0;
  const shotsByCanonical = new Map<string, ShotEvent[]>();
  for (const row of shotRows) {
    if (!row.id || !row.session_id || !row.captured_at || (row.result !== "made" && row.result !== "missed")) continue;
    const capturedAt = toIso(row.captured_at);
    const canonical = canonicalBySession.get(row.session_id);
    if (!canonical || capturedAt < MIN_VALID_TIMESTAMP) {
      hiddenShots += 1;
      continue;
    }
    const shot: ShotEvent = {
      id: row.id,
      sessionId: canonical,
      capturedAt,
      result: row.result,
      x: row.x ?? 0,
      y: row.y ?? 0,
      confidence: row.confidence ?? 0,
      frameId: row.frame_id ?? null,
      swish: row.swish ?? null
    };
    shotsByCanonical.set(canonical, [...(shotsByCanonical.get(canonical) ?? []), shot]);
  }

  const sessions: SessionSummary[] = Array.from(groups.values()).map(({ canonical, members }) => {
    const shots = shotsByCanonical.get(canonical.id) ?? [];
    const summary = summarize(shots);
    const title = members.map(member => member.title).find(value => value && value.trim()) ?? null;
    return {
      sessionId: canonical.id,
      deviceId: canonical.device_id,
      title,
      startedAt: canonical.started_at,
      lastShotAt: summary.lastShotAt,
      utcDay: getUtcDateKey(canonical.started_at),
      label: formatSessionLabel(canonical.started_at, now),
      dateLabel: formatSessionDateLabel(canonical.started_at, now),
      attempts: summary.attempts,
      made: summary.made,
      missed: summary.missed,
      fgPercent: summary.fgPercent,
      efgPercent: summary.efgPercent,
      swishRate: summary.swishRate,
      bestStreak: summary.bestStreak
    };
  });

  // Two devices on the same day would otherwise share a pill/bar label; name the session so it is
  // unambiguous. The table keeps the plain date because its Session column already names it.
  const labelCounts = new Map<string, number>();
  for (const session of sessions) labelCounts.set(session.label, (labelCounts.get(session.label) ?? 0) + 1);
  for (const session of sessions) {
    if ((labelCounts.get(session.label) ?? 0) > 1) {
      session.label = `${session.label} · ${session.title ?? session.deviceId}`;
    }
  }

  sessions.sort((left, right) => right.startedAt.localeCompare(left.startedAt) || right.sessionId.localeCompare(left.sessionId));
  const shotMap = sessions.flatMap(session => shotsByCanonical.get(session.sessionId) ?? []);
  return { sessions, shotMap, hiddenShots };
}

export function buildProgress(sessions: SessionSummary[]): DashboardProgressPoint[] {
  return sessions
    .slice()
    .sort((left, right) => left.startedAt.localeCompare(right.startedAt) || left.sessionId.localeCompare(right.sessionId))
    .map(session => ({
      sessionId: session.sessionId,
      label: session.label,
      fgPercent: session.fgPercent,
      efgPercent: session.efgPercent,
      streak: session.bestStreak
    }));
}

export function buildDashboardPayload(
  rows: { sessions: SessionRow[]; shots: ShotRow[]; totalShotsInDb?: number },
  options: { now?: Date; source?: DashboardPayload["source"]; dataError?: string } = {}
): DashboardPayload {
  const now = options.now ?? new Date();
  const { sessions, shotMap, hiddenShots } = buildDailySessions(rows.sessions, rows.shots, now);
  const overall = summarize(shotMap);
  const withShots = sessions.filter(session => session.attempts > 0);

  return {
    overview: {
      attempts: overall.attempts,
      made: overall.made,
      missed: overall.missed,
      fgPercent: overall.fgPercent,
      consistency: computeConsistency(withShots.map(session => session.fgPercent)),
      avgStreak: withShots.length === 0 ? 0 : round1(withShots.reduce((sum, session) => sum + session.bestStreak, 0) / withShots.length),
      swishRate: overall.swishRate
    },
    sessions,
    progress: buildProgress(sessions),
    shotMap,
    totalShotsRecorded: rows.totalShotsInDb ?? rows.shots.length,
    hiddenShots,
    source: options.source ?? "live",
    ...(options.dataError ? { dataError: options.dataError } : {}),
    updatedAt: now.toISOString()
  };
}

// Sample data for a build with no Supabase settings: three sessions of deterministic shots.
function buildMockRows() {
  let seed = 20260918;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const days = ["2026-04-13", "2026-04-14", "2026-04-15"];
  const sessions: SessionRow[] = days.map((day, index) => ({
    id: `demo-${index + 1}`,
    device_id: "sample-device",
    started_at: `${day}T18:00:00.000Z`,
    title: `Sample session ${index + 1}`
  }));
  const shots: ShotRow[] = [];
  for (const [index, session] of sessions.entries()) {
    for (let shot = 0; shot < 20 + index * 2; shot += 1) {
      const made = random() < 0.72;
      shots.push({
        id: `demo-${index + 1}-${shot + 1}`,
        session_id: session.id,
        captured_at: new Date(Date.parse(session.started_at) + shot * 45_000).toISOString(),
        result: made ? "made" : "missed",
        x: made ? 0.35 + random() * 0.3 : 0.1 + random() * 0.8,
        y: made ? 0.35 + random() * 0.3 : 0.1 + random() * 0.8,
        confidence: 0.75 + random() * 0.24,
        frame_id: null,
        swish: made ? random() < 0.35 : false
      });
    }
  }
  return { sessions, shots };
}

export function buildMockPayload(dataError?: string): DashboardPayload {
  return buildDashboardPayload(buildMockRows(), { source: "mock", dataError });
}

async function readShots(supabase: SupabaseLike) {
  const shots: ShotRow[] = [];
  let total: number | null = null;
  for (let page = 0; page < MAX_SHOT_PAGES; page += 1) {
    const from = page * SHOT_PAGE_SIZE;
    const { data, error, count } = await supabase
      .from("shot_events")
      .select("id, session_id, captured_at, result, x, y, confidence, frame_id, swish", { count: "exact" })
      .order("captured_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + SHOT_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (total === null) total = count ?? null;
    shots.push(...((data ?? []) as ShotRow[]));
    if (!data || data.length < SHOT_PAGE_SIZE) break;
  }
  return { shots, total: total ?? shots.length };
}

/**
 * Reads the newest sessions and every shot from the hoops schema and builds the payload. With no client
 * (Supabase settings missing) it returns sample data; when a query fails it returns sample data with
 * `dataError` set so the page can say the database could not be reached.
 */
export async function getDashboardPayload(client: SupabaseLike | null = getSupabaseAdmin()): Promise<DashboardPayload> {
  if (!client) {
    return buildMockPayload();
  }

  try {
    const [{ data: sessionRows, error: sessionsError }, { shots, total }] = await Promise.all([
      client
        .from("sessions")
        .select("id, device_id, started_at, title")
        .order("started_at", { ascending: false })
        .limit(MAX_SESSIONS),
      readShots(client)
    ]);
    if (sessionsError) throw new Error(sessionsError.message);

    return buildDashboardPayload({ sessions: (sessionRows ?? []) as SessionRow[], shots, totalShotsInDb: total });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return buildMockPayload(message || "unknown error");
  }
}
