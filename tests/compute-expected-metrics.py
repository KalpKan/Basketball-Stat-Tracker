#!/usr/bin/env python3
"""Ground truth for the hoops dashboard, computed from raw rows with no SQL and no app code.

  python3 tests/compute-expected-metrics.py                  # rewrite tests/fixtures/hoops-expected-metrics.json
  python3 tests/compute-expected-metrics.py --check payload.json   # compare a saved /api/dashboard payload
  python3 tests/compute-expected-metrics.py --rows tests/fixtures/synthetic-30-sessions.json --out tests/fixtures/synthetic-30-expected-metrics.json

Formulas are the ones the README documents:
  FG%        = 100 * made / attempts
  eFG% (v1)  = 100 * (made + 0.5 * swishes) / attempts        (README calls it a proxy; note it can exceed 100)
  swish rate = 100 * swishes / made
  best streak = longest run of consecutive "made" ordered by (captured_at, id)
  consistency = max(0, min(100, 100 - 2 * sample_stddev(FG% of every session with attempts > 0)))
The dashboard merges every session that starts on the same UTC calendar day into one "day-YYYY-MM-DD"
row, so both bases (raw session and UTC day) are written out. Values are rounded half-up to 1 decimal,
the way Postgres round() and JS toFixed(1) behave, so they can be compared to the app directly.
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
        "efg_percent": r1(100 * (made + 0.5 * swishes) / attempts) if attempts else 0.0,
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
            "overall": overall, "per_utc_day": per_day, "per_session": per_session}


def check(expected, payload_path):
    p = json.load(open(payload_path))
    fails = []
    def eq(name, got, want):
        if got != want:
            fails.append(f"{name}: dashboard={got} expected={want}")
    o, e = p["overview"], expected["overall"]
    for k in ("attempts", "made", "missed"):
        eq(f"overview.{k}", o[k], e[k])
    eq("overview.fgPercent", o["fgPercent"], e["fg_percent"])
    eq("overview.swishRate", o["swishRate"], e["swish_rate"])
    eq("totalShotsRecorded", p["totalShotsRecorded"], e["attempts"])
    days = {d["day_id"]: d for d in expected["per_utc_day"]}
    for s in p["sessions"]:
        d = days.get(s["sessionId"])
        if not d:
            fails.append(f"session {s['sessionId']} not in ground truth")
            continue
        for k_app, k_gt in (("attempts", "attempts"), ("made", "made"), ("missed", "missed"), ("fgPercent", "fg_percent"),
                            ("efgPercent", "efg_percent"), ("swishRate", "swish_rate"), ("bestStreak", "best_streak")):
            eq(f"{s['sessionId']}.{k_app}", s[k_app], d[k_gt])
    eq("shotMap length", len(p["shotMap"]), e["attempts"])
    # Consistency and avg streak are reported on whichever basis the app documents; both are printed.
    print(f"consistency: dashboard={o['consistency']} (raw-session basis {e['consistency_raw_session_basis']}, utc-day basis {e['consistency_utc_day_basis']})")
    print(f"avgStreak:   dashboard={o['avgStreak']} (raw-session basis {e['avg_best_streak_raw_session_basis']}, utc-day basis {e['avg_best_streak_utc_day_basis']})")
    print("\n".join(fails) if fails else "all counts, FG%, eFG%, swish rate and streaks match the ground truth")
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
