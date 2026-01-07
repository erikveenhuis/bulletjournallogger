import Link from "next/link";
import HeaderNav from "@/components/header-nav";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function Header() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("is_admin").eq("user_id", user.id).maybeSingle()
    : { data: null };

  return (
    <header className="bujo-header">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:h-16 sm:flex-nowrap sm:justify-between sm:py-0">
        <Link href="/" className="bujo-brand text-sm">
          Bullet Journal Logger
        </Link>
        <HeaderNav showAdmin={!!profile?.is_admin} isSignedIn={!!user} />
      </div>
    </header>
  );
}
