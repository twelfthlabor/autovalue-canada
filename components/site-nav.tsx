"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/#check", label: "Check a price", match: "/" },
  { href: "/market-lab", label: "Market lab" },
  { href: "/methodology", label: "Methodology" },
  { href: "/calculation", label: "How we calculate" },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary navigation">
      {links.map((link) => (
        <Link key={link.href} href={link.href} aria-current={pathname === (link.match ?? link.href) ? "page" : undefined} className={pathname === (link.match ?? link.href) ? "active" : undefined}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
