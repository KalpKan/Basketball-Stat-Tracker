import type {
  DashboardPayload,
  DashboardProgressPoint,
  SessionSummary,
  ShotEvent
} from "./contracts";
import { getSupabaseAdmin } from "./supabase-admin";

const mockShotMap: ShotEvent[] = [
  { id: "1", sessionId: "demo-1", capturedAt: "2026-04-15T18:00:00.000Z", result: "made", x: 0.52, y: 0.45, confidence: 0.94, swish: true },
  { id: "2", sessionId: "demo-1", capturedAt: "2026-04-15T18:01:00.000Z", result: "made", x: 0.49, y: 0.53, confidence: 0.89, swish: false },
  { id: "3", sessionId: "demo-1", capturedAt: "2026-04-15T18:02:00.000Z", result: "missed", x: 0.18, y: 0.2, confidence: 0.86 },
  { id: "4", sessionId: "demo-2", capturedAt: "2026-04-14T18:02:00.000Z", result: "missed", x: 0.84, y: 0.25, confidence: 0.82 },
  { id: "5", sessionId: "demo-2", capturedAt: "2026-04-14T18:03:00.000Z", result: "made", x: 0.58, y: 0.63, confidence: 0.92 }
];

const mockSessions: SessionSummary[] = [
  {
    sessionId: "demo-1",
    deviceId: "iphone-15-pro",
    startedAt: "2026-04-15T18:00:00.000Z",
    lastShotAt: "2026-04-15T18:20:00.000Z",
    attempts: 22,
    made: 18,
    missed: 4,
    fgPercent: 81.8,
    efgPercent: 84.1,
    swishRate: 38.9,
    bestStreak: 7
  },
  {
    sessionId: "demo-2",
    deviceId: "iphone-15-pro",
    startedAt: "2026-04-14T18:00:00.000Z",
    lastShotAt: "2026-04-14T18:18:00.000Z",
    attempts: 21,
    made: 16,
    missed: 5,
    fgPercent: 76.2,
    efgPercent: 78.6,
    swishRate: 25,
    bestStreak: 8
  },
  {
    sessionId: "demo-3",
    deviceId: "iphone-15-pro",
    startedAt: "2026-04-13T18:00:00.000Z",
    lastShotAt: "2026-04-13T18:18:00.000Z",
    attempts: 24,
    made: 20,
    missed: 4,
    fgPercent: 83.3,
    efgPercent: 85.4,
    swishRate: 40,
    bestStreak: 10
  }
];

function formatSessionLabel(dateValue: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(dateValue));
}

function getUtcDateKey(dateValue: string) {
  return dateValue.slice(0, 10);
}

function buildProgress(sessions: SessionSummary[]): DashboardProgressPoint[] {
  return sessions
    .slice()
    .sort((left, right) => left.startedAt.localeCompare(right.startedAt))
    .map(session => ({
      label: formatSessionLabel(session.startedAt),
      fgPercent: session.fgPercent,
      efgPercent: session.efgPercent,
      streak: session.bestStreak
    }));
}

