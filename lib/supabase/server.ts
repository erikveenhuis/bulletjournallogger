import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabaseClient() {
  const store = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const getter = (store as unknown as { getAll?: () => Array<{ name: string; value: string }> }).getAll;
          return typeof getter === "function" ? getter() : [];
        },
        setAll(cookiesToSet) {
          const setter = (store as unknown as { set?: (name: string, value: string, options?: Record<string, unknown>) => void }).set;
          if (!setter) return;
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              setter(name, value, options);
            });
          } catch {
            // Next.js prohibits cookie mutation during RSC rendering; ignore because
            // session cookies will refresh when a response context is available.
          }
        },
      },
    },
  );
}
