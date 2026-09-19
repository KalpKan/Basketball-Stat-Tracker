"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { DemoDataBanner } from "./demo-data-banner";
import { capture } from "../lib/posthog";
import type { DashboardPayload, DashboardProgressPoint, ShotEvent } from "../lib/contracts";

const REPO_URL = "https://github.com/KalpKan/Basketball-Stat-Tracker";

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
      // one session has nothing to be consistent with
      consistency: null,
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

    return data.progress.filter(point => point.sessionId === selectedSessionId);
  }, [data.progress, data.sessions, selectedSessionId]);

  const sessionCount = filteredSessions.length;
  const sessionBasis = `over ${sessionCount} session${sessionCount === 1 ? "" : "s"}`;

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
                <p className="text-base text-white/60">Mini-hoop shooting sessions, shot by shot</p>
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
          <div className="space-y-2 md:text-right">
            <div className="text-sm text-white/60">{data.overview.attempts} shots recorded</div>
            <LiveDataLabel source={data.source} />
          </div>
        </header>

        <p className="-mt-2 text-sm leading-6 text-white/60">
          The iPhone capture app is not available yet. These sessions were recorded through the ingest API for
          testing.{" "}
          <a
            href={REPO_URL}
            className="text-green-300 underline decoration-green-300/40 underline-offset-4 hover:text-green-200"
            target="_blank"
            rel="noreferrer"
          >
            Source and API on GitHub
          </a>
          {data.hiddenShots > 0 ? (
            <span className="text-white/60">
              {" "}· {data.hiddenShots} shot{data.hiddenShots === 1 ? "" : "s"} with an invalid timestamp hidden
            </span>
          ) : null}
        </p>

        <DemoDataBanner source={data.source} dataError={data.dataError} />

        <section className="flex gap-3 overflow-x-auto pb-2">
          <FilterPill
            active={selectedSessionId === "all"}
            label="All Sessions"
            onClick={() => {
              setSelectedSessionId("all");
              capture("session_viewed", { session: "all" });
            }}
          />
          {data.sessions.map(session => (
            <FilterPill
              key={session.sessionId}
              active={selectedSessionId === session.sessionId}
              label={session.label}
              title={session.title ?? session.deviceId}
              onClick={() => {
                setSelectedSessionId(session.sessionId);
                capture("session_viewed", { session: session.sessionId, attempts: session.attempts });
              }}
            />
          ))}
        </section>

        {activeTab === "analytics" ? (
          <>
            <section>
              <h2 className="mb-5 text-xl font-semibold">Overview</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Shots Made" value={String(selectedSummary.made)} meta={`of ${selectedSummary.attempts} attempts, ${sessionBasis}`} />
                <MetricCard label="Field Goal %" value={`${selectedSummary.fgPercent.toFixed(1)}%`} meta={`${selectedSummary.missed} misses · ${selectedSummary.swishRate.toFixed(1)}% swish rate`} accent />
                <MetricCard
                  label="Consistency"
                  value={selectedSummary.consistency === null ? "n/a" : `${selectedSummary.consistency.toFixed(1)}%`}
                  meta={selectedSummary.consistency === null ? `needs 2 sessions (${sessionBasis})` : `100 − 2·σ of FG% ${sessionBasis}`}
                />
                <MetricCard
                  label="Avg Streak"
                  value={selectedSummary.avgStreak.toFixed(1)}
                  meta={sessionCount === 1 ? "best run of makes in a row" : `avg of ${sessionCount} best streaks`}
                />
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-6">
              <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Progress</h2>
                  <p className="mt-2 text-sm text-white/60">One bar per session, oldest to newest (dates in UTC)</p>
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
                <InfoBlock title="Effective Field Goal % (eFG%)" description="Mini-hoop proxy: a swish counts as one and a half makes, and the bonus is added to the attempts too, so the score never passes 100%: (made + 0.5 × swishes) ÷ (attempts + 0.5 × swishes)." />
                <InfoBlock title="Consistency" description="100 minus twice the sample standard deviation of the FG% of the sessions shown, so it is computed on the same rows as the Session History table. Needs at least two sessions." />
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-6">
              <h2 className="text-2xl font-semibold">Session History</h2>
              <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-white/[0.03] text-white/60">
                    <tr>
                      <th className="px-5 py-4 font-medium">Date</th>
                      <th className="px-5 py-4 font-medium">Session</th>
                      <th className="px-5 py-4 font-medium">Attempts</th>
                      <th className="px-5 py-4 font-medium">Made</th>
                      <th className="px-5 py-4 font-medium">FG%</th>
                      <th className="px-5 py-4 font-medium">eFG%</th>
                      <th className="px-5 py-4 font-medium">Best Streak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.map(session => (
                      <tr key={session.sessionId} className="border-t border-white/10">
                        <td className="whitespace-nowrap px-5 py-4 text-white">{session.dateLabel}</td>
                        <td className="max-w-[16rem] truncate px-5 py-4 text-white/60" title={session.deviceId}>
                          {session.title ?? session.deviceId}
                        </td>
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
                <p className="mt-2 text-sm text-white/60">Top-down view of where shots landed in the basket</p>
              </div>
              <div className="text-sm text-white/60">{filteredShotMap.length} tracked attempts</div>
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
    <div className="inline-flex items-center justify-end gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs uppercase tracking-[0.22em] text-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl">
      {isLive ? (
        <span className="relative flex h-2.5 w-2.5" role="img" aria-label="Live">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
        </span>
      ) : null}
      <span>{isLive ? "live data" : "sample data"}</span>
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
  title,
  onClick
}: {
  active: boolean;
  label: string;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
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
      <p className="text-sm text-white/60">{label}</p>
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
      className={`min-h-10 rounded-full px-4 py-2 transition ${active ? "bg-white/10 text-white" : "text-white/60"}`}
    >
      {children}
    </button>
  );
}

const PLOT_HEIGHT_PX = 208;
const MIN_COLUMN_PX = 44;

// Bars are sized in pixels from a fixed plot height. A percentage height inside an auto-height
// flex column resolves to 0 px (the round-1 blocker), so nothing here uses percentage heights.
export function ProgressChart({
  points,
  mode
}: {
  points: DashboardProgressPoint[];
  mode: ChartMode;
}) {
  const values = points.map(point => getChartValue(point, mode));
  const isPercent = mode !== "streak";
  const axisMax = isPercent ? 100 : Math.max(1, ...values);
  const ticks = isPercent ? [100, 75, 50, 25, 0] : [axisMax, Math.round(axisMax / 2), 0];
  const format = (value: number) => (isPercent ? `${value.toFixed(1)}%` : String(value));
  const unit = mode === "fg" ? "FG%" : mode === "efg" ? "eFG%" : "best streak";

  if (points.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.025] text-sm text-white/60">
        No sessions yet
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-4 sm:p-6">
      <div className="flex gap-3">
        <div className="relative mt-5 w-10 shrink-0 text-right text-xs tabular-nums text-white/60" style={{ height: `${PLOT_HEIGHT_PX}px` }}>
          {ticks.map(tick => (
            <span
              key={tick}
              data-tick={String(tick)}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${PLOT_HEIGHT_PX - (tick / axisMax) * PLOT_HEIGHT_PX}px` }}
            >
              {isPercent ? `${tick}%` : tick}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto pb-1 pt-5">
          <div style={{ minWidth: `${points.length * MIN_COLUMN_PX}px` }}>
            <div className="relative" style={{ height: `${PLOT_HEIGHT_PX}px` }}>
              {ticks.map(tick => (
                <div
                  key={tick}
                  aria-hidden="true"
                  className={`absolute inset-x-0 border-t ${tick === 0 ? "border-white/25" : "border-dashed border-white/10"}`}
                  style={{ top: `${PLOT_HEIGHT_PX - (tick / axisMax) * PLOT_HEIGHT_PX}px` }}
                />
              ))}
              <div className="absolute inset-0 flex items-end gap-2">
                {points.map((point, index) => {
                  const value = values[index];
                  const barPx = Math.max(2, Math.round((value / axisMax) * PLOT_HEIGHT_PX));
                  return (
                    <div key={`${point.sessionId}-${mode}`} className="flex flex-1 justify-center" style={{ minWidth: `${MIN_COLUMN_PX - 8}px` }}>
                      <div className="relative w-full max-w-[56px]">
                        <span className="absolute inset-x-0 -top-5 text-center text-[11px] tabular-nums text-white/85">{format(value)}</span>
                        <div
                          data-bar={point.sessionId}
                          title={`${point.label}: ${format(value)} ${unit}`}
                          className="w-full rounded-t bg-green-500/80 shadow-[0_0_30px_rgba(35,197,82,0.18)]"
                          style={{ height: `${barPx}px` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              {points.map(point => (
                <span
                  key={`${point.sessionId}-label`}
                  className={`flex-1 truncate text-center text-white/60 ${points.length > 8 ? "text-[10px]" : "text-xs"}`}
                  style={{ minWidth: `${MIN_COLUMN_PX - 8}px` }}
                  title={point.label}
                >
                  {point.label}
                </span>
              ))}
            </div>
          </div>
        </div>
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
      <div className="mt-2 text-sm text-white/60">{label}</div>
    </div>
  );
}

function InfoBlock({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-base font-medium text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>
    </div>
  );
}

function getChartValue(point: DashboardProgressPoint, mode: ChartMode) {
  if (mode === "efg") return point.efgPercent;
  if (mode === "streak") return point.streak;
  return point.fgPercent;
}
