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

export interface SessionSummary {
  sessionId: string;
  deviceId: string;
  startedAt: string;
  lastShotAt: string | null;
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
  consistency: number;
  avgStreak: number;
  swishRate: number;
}

export interface DashboardProgressPoint {
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
  totalShotsRecorded: number;
  source: "live" | "mock";
  updatedAt: string;
}
