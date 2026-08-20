"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavLink = { label: string; href: string };
type NavGroup = { label: string; items: NavLink[] };
type NavEntry = NavLink | NavGroup;

const isGroup = (e: NavEntry): e is NavGroup => "items" in e;

const NAV: NavEntry[] = [
  { label: "Orders", href: "/admin" },
  { label: "Attendees", href: "/admin/attendees" },
  {
    label: "Ticketing",
    items: [
      { label: "Tickets & Pricing", href: "/admin/tickets" },
      { label: "Comp Tickets", href: "/admin/comp" },
      { label: "Promo Codes", href: "/admin/promo" },
    ],
  },
  { label: "Vendors", href: "/admin/vendors" },
  {
    label: "Program",
    items: [
      { label: "Speakers & Teachers", href: "/admin/speakers" },
      { label: "Schedule", href: "/admin/schedule" },
    ],
  },
];

const linkActive = (pathname: string, href: string) =>
  href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);

  // Close the open menu on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <nav
      ref={ref}
      className="flex items-center gap-1 text-[0.82rem] font-bold uppercase tracking-[0.06em] text-ink/60"
    >
      {NAV.map((entry) => {
        if (!isGroup(entry)) {
          return (
            <Link
              key={entry.href}
              href={entry.href}
              className={`rounded-full px-3 py-1.5 hover:text-ink ${
                linkActive(pathname, entry.href) ? "text-ink" : ""
              }`}
            >
              {entry.label}
            </Link>
          );
        }
        const groupActive = entry.items.some((i) =>
          linkActive(pathname, i.href),
        );
        const isOpen = open === entry.label;
        return (
          <div key={entry.label} className="relative">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : entry.label)}
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 hover:text-ink ${
                groupActive || isOpen ? "text-ink" : ""
              }`}
            >
              {entry.label}
              <span
                className={`text-[0.6rem] transition-transform ${isOpen ? "rotate-180" : ""}`}
              >
                ▾
              </span>
            </button>
            {isOpen && (
              <div className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-[200px] overflow-hidden rounded-[12px] border border-black/10 bg-white py-1 shadow-lg">
                {entry.items.map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    onClick={() => setOpen(null)}
                    className={`block px-4 py-2.5 text-[0.8rem] normal-case tracking-normal hover:bg-paper ${
                      linkActive(pathname, i.href)
                        ? "font-bold text-pink"
                        : "text-ink/75"
                    }`}
                  >
                    {i.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
