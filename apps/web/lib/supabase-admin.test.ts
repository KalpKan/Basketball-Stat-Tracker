import assert from "node:assert/strict";
import { test } from "node:test";
import { getSupabaseAdmin, HOOPS_SCHEMA } from "./supabase-admin";

test("returns null when Supabase env is missing", () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.service_role_key;
  assert.equal(getSupabaseAdmin(), null);
});

test("client is scoped to the hoops schema in Project B", () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  const client = getSupabaseAdmin();
  assert.ok(client, "client should be created when env is present");
  assert.equal(HOOPS_SCHEMA, "hoops");
  // supabase-js keeps the configured schema on the REST client and every query
  // builder; PostgREST receives it as the Accept-Profile / Content-Profile header.
  const rest = (client as unknown as { rest: { schemaName: string } }).rest;
  assert.equal(rest.schemaName, "hoops");
  const query = client.from("sessions").select("id") as unknown as { schema: string; url: URL };
  assert.equal(query.schema, "hoops");
  assert.equal(query.url.pathname, "/rest/v1/sessions");
});
