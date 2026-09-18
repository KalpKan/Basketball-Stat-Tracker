import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DemoDataBanner } from "./demo-data-banner";

test("shows the Demo data banner when the dashboard is on mock data", () => {
  const html = renderToStaticMarkup(<DemoDataBanner source="mock" />);
  assert.match(html, /Demo data/);
  assert.match(html, /SUPABASE_URL/);
});

test("renders nothing when the dashboard is on live data", () => {
  const html = renderToStaticMarkup(<DemoDataBanner source="live" />);
  assert.equal(html, "");
});
