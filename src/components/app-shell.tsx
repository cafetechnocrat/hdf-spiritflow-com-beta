"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { signOut } from "@/lib/auth/actions";
import type { MenuIcon, MenuNode } from "@/lib/nav/menu";
import { MENU_COOKIE } from "@/lib/nav/menu-cookie";

const text = {
  menuOpen: "Open Menu",
  menuClose: "Close Menu",
  collapse: "Collapse Menu",
  expand: "Expand Menu",
  mainNav: "Main",
  signOut: "Sign Out",
  logoAlt: "Spirit Flow",
  logoShort: "SF",
  later: "Later",
} as const;

const icons: Record<MenuIcon, ReactNode> = {
  home: <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />,
  box: <path d="M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8" />,
  book: <path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4zM5 17a3 3 0 013-3h11" />,
  cart: <path d="M3 4h2l2 11h11l2-8H6M9 20h.01M17 20h.01" />,
  cog: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </>
  ),
};

function Icon({ name, className }: { name: MenuIcon; className?: string }) {
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

function matches(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

// True when the page being shown is this item or sits anywhere under this group.
function containsPath(node: MenuNode, pathname: string): boolean {
  if (node.href) return matches(node.href, pathname);
  return (node.children ?? []).some((child) => containsPath(child, pathname));
}

type TreeProps = {
  nodes: MenuNode[];
  depth: number;
  pathname: string;
  // Hides labels when the menu is collapsed to icons on a large screen.
  rail: boolean;
  isOpen: (node: MenuNode) => boolean;
  onToggle: (node: MenuNode, siblings: MenuNode[]) => void;
  onNavigate: () => void;
};

// One level of the menu. A group renders another level inside itself.
function MenuLevel({ nodes, depth, pathname, rail, isOpen, onToggle, onNavigate }: TreeProps) {
  const top = depth === 0;
  const row = top
    ? "min-h-11 gap-3 px-3 text-[0.92rem] font-medium"
    : "min-h-10 gap-2 px-2.5 text-[0.88rem]";
  const hideInRail = rail ? "lg:hidden" : "";

  return (
    <ul
      className={
        top
          ? "flex flex-col gap-0.5"
          : "ml-[21px] mt-0.5 mb-1.5 border-l-2 border-divider pl-3.5"
      }
    >
      {nodes.map((node) => {
        const branch = top
          ? ""
          : "relative before:absolute before:-left-3.5 before:top-5 before:w-2.5 before:border-t-2 before:border-divider last:after:absolute last:after:-left-4 last:after:bottom-0 last:after:top-[21px] last:after:w-0.5 last:after:bg-surface";

        if (node.children) {
          const open = isOpen(node);
          const current = containsPath(node, pathname);
          return (
            <li key={node.id} className={branch}>
              <button
                type="button"
                onClick={() => onToggle(node, nodes)}
                aria-expanded={open}
                aria-controls={`menu-${node.id}`}
                title={node.label}
                className={`flex w-full items-center rounded-xl text-left hover:bg-background ${row} ${
                  rail ? "lg:justify-center lg:px-0" : ""
                } ${current ? "font-semibold" : ""}`}
              >
                {node.icon ? (
                  <Icon
                    name={node.icon}
                    className={`h-5 w-5 flex-none ${current ? "text-link" : ""}`}
                  />
                ) : null}
                <span className={`flex-1 ${hideInRail}`}>{node.label}</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className={`h-4 w-4 flex-none text-muted transition-transform ${
                    open ? "rotate-90" : ""
                  } ${hideInRail}`}
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
              {open ? (
                <div id={`menu-${node.id}`} className={hideInRail}>
                  <MenuLevel
                    nodes={node.children}
                    depth={depth + 1}
                    pathname={pathname}
                    rail={rail}
                    isOpen={isOpen}
                    onToggle={onToggle}
                    onNavigate={onNavigate}
                  />
                </div>
              ) : null}
            </li>
          );
        }

        if (node.planned) {
          return (
            <li key={node.id} className={branch}>
              <span
                aria-disabled="true"
                className={`flex items-center rounded-xl text-muted ${row}`}
              >
                <span className="flex-1">{node.label}</span>
                <span className="rounded-full bg-track px-2 py-px text-[0.68rem] font-semibold">
                  {text.later}
                </span>
              </span>
            </li>
          );
        }

        const active = node.href ? matches(node.href, pathname) : false;
        return (
          <li key={node.id} className={branch}>
            <Link
              href={node.href ?? "/"}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={node.label}
              className={`flex items-center rounded-xl ${row} ${
                rail ? "lg:justify-center lg:px-0" : ""
              } ${
                active
                  ? "bg-accent-soft font-semibold text-link"
                  : "text-text hover:bg-background"
              }`}
            >
              {node.icon ? <Icon name={node.icon} className="h-5 w-5 flex-none" /> : null}
              <span className={hideInRail}>{node.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AppShell({
  user,
  menu,
  initialCollapsed,
  children,
}: {
  user: { fullName: string; roleLabel: string };
  menu: MenuNode[];
  initialCollapsed: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  // Groups the user opened or closed by hand. Anything not listed here is open
  // only when it holds the current page.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [seenPath, setSeenPath] = useState(pathname);

  // After moving to another page, forget manual choices so the menu follows
  // the page. Also close the phone drawer.
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOverrides({});
    setDrawerOpen(false);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const isOpen = (node: MenuNode) => overrides[node.id] ?? containsPath(node, pathname);

  function remember(next: boolean) {
    setCollapsed(next);
    // Kept in a cookie so the server draws the menu the same way next time.
    document.cookie = `${MENU_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }

  // Accordion: opening a group closes its siblings.
  function toggle(node: MenuNode, siblings: MenuNode[]) {
    const railMode = collapsed && window.matchMedia("(min-width: 1024px)").matches;
    const opening = railMode ? true : !isOpen(node);
    if (railMode) remember(false);
    setOverrides((current) => {
      const next = { ...current };
      for (const sibling of siblings) next[sibling.id] = false;
      next[node.id] = opening;
      return next;
    });
  }

  return (
    <div
      className={`min-h-dvh transition-[padding-left] ${
        collapsed ? "lg:pl-[72px]" : "lg:pl-[264px]"
      }`}
    >
      {drawerOpen ? (
        <div
          className="fixed inset-0 z-20 bg-black/35 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        aria-label={text.mainNav}
        className={`fixed inset-y-0 left-0 z-30 flex w-[264px] flex-col overflow-hidden border-r border-divider bg-surface px-3 py-4 transition-[transform,width] lg:translate-x-0 ${
          collapsed ? "lg:w-[72px]" : "lg:w-[264px]"
        } ${drawerOpen ? "translate-x-0 shadow-card" : "-translate-x-full"}`}
      >
        <Link href="/" className="mb-1 block h-11 px-2" aria-label={text.logoAlt}>
          <Image
            src="/brand/spiritflow-logo.png"
            alt={text.logoAlt}
            width={2172}
            height={724}
            className={`-my-2 h-auto w-[132px] ${collapsed ? "lg:hidden" : ""}`}
          />
          {collapsed ? (
            <span
              aria-hidden="true"
              className="hidden h-11 w-full place-items-center text-[0.95rem] font-bold tracking-tight text-link lg:grid"
            >
              {text.logoShort}
            </span>
          ) : null}
        </Link>
        <nav className="mt-1 flex-1 overflow-y-auto">
          <MenuLevel
            nodes={menu}
            depth={0}
            pathname={pathname}
            rail={collapsed}
            isOpen={isOpen}
            onToggle={toggle}
            onNavigate={() => setDrawerOpen(false)}
          />
        </nav>
        <div
          className={`mt-2 flex items-center gap-2.5 border-t border-divider px-2 pt-3 ${
            collapsed ? "lg:justify-center lg:px-0" : ""
          }`}
        >
          <div
            aria-hidden="true"
            className="grid h-9 w-9 flex-none place-items-center rounded-full bg-accent-soft text-[0.85rem] font-semibold text-link"
          >
            {initials(user.fullName)}
          </div>
          <div className={`min-w-0 leading-tight ${collapsed ? "lg:hidden" : ""}`}>
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
          onClick={() => setDrawerOpen((value) => !value)}
          aria-label={drawerOpen ? text.menuClose : text.menuOpen}
          aria-expanded={drawerOpen}
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
        <button
          type="button"
          onClick={() => remember(!collapsed)}
          aria-label={collapsed ? text.expand : text.collapse}
          aria-expanded={!collapsed}
          className="hidden h-11 w-11 place-items-center rounded-[10px] text-text hover:bg-background lg:grid"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-[22px] w-[22px]"
          >
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d="M9 4v16" />
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
