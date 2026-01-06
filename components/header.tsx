import Link from "next/link";
import NavLinks from "@/components/nav-links";
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
        <nav className="bujo-nav flex w-full flex-wrap items-center justify-end gap-2 text-sm font-medium text-gray-800 sm:w-auto">
          <NavLinks showAdmin={!!profile?.is_admin} />
          {user ? (
            <form action="/api/auth/signout" method="post" className="w-full sm:w-auto">
              <button
                type="submit"
                className="bujo-btn-secondary w-full justify-center text-sm sm:w-auto"
              >
                Sign out
              </button>
            </form>
          ) : (
            <Link
              href="/sign-in"
              className="bujo-btn-secondary w-full justify-center text-sm sm:w-auto"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
