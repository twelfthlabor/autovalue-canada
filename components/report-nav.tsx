"use client";

import Link from "next/link";

import { useEffect, useState } from "react";

export function ReportNav({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0].id);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.find(entry => entry.isIntersecting);
      if (visible) setActive(visible.target.id);
    }, { rootMargin: "-5% 0px -65% 0px" });
    items.forEach(item => { const element = document.getElementById(item.id); if (element) observer.observe(element); });
    return () => observer.disconnect();
  }, [items]);
  return <nav className="report-nav" aria-label="On this page"><span>On this page</span>{items.map(item => <a key={item.id} href={`#${item.id}`} aria-current={active === item.id ? "location" : undefined} onClick={() => setActive(item.id)}>{item.label}</a>)}<Link className="report-return" href="/">← Check a price</Link></nav>;
}
