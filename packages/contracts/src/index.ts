export type ShotResult = "made" | "missed";

export interface ShotEvent {
  id: string;
  sessionId: string;
  capturedAt: string;
  result: ShotResult;
  x: number;
  y: number;
  confidence: number;
  frameId?: string | null;
  swish?: boolean | null;
}

export interface IngestShotRequest extends ShotEvent {
  deviceId: string;
  sessionTitle?: string | null;
}

export interface SessionSummary {
  /** Canonical session id (one row per device per UTC day). Pills, bars, rows and shots all key on it. */
  sessionId: string;
  deviceId: string;
  title: string | null;
  startedAt: string;
  lastShotAt: string | null;
  /** YYYY-MM-DD in UTC; the merge key. */
  utcDay: string;
  /** Short label ("Apr 15", "Apr 15, 2025"), formatted once on the server in UTC. Same string on pill, bar and row. */
  label: string;
  /** Longer label for the table ("Wed, Apr 15"). */
  dateLabel: string;
  attempts: number;
  made: number;
  missed: number;
  fgPercent: number;
  efgPercent: number;
  swishRate: number;
  bestStreak: number;
}

export interface DashboardOverview {
  attempts: number;
  made: number;
  missed: number;
  fgPercent: number;
  /** 100 - 2 * sample stddev of the visible sessions' FG%; null when fewer than 2 sessions. */
  consistency: number | null;
  avgStreak: number;
  swishRate: number;
}

export interface DashboardProgressPoint {
  sessionId: string;
  label: string;
  fgPercent: number;
  efgPercent: number;
  streak: number;
}

export interface DashboardPayload {
  overview: DashboardOverview;
  sessions: SessionSummary[];
  progress: DashboardProgressPoint[];
  shotMap: ShotEvent[];
  /** Every shot row in the database, including hidden ones. */
  totalShotsRecorded: number;
  /** Shots excluded because their timestamp (or their session's) is before 2000-01-01. */
  hiddenShots: number;
  source: "live" | "mock";
  /** Set when Supabase is configured but the query failed; the page then shows sample rows with an outage banner. */
  dataError?: string;
  updatedAt: string;
}
