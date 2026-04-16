import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function createServiceClient(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    throw new Error(
      "Supabase が未設定です。SUPABASE_URL（または NEXT_PUBLIC_SUPABASE_URL）と SUPABASE_SERVICE_ROLE_KEY を設定してください。"
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
