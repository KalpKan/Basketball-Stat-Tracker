import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DemoDataBanner } from "./demo-data-banner";

test("shows the sample-data banner with the settings hint when the Supabase env is missing", () => {
  const html = renderToStaticMarkup(<DemoDataBanner source="mock" />);
  assert.match(html, /Sample data/);
  assert.match(html, /SUPABASE_URL/);
});

test("shows an outage banner, without the settings hint, when the query failed", () => {
  const html = renderToStaticMarkup(<DemoDataBanner source="mock" dataError="fetch failed" />);
  assert.match(html, /could not be reached/);
  assert.doesNotMatch(html, /SUPABASE_URL/);
});

test("renders nothing when the dashboard is on live data", () => {
  const html = renderToStaticMarkup(<DemoDataBanner source="live" />);
  assert.equal(html, "");
});
