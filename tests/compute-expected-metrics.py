#!/usr/bin/env python3
"""Ground truth for the hoops dashboard, computed from raw rows with no SQL and no app code.

  python3 tests/compute-expected-metrics.py                  # rewrite tests/fixtures/hoops-expected-metrics.json
  python3 tests/compute-expected-metrics.py --check payload.json   # compare a saved /api/dashboard payload
  python3 tests/compute-expected-metrics.py --rows tests/fixtures/synthetic-30-sessions.json --out tests/fixtures/synthetic-30-expected-metrics.json

Formulas are the ones the README documents:
  FG%        = 100 * made / attempts
  eFG% (v2)  = 100 * (made + 0.5 * swishes) / (attempts + 0.5 * swishes)   (bounded: never above 100; v1 divided by attempts only)
  swish rate = 100 * swishes / made
  best streak = longest run of consecutive "made" ordered by (captured_at, id)
  consistency = max(0, min(100, 100 - 2 * sample_stddev(FG% of every session with attempts > 0)))
Three bases are written out: raw session (per_session), UTC calendar day across devices (per_utc_day, the
pre-2026-09-18 dashboard merge) and the "dashboard" block, which is what https://hoops.kalpkan.com must show
since the round-1 fix: one row per (device, UTC day), sessions whose started_at is before 2000-01-01 (and
any shot captured before 2000) hidden and excluded from every number, Consistency and Avg Streak on that
same basis. Values are rounded half-up to 1 decimal, the way Postgres round() and JS toFixed(1) behave, so
they can be compared to the app directly.
"""
import json, sys, os
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

HERE = os.path.dirname(os.path.abspath(__file__))
ROWS = os.path.join(HERE, "fixtures", "hoops-rows-2026-09-18.json")
OUT = os.path.join(HERE, "fixtures", "hoops-expected-metrics.json")


