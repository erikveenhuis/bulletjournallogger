"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLinksProps = {
  showAdmin: boolean;
};

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/journal", label: "Journal" },
  { href: "/insights", label: "Insights" },
  { href: "/admin/questions", label: "Admin", adminOnly: true },
];

export default function NavLinks({ showAdmin }: NavLinksProps) {
  const pathname = usePathname() || "/";

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
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
    </>
  );
}
