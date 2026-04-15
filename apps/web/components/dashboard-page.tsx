"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { DashboardPayload, DashboardProgressPoint, ShotEvent } from "../lib/contracts";

type TabKey = "shot-map" | "analytics";
type ChartMode = "fg" | "efg" | "streak";

export function DashboardPage({ initialData }: { initialData: DashboardPayload }) {
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<TabKey>("analytics");
  const [chartMode, setChartMode] = useState<ChartMode>("fg");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("all");

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        if (!response.ok) return;
        const next = (await response.json()) as DashboardPayload;
        if (alive) {
          setData(next);
        }
      } catch {
        return;
      }
    };

    const intervalId = window.setInterval(load, 5000);

    return () => {
      alive = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const filteredSessions = useMemo(() => {
    if (selectedSessionId === "all") {
      return data.sessions;
    }
    return data.sessions.filter(session => session.sessionId === selectedSessionId);
  }, [data.sessions, selectedSessionId]);

  const filteredShotMap = useMemo(() => {
    if (selectedSessionId === "all") {
      return data.shotMap;
    }
    return data.shotMap.filter(shot => shot.sessionId === selectedSessionId);
  }, [data.shotMap, selectedSessionId]);

  const selectedSummary = useMemo(() => {
    if (selectedSessionId === "all") {
      return data.overview;
    }

    const match = data.sessions.find(session => session.sessionId === selectedSessionId);
    if (!match) {
      return data.overview;
    }

    return {
      attempts: match.attempts,
      made: match.made,
      missed: match.missed,
      fgPercent: match.fgPercent,
      consistency: data.overview.consistency,
      avgStreak: match.bestStreak,
      swishRate: match.swishRate
    };
  }, [data.overview, data.sessions, selectedSessionId]);

  const progressPoints = useMemo(() => {
    if (selectedSessionId === "all") {
      return data.progress;
    }

    const match = data.sessions.find(session => session.sessionId === selectedSessionId);
    if (!match) {
      return data.progress;
    }

    return [
      {
        label: formatPillLabel(match.startedAt),
        fgPercent: match.fgPercent,
        efgPercent: match.efgPercent,
        streak: match.bestStreak
      }
    ];
  }, [data.progress, data.sessions, selectedSessionId]);

  const makes = filteredShotMap.filter(shot => shot.result === "made").length;
  const misses = filteredShotMap.filter(shot => shot.result === "missed").length;
  const madeRate = makes + misses === 0 ? 0 : (makes / (makes + misses)) * 100;
  const missRate = makes + misses === 0 ? 0 : (misses / (makes + misses)) * 100;

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-8 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-6 border-b border-white/10 pb-8 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="inline-flex items-center gap-4 rounded-[1.75rem] border border-white/15 bg-white/[0.06] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_12px_34px_rgba(0,0,0,0.28)]">
                <img src="/basketball-logo.svg" alt="Basketball" className="h-9 w-9" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Hoops Analytics</h1>
                <p className="text-base text-white/40">Track your shooting performance</p>
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <TabButton active={activeTab === "shot-map"} onClick={() => setActiveTab("shot-map")}>
                Shot Map
              </TabButton>
              <TabButton active={activeTab === "analytics"} onClick={() => setActiveTab("analytics")}>
                Analytics
              </TabButton>
            </div>
          </div>
          <div className="space-y-2 text-right">
            <div className="text-sm text-white/40">{data.totalShotsRecorded} shots recorded</div>
            <LiveDataLabel source={data.source} />
          </div>
        </header>

        <section className="flex gap-3 overflow-x-auto pb-2">
          <FilterPill
            active={selectedSessionId === "all"}
            label="All Sessions"
            onClick={() => setSelectedSessionId("all")}
          />
          {data.sessions.map(session => (
            <FilterPill
              key={session.sessionId}
              active={selectedSessionId === session.sessionId}
              label={formatPillLabel(session.startedAt)}
              onClick={() => setSelectedSessionId(session.sessionId)}
            />
          ))}
        </section>

        {activeTab === "analytics" ? (
          <>
            <section>
              <h2 className="mb-5 text-xl font-semibold">Overview</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Shots Made" value={String(selectedSummary.made)} meta={`of ${selectedSummary.attempts}`} />
                <MetricCard label="Field Goal %" value={`${selectedSummary.fgPercent.toFixed(1)}%`} meta={`${selectedSummary.missed} misses`} accent />
                <MetricCard label="Consistency" value={`${selectedSummary.consistency.toFixed(1)}%`} meta={`${selectedSummary.swishRate.toFixed(1)}% swish rate`} />
                <MetricCard label="Avg Streak" value={selectedSummary.avgStreak.toFixed(1)} meta="makes in a row" />
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-6">
              <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Progress</h2>
                  <p className="mt-2 text-sm text-white/40">Track your improvement over time</p>
                </div>
                <div className="flex rounded-full bg-white/5 p-1 text-sm text-white/60 ring-1 ring-white/10">
                  <ChartToggle active={chartMode === "fg"} onClick={() => setChartMode("fg")}>FG%</ChartToggle>
                  <ChartToggle active={chartMode === "efg"} onClick={() => setChartMode("efg")}>eFG%</ChartToggle>
                  <ChartToggle active={chartMode === "streak"} onClick={() => setChartMode("streak")}>Streak</ChartToggle>
                </div>
              </div>
              <ProgressChart points={progressPoints} mode={chartMode} />
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-6">
              <h2 className="text-2xl font-semibold">Key Metrics</h2>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <InfoBlock title="Field Goal Percentage (FG%)" description="Ratio of made shots to attempted shots. The fundamental measure of shooting accuracy." />
                <InfoBlock title="Swish Rate" description="Percentage of makes that went cleanly through the net without touching the rim." />
                <InfoBlock title="Effective Field Goal % (eFG%)" description="For this mini-hoop build, swishes are weighted to reflect cleaner makes and better touch." />
                <InfoBlock title="Consistency" description="A stability score based on how tightly clustered your session FG% values are over time." />
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-6">
              <h2 className="text-2xl font-semibold">Session History</h2>
              <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/[0.03] text-white/45">
                    <tr>
                      <th className="px-5 py-4 font-medium">Date</th>
                      <th className="px-5 py-4 font-medium">Attempts</th>
                      <th className="px-5 py-4 font-medium">Made</th>
                      <th className="px-5 py-4 font-medium">FG%</th>
                      <th className="px-5 py-4 font-medium">EFG%</th>
                      <th className="px-5 py-4 font-medium">Best Streak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.map(session => (
                      <tr key={session.sessionId} className="border-t border-white/10">
                        <td className="px-5 py-4 text-white">{formatTableDate(session.startedAt)}</td>
                        <td className="px-5 py-4 text-white/60">{session.attempts}</td>
                        <td className="px-5 py-4 text-white/60">{session.made}</td>
                        <td className="px-5 py-4 font-semibold text-white">{session.fgPercent.toFixed(1)}%</td>
                        <td className="px-5 py-4 text-white/60">{session.efgPercent.toFixed(1)}%</td>
                        <td className="px-5 py-4 text-green-400">{session.bestStreak}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-6">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-semibold">Shot Map</h2>
                <p className="mt-2 text-sm text-white/40">Top-down view of where shots landed in the basket</p>
              </div>
              <div className="text-sm text-white/40">{filteredShotMap.length} tracked attempts</div>
            </div>
            <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
              <ShotMap shots={filteredShotMap} />
              <div className="space-y-4">
                <ShotLegend />
                <StatTile value={`${madeRate.toFixed(1)}%`} label="Made rate" tone="green" />
                <StatTile value={`${missRate.toFixed(1)}%`} label="Miss rate" tone="orange" />
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function LiveDataLabel({ source }: { source: DashboardPayload["source"] }) {
  const isLive = source === "live";

  return (
    <div className="inline-flex items-center justify-end gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs uppercase tracking-[0.22em] text-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl">
      {isLive ? (
        <span className="relative flex h-2.5 w-2.5" aria-label="Live">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
        </span>
      ) : null}
      <span>{source} data</span>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-5 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_12px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl transition ${
        active
          ? "border-green-300/30 bg-green-500/18 text-green-300"
          : "border-white/10 bg-white/[0.06] text-white/60"
      }`}
    >
      {children}
    </button>
  );
}

function FilterPill({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-5 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_14px_42px_rgba(0,0,0,0.28)] backdrop-blur-xl transition ${
        active
          ? "border-green-300/35 bg-green-400/85 text-black"
          : "border-white/10 bg-white/[0.06] text-white/70"
      }`}
    >
      {label}
    </button>
  );
}

function MetricCard({
  label,
  value,
  meta,
  accent = false
}: {
  label: string;
  value: string;
  meta?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[1.75rem] border p-6 ${
        accent ? "border-green-500/40 bg-green-500/5" : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <p className="text-sm text-white/35">{label}</p>
      <div className="mt-8 flex items-end justify-between gap-4">
        <div className="text-4xl font-semibold tracking-tight">{value}</div>
        {meta ? <div className="text-sm text-green-400">{meta}</div> : null}
      </div>
    </div>
  );
}

function ChartToggle({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 transition ${active ? "bg-white/10 text-white" : "text-white/55"}`}
    >
      {children}
    </button>
  );
}

function ProgressChart({
  points,
  mode
}: {
  points: DashboardProgressPoint[];
  mode: ChartMode;
}) {
  const values = points.map(point => getChartValue(point, mode));
  const maxValue = Math.max(...values, 1);

  return (
    <div className="h-72 rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-6">
      <div className="flex h-full items-end gap-4">
        {points.map(point => {
          const value = getChartValue(point, mode);
          const height = mode === "streak" ? (value / maxValue) * 100 : value;

          return (
            <div key={`${point.label}-${mode}`} className="flex flex-1 flex-col items-center gap-3">
              <div className="w-full rounded-t-xl bg-green-500/75 shadow-[0_0_30px_rgba(35,197,82,0.18)]" style={{ height: `${Math.max(height, 12)}%` }} />
              <span className="text-xs text-white/35">{point.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShotMap({ shots }: { shots: ShotEvent[] }) {
  return (
    <div className="relative flex min-h-[520px] items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-[#050505]">
      <svg
        aria-label="Shot map"
        className="h-[min(72vw,460px)] max-h-[460px] min-h-[320px] w-[min(72vw,460px)] max-w-[460px] min-w-[320px]"
        viewBox="0 0 200 200"
        role="img"
      >
        <circle cx="100" cy="100" r="88" fill="rgba(255,138,102,0.04)" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <circle
          cx="100"
          cy="100"
          r="68"
          fill="transparent"
          stroke="#ff6f55"
          strokeWidth="8"
          filter="drop-shadow(0 0 14px rgba(255,111,85,0.45))"
        />
        <circle
          cx="100"
          cy="100"
          r="38"
          fill="transparent"
          stroke="rgba(255,111,85,0.5)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        {shots.map(shot => (
          <circle
            key={shot.id}
            cx={shot.x * 200}
            cy={shot.y * 200}
            r="3.5"
            fill={shot.result === "made" ? "rgba(34,197,94,0.9)" : "rgba(239,68,68,0.9)"}
          >
            <title>{`${shot.result} ${Math.round(shot.confidence * 100)}%`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

function ShotLegend() {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.02] p-5">
      <div className="space-y-3 text-sm text-white/60">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-green-500" />
          Made
        </div>
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          Missed
        </div>
      </div>
    </div>
  );
}

function StatTile({
  value,
  label,
  tone
}: {
  value: string;
  label: string;
  tone: "green" | "orange";
}) {
  const toneClass = tone === "green" ? "text-green-400" : "text-orange-300";

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.02] p-6">
      <div className={`text-5xl font-semibold tracking-tight ${toneClass}`}>{value}</div>
      <div className="mt-2 text-sm text-white/45">{label}</div>
    </div>
  );
}

function InfoBlock({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-base font-medium text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/45">{description}</p>
    </div>
  );
}

function getChartValue(point: DashboardProgressPoint, mode: ChartMode) {
  if (mode === "efg") return point.efgPercent;
  if (mode === "streak") return point.streak;
  return point.fgPercent;
}

function formatPillLabel(dateValue: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(dateValue));
}

function formatTableDate(dateValue: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(dateValue));
}
