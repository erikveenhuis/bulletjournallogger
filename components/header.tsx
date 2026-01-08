import Link from "next/link";
import HeaderNav from "@/components/header-nav";
import { getEffectiveAdminStatus, getEffectiveUser, isImpersonating } from "@/lib/auth";

export default async function Header() {
  const { user: effectiveUser } = await getEffectiveUser();
  const isEffectiveAdmin = await getEffectiveAdminStatus();
  const isCurrentlyImpersonating = await isImpersonating();

  return (
    <header className="bujo-header">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:h-16 sm:flex-nowrap sm:justify-between sm:py-0">
        <Link href="/" className="bujo-brand text-sm">
          Bullet Journal Logger
        </Link>
        <HeaderNav
          showAdmin={isEffectiveAdmin}
          isSignedIn={!!effectiveUser}
          isImpersonating={isCurrentlyImpersonating}
        />
      </div>
    </header>
  );
}
