"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavLinksProps = {
  showAdmin: boolean;
  isImpersonating?: boolean;
};

const links = [
  { href: "/profile", label: "Profile" },
  { href: "/journal", label: "Journal" },
  { href: "/insights", label: "Insights" },
  { href: "/admin", label: "Admin", adminOnly: true },
];

export default function NavLinks({ showAdmin, isImpersonating }: NavLinksProps) {
  const pathname = usePathname() || "/";
  const [isToggling, setIsToggling] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };


  const handleStopImpersonation = async () => {
    setIsToggling(true);
    try {
      const response = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "stop" }),
      });

      if (response.ok) {
        // Reload the page to apply the changes
        window.location.reload();
      } else {
        console.error("Failed to stop impersonation");
      }
    } catch (error) {
      console.error("Error stopping impersonation:", error);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <>
      {links
        .filter((link) => (link.adminOnly ? showAdmin : true))
        .map(({ href, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={active ? "bujo-nav__link--active" : undefined}
              aria-current={active ? "page" : undefined}
            >
              {label}
            </Link>
          );
        })}
      {isImpersonating && (
        <button
          onClick={handleStopImpersonation}
          disabled={isToggling}
          className="bujo-btn-secondary text-sm bg-red-100 text-red-800 hover:bg-red-200"
          aria-label="Stop impersonating user"
        >
          {isToggling ? "Stopping..." : "Stop Impersonating"}
        </button>
      )}
    </>
  );
}