function buildDailySessions(sessions: SessionSummary[]): SessionSummary[] {
  const sessionsByDay = new Map<string, SessionSummary>();

  for (const session of sessions) {
    const dateKey = getUtcDateKey(session.startedAt);
    const existing = sessionsByDay.get(dateKey);

    if (!existing) {
      sessionsByDay.set(dateKey, {
        ...session,
        sessionId: `day-${dateKey}`
      });
      continue;
    }

    const attempts = existing.attempts + session.attempts;
    const made = existing.made + session.made;
    const missed = existing.missed + session.missed;
    const swishMakes = (existing.swishRate / 100) * existing.made + (session.swishRate / 100) * session.made;

    sessionsByDay.set(dateKey, {
      ...existing,
      lastShotAt: [existing.lastShotAt, session.lastShotAt].filter(Boolean).sort().at(-1) ?? null,
      attempts,
      made,
      missed,
      fgPercent: attempts === 0 ? 0 : Number(((made / attempts) * 100).toFixed(1)),
      efgPercent: attempts === 0 ? 0 : Number((((made + swishMakes * 0.5) / attempts) * 100).toFixed(1)),
      swishRate: made === 0 ? 0 : Number(((swishMakes / made) * 100).toFixed(1)),
      bestStreak: Math.max(existing.bestStreak, session.bestStreak)
    });
  }

  return Array.from(sessionsByDay.values()).sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

function buildMockPayload(): DashboardPayload {
  const attempts = mockSessions.reduce((sum, session) => sum + session.attempts, 0);
  const made = mockSessions.reduce((sum, session) => sum + session.made, 0);
  const missed = mockSessions.reduce((sum, session) => sum + session.missed, 0);
  const avgStreak = Number((mockSessions.reduce((sum, session) => sum + session.bestStreak, 0) / mockSessions.length).toFixed(1));

  return {
    overview: {
      attempts,
      made,
      missed,
      fgPercent: Number(((made / attempts) * 100).toFixed(1)),
      consistency: 95.8,
      avgStreak,
      swishRate: 34.1
    },
    sessions: mockSessions,
    progress: buildProgress(mockSessions),
    shotMap: mockShotMap,
    totalShotsRecorded: attempts,
    source: "mock",
    updatedAt: new Date().toISOString()
  };
}

export async function getDashboardPayload(): Promise<DashboardPayload> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return buildMockPayload();
  }

  const [
    { data: overviewRows, error: overviewError },
    { data: sessionsRows, error: sessionsError },
    { data: progressRows, error: progressError },
    { data: shotRows, error: shotError }
  ] = await Promise.all([
    supabase.from("overall_analytics").select("*").limit(1),
    supabase.from("session_summaries").select("*").order("started_at", { ascending: false }).limit(12),
    supabase.from("progress_over_time").select("*").order("started_at", { ascending: true }).limit(24),
    supabase.from("shot_map_points").select("*").order("captured_at", { ascending: false }).limit(200)
  ]);

  if (
    overviewError ||
    sessionsError ||
    progressError ||
    shotError ||
    !overviewRows ||
    !sessionsRows ||
    !progressRows ||
    !shotRows
  ) {
    return buildMockPayload();
  }

  const rawSessions: SessionSummary[] = sessionsRows
    .filter(row => row.session_id && row.device_id && row.started_at)
    .map(row => ({
      sessionId: row.session_id as string,
      deviceId: row.device_id as string,
      startedAt: row.started_at as string,
      lastShotAt: row.last_shot_at,
      attempts: row.attempts ?? 0,
      made: row.made ?? 0,
      missed: row.missed ?? 0,
      fgPercent: row.fg_percent ?? 0,
      efgPercent: row.efg_percent ?? 0,
      swishRate: row.swish_rate ?? 0,
      bestStreak: row.best_streak ?? 0
    }));
  const sessionIdToDayId = new Map(
    rawSessions.map(session => [session.sessionId, `day-${getUtcDateKey(session.startedAt)}`])
  );
  const sessions = buildDailySessions(rawSessions);

  const progress = buildProgress(sessions);

  const shotMap: ShotEvent[] = shotRows
    .filter(
      row =>
        row.id &&
        row.session_id &&
        row.captured_at &&
        (row.result === "made" || row.result === "missed")
    )
    .map(row => ({
      id: row.id as string,
      sessionId: sessionIdToDayId.get(row.session_id as string) ?? row.session_id as string,
      capturedAt: row.captured_at as string,
      result: row.result as ShotEvent["result"],
      x: row.x ?? 0,
      y: row.y ?? 0,
      confidence: row.confidence ?? 0,
      frameId: row.frame_id,
      swish: row.swish
    }));

  const overviewRow = overviewRows[0];

  return {
    overview: {
      attempts: overviewRow?.attempts ?? 0,
      made: overviewRow?.made ?? 0,
      missed: overviewRow?.missed ?? 0,
      fgPercent: overviewRow?.fg_percent ?? 0,
      consistency: overviewRow?.consistency ?? 0,
      avgStreak: overviewRow?.avg_streak ?? 0,
      swishRate: overviewRow?.swish_rate ?? 0
    },
    sessions,
    progress,
    shotMap,
    totalShotsRecorded: overviewRow?.attempts ?? 0,
    source: "live",
    updatedAt: new Date().toISOString()
  };
}
