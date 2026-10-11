"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

export function supabaseBrowser() {
  return createBrowserClient(
    SUPABASE_URL,
    SUPABASE_KEY,
  );
}
