import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut({ scope: "local" });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bulletjournallogger.up.railway.app";
  return NextResponse.redirect(new URL("/", siteUrl));
}
