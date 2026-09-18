import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Basketball's tables live in the "hoops" schema of the shared Supabase Project B.
// Every query through this client is scoped to that schema (Accept-Profile header),
// so the app never reads or writes another app's schema.
export const HOOPS_SCHEMA = "hoops" as const;

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.service_role_key;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient<Database, typeof HOOPS_SCHEMA>(supabaseUrl, serviceRoleKey, {
    db: { schema: HOOPS_SCHEMA },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