def r1(x):
    return float(Decimal(str(x)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def stdev_sample(values):
    n = len(values)
    if n < 2:
        return 0.0
    mean = sum(values) / n
    return (sum((v - mean) ** 2 for v in values) / (n - 1)) ** 0.5


def best_streak(events):
    best = cur = 0
    for e in sorted(events, key=lambda e: (e["captured_at"], e["id"])):
        if e["result"] == "made":
            cur += 1
            best = max(best, cur)
        else:
            cur = 0
    return best


def metrics(events):
    attempts = len(events)
    made = sum(e["result"] == "made" for e in events)
    swishes = sum(bool(e.get("swish")) for e in events)
    return {
        "attempts": attempts,
        "made": made,
        "missed": attempts - made,
        "swishes": swishes,
        "fg_percent": r1(100 * made / attempts) if attempts else 0.0,
        "efg_percent": r1(100 * (made + 0.5 * swishes) / (attempts + 0.5 * swishes)) if attempts else 0.0,
        "swish_rate": r1(100 * swishes / made) if made else 0.0,
        "best_streak": best_streak(events),
        "last_shot_at": max(e["captured_at"] for e in events) if events else None,
    }


def compute(rows):
    sessions = {s["id"]: s for s in rows["sessions"]}
    by_session = defaultdict(list)
    for e in rows["shot_events"]:
        by_session[e["session_id"]].append(e)

    per_session = []
    for sid, s in sorted(sessions.items(), key=lambda kv: kv[1]["started_at"]):
        m = metrics(by_session.get(sid, []))
        per_session.append({"session_id": sid, "device_id": s["device_id"], "title": s["title"], "started_at": s["started_at"], **m})

    by_day = defaultdict(list)
    for s in per_session:
        by_day[s["started_at"][:10]].append(s["session_id"])
    per_day = []
    for day in sorted(by_day):
        evs = [e for sid in by_day[day] for e in by_session[sid]]
        per_day.append({"day_id": f"day-{day}", "utc_day": day, "merged_sessions": by_day[day],
                        "device_ids": sorted({sessions[sid]["device_id"] for sid in by_day[day]}), **metrics(evs)})

    # Dashboard basis: one row per (device, UTC day), pre-2000 sessions/shots hidden.
    valid_sessions = [s for s in per_session if s["started_at"] >= "2000"]
    hidden_session_ids = {s["session_id"] for s in per_session if s["started_at"] < "2000"}
    by_device_day = defaultdict(list)
    for s in valid_sessions:
        by_device_day[(s["device_id"], s["started_at"][:10])].append(s["session_id"])
    dash_sessions = []
    kept_events = []
    for (device_id, day), sids in by_device_day.items():
        evs = [e for sid in sids for e in by_session[sid] if e["captured_at"] >= "2000"]
        kept_events.extend(evs)
        canonical = sessions[sids[0]]
        dash_sessions.append({"session_id": sids[0], "merged_sessions": sids, "device_id": device_id, "utc_day": day,
                              "title": canonical["title"], "started_at": canonical["started_at"], **metrics(evs)})
    dash_sessions.sort(key=lambda s: s["started_at"], reverse=True)
    dash_overall = metrics(kept_events)
    dash_fgs = [s["fg_percent"] for s in dash_sessions if s["attempts"] > 0]
    dash_streaks = [s["best_streak"] for s in dash_sessions if s["attempts"] > 0]
    dash_overall.update({
        "consistency": r1(max(0, min(100, 100 - 2 * stdev_sample(dash_fgs)))) if len(dash_fgs) >= 2 else None,
        "avg_best_streak": r1(sum(dash_streaks) / len(dash_streaks)) if dash_streaks else 0.0,
        "sessions": len(dash_sessions),
        "hidden_shots": sum(1 for e in rows["shot_events"] if e["captured_at"] < "2000" or e["session_id"] in hidden_session_ids),
        "total_shots_in_db": len(rows["shot_events"]),
    })
    dashboard = {"basis": "one row per (device_id, UTC day); sessions with started_at < 2000-01-01 hidden",
                 "overall": dash_overall, "sessions": dash_sessions}

    overall = metrics(rows["shot_events"])
    session_fgs = [s["fg_percent"] for s in per_session if s["attempts"] > 0]
    day_fgs = [d["fg_percent"] for d in per_day if d["attempts"] > 0]
    streaks_s = [s["best_streak"] for s in per_session if s["attempts"] > 0]
    streaks_d = [d["best_streak"] for d in per_day if d["attempts"] > 0]
    overall.update({
        "consistency_raw_session_basis": r1(max(0, min(100, 100 - 2 * stdev_sample(session_fgs)))),
        "consistency_utc_day_basis": r1(max(0, min(100, 100 - 2 * stdev_sample(day_fgs)))),
        "avg_best_streak_raw_session_basis": r1(sum(streaks_s) / len(streaks_s)) if streaks_s else 0.0,
        "avg_best_streak_utc_day_basis": r1(sum(streaks_d) / len(streaks_d)) if streaks_d else 0.0,
        "sessions": len(per_session),
        "utc_days": len(per_day),
        "shots_before_2000": sum(e["captured_at"] < "2000" for e in rows["shot_events"]),
        "shots_with_swish_null": sum(e.get("swish") is None for e in rows["shot_events"]),
        "sessions_with_efg_over_100": [s["session_id"] for s in per_session if s["efg_percent"] > 100],
    })
    return {"source_rows": os.path.basename(ROWS), "formulas": [l for l in __doc__.splitlines() if l.startswith("Formulas") or l.startswith("  FG%") or l.startswith("  eFG%") or l.startswith("  swish") or l.startswith("  best") or l.startswith("  consistency")],
            "overall": overall, "dashboard": dashboard, "per_utc_day": per_day, "per_session": per_session}


def check(expected, payload_path):
    """Compare a saved /api/dashboard payload with the dashboard-basis ground truth."""
    p = json.load(open(payload_path))
    fails = []
    def eq(name, got, want):
        if got != want:
            fails.append(f"{name}: dashboard={got} expected={want}")
    o, e = p["overview"], expected["dashboard"]["overall"]
    for k in ("attempts", "made", "missed"):
        eq(f"overview.{k}", o[k], e[k])
    eq("overview.fgPercent", o["fgPercent"], e["fg_percent"])
    eq("overview.swishRate", o["swishRate"], e["swish_rate"])
    eq("overview.consistency", o["consistency"], e["consistency"])
    eq("overview.avgStreak", o["avgStreak"], e["avg_best_streak"])
    eq("totalShotsRecorded", p["totalShotsRecorded"], e["total_shots_in_db"])
    eq("hiddenShots", p.get("hiddenShots"), e["hidden_shots"])
    want = {s["session_id"]: s for s in expected["dashboard"]["sessions"]}
    eq("sessions count", len(p["sessions"]), len(want))
    for s in p["sessions"]:
        d = want.get(s["sessionId"])
        if not d:
            fails.append(f"session {s['sessionId']} not in ground truth (startedAt {s.get('startedAt')})")
            continue
        for k_app, k_gt in (("attempts", "attempts"), ("made", "made"), ("missed", "missed"), ("fgPercent", "fg_percent"),
                            ("efgPercent", "efg_percent"), ("swishRate", "swish_rate"), ("bestStreak", "best_streak")):
            eq(f"{s['sessionId']}.{k_app}", s[k_app], d[k_gt])
        if s["efgPercent"] > 100:
            fails.append(f"{s['sessionId']}.efgPercent {s['efgPercent']} > 100")
        if s["startedAt"] < "2000":
            fails.append(f"{s['sessionId']} is a pre-2000 session and must be hidden")
    eq("shotMap length", len(p["shotMap"]), e["attempts"])
    print(f"consistency: dashboard={o['consistency']} expected={e['consistency']} (device+UTC-day basis, {e['sessions']} sessions)")
    print(f"avgStreak:   dashboard={o['avgStreak']} expected={e['avg_best_streak']} (same basis)")
    print(f"hidden:      dashboard={p.get('hiddenShots')} expected={e['hidden_shots']} of {e['total_shots_in_db']} shots")
    print("\n".join(fails) if fails else "all counts, FG%, eFG%, swish rate, streaks, consistency and hidden shots match the ground truth")
    return 1 if fails else 0


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--rows" in args:
        ROWS = args[args.index("--rows") + 1]
    if "--out" in args:
        OUT = args[args.index("--out") + 1]
    rows = json.load(open(ROWS))
    expected = compute(rows)
    if "--check" in args:
        sys.exit(check(expected, args[args.index("--check") + 1]))
    json.dump(expected, open(OUT, "w"), indent=1)
    print(f"wrote {OUT}")
    print(json.dumps(expected["overall"], indent=1))
