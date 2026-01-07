"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import NavLinks from "@/components/nav-links";

type HeaderNavProps = {
  showAdmin: boolean;
  isSignedIn: boolean;
};

export default function HeaderNav({ showAdmin, isSignedIn }: HeaderNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
      <div className="flex justify-end sm:hidden">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-dashed border-[#d9ccff] bg-[#f9f5ff] px-3 py-2 text-sm font-semibold text-[#3b2f64] shadow-[0_4px_0_#c4b5fd]"
          aria-controls="primary-navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="sr-only">Toggle navigation</span>
          <span className="flex flex-col gap-1" aria-hidden>
            <span
              className={`block h-0.5 w-5 bg-current transition-all duration-200 ${
                menuOpen ? "translate-y-1.5 rotate-45" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-current transition-all duration-200 ${
                menuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-current transition-all duration-200 ${
                menuOpen ? "-translate-y-1.5 -rotate-45" : ""
              }`}
            />
          </span>
          <span aria-hidden>{menuOpen ? "Close" : "Menu"}</span>
        </button>
      </div>

      <nav
        id="primary-navigation"
        className={`bujo-nav ${
          menuOpen ? "flex" : "hidden"
        } w-full flex-col items-stretch gap-2 text-sm font-medium text-gray-800 sm:flex sm:w-auto sm:flex-row sm:items-center sm:gap-2`}
      >
        <NavLinks showAdmin={showAdmin} />
        {isSignedIn ? (
          <form action="/api/auth/signout" method="post" className="w-full sm:w-auto">
            <button
              type="submit"
              className="bujo-btn-secondary w-full justify-center text-sm sm:w-auto"
            >
              Sign out
            </button>
          </form>
        ) : (
          <Link href="/sign-in" className="bujo-btn-secondary w-full justify-center text-sm sm:w-auto">
            Sign in
          </Link>
        )}
      </nav>
    </div>
  );
}
