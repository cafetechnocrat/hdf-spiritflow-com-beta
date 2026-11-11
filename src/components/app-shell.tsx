"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { signOut } from "@/lib/auth/actions";

const text = {
  menuOpen: "Open Menu",
  menuClose: "Close Menu",
  mainNav: "Main",
  signOut: "Sign Out",
  logoAlt: "Spirit Flow",
} as const;

export type NavIcon = "home" | "users" | "store";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
};

const icons: Record<NavIcon, ReactNode> = {
  home: <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />,
  store: (
    <path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3" />
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.5 3.5 0 010 6.4M18.5 14.8c1.7.7 2.8 2.3 3 5.2" />
    </>
  ),
};

function Icon({ name, className }: { name: NavIcon; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {icons[name]}
    </svg>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppShell({
  user,
  nav,
  children,
}: {
  user: { fullName: string; roleLabel: string };
  nav: NavItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the menu after moving to another page, and on Escape.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="min-h-dvh lg:pl-[248px]">
      {open ? (
        <div
          className="fixed inset-0 z-20 bg-black/35 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        aria-label={text.mainNav}
        className={`fixed inset-y-0 left-0 z-30 flex w-[248px] flex-col border-r border-divider bg-surface px-3 py-4 transition-transform lg:translate-x-0 ${
          open ? "translate-x-0 shadow-card" : "-translate-x-full"
        }`}
      >
        <Link href="/" className="block px-2 pb-3">
          <Image
            src="/brand/spiritflow-logo.png"
            alt={text.logoAlt}
            width={2172}
            height={724}
            className="-my-2 h-auto w-[132px]"
          />
        </Link>
        <nav className="mt-2 flex flex-col gap-0.5">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`flex min-h-11 items-center gap-2.5 rounded-[10px] px-2.5 text-[0.92rem] font-medium ${
                isActive(item.href)
                  ? "bg-accent-soft font-semibold text-link"
                  : "text-text hover:bg-background"
              }`}
            >
              <Icon name={item.icon} className="h-5 w-5 flex-none" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2.5 border-t border-divider px-2 pt-3">
          <div
            aria-hidden="true"
            className="grid h-9 w-9 flex-none place-items-center rounded-full bg-accent-soft text-[0.85rem] font-semibold text-link"
          >
            {initials(user.fullName)}
          </div>
          <div className="min-w-0 leading-tight">
            <strong className="block truncate text-[0.85rem] font-semibold">
              {user.fullName}
            </strong>
            <span className="text-xs text-muted">{user.roleLabel}</span>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-divider bg-surface/90 pl-3 pr-2 backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? text.menuClose : text.menuOpen}
          aria-expanded={open}
          className="grid h-11 w-11 place-items-center rounded-[10px] text-text hover:bg-background lg:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
            className="h-[22px] w-[22px]"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <span className="flex-1" />
        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex h-11 items-center gap-2 rounded-[10px] px-3 text-[0.88rem] font-medium text-text hover:bg-background"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-5 w-5"
            >
              <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />
            </svg>
            {text.signOut}
          </button>
        </form>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 pb-10 pt-4 lg:px-8 lg:pb-12 lg:pt-6">
        {children}
      </main>
    </div>
  );
}
