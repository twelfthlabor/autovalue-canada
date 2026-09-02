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
        <Link key={link.href} href={link.href} aria-current={link.match && pathname === link.match ? "page" : undefined} className={link.match && pathname === link.match ? "active" : undefined}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
