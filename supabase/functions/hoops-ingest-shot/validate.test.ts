import assert from "node:assert/strict";
import { test } from "node:test";
import { validateShotEvent } from "./validate.ts";

const now = new Date("2026-09-18T20:00:00Z");
const valid = {
  id: "11111111-1111-4111-8111-111111111111",
  deviceId: "iphone-15-pro-debug",
  sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  capturedAt: "2026-09-18T19:40:00.000Z",
  result: "made",
  x: 0.52,
  y: 0.41,
  confidence: 1
};

test("accepts the handoff doc's event", () => {
  assert.equal(validateShotEvent(valid, now), null);
});

test("rejects an epoch-zero timestamp (the 1970 session can never recur)", () => {
  assert.match(validateShotEvent({ ...valid, capturedAt: "1970-01-01T00:00:00Z" }, now) ?? "", /2000-01-01/);
});

test("rejects a timestamp more than one day in the future", () => {
  assert.match(validateShotEvent({ ...valid, capturedAt: "2026-10-19T01:34:51Z" }, now) ?? "", /future/);
  assert.equal(validateShotEvent({ ...valid, capturedAt: "2026-09-19T10:00:00Z" }, now), null, "clock skew of a few hours is fine");
});

test("rejects the round-1 bad inputs", () => {
  assert.match(validateShotEvent({ ...valid, x: 1.5 }, now) ?? "", /between 0 and 1/);
  assert.match(validateShotEvent({ ...valid, capturedAt: "yesterday" }, now) ?? "", /ISO-8601/);
  assert.match(validateShotEvent({ ...valid, result: "airball" }, now) ?? "", /result/);
  assert.match(validateShotEvent({ x: 1.5 }, now) ?? "", /Missing field/);
  assert.match(validateShotEvent(null, now) ?? "", /JSON/);
});
