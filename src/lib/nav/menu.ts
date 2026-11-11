import { canView, type Area } from "@/lib/auth/permissions";
import type { Role } from "@/lib/auth/roles";

// The side menu as a tree. Groups can hold groups, to any depth.
// An item with `planned` is shown but switched off until its module is built.
// Remove `planned` and add `href` and `area` when the screen goes live.

export type MenuIcon = "home" | "box" | "book" | "cart" | "cog";

type MenuDefinition = {
  id: string;
  label: string;
  icon?: MenuIcon;
  href?: string;
  // The permission area that decides who sees a live item.
  area?: Area;
  planned?: true;
  children?: MenuDefinition[];
};

// What the browser receives for one role. No permission logic travels with it.
export type MenuNode = {
  id: string;
  label: string;
  icon?: MenuIcon;
  href?: string;
  planned?: true;
  children?: MenuNode[];
};

const MENU: MenuDefinition[] = [
  { id: "dashboard", label: "Dashboard", icon: "home", href: "/", area: "dashboard" },
  {
    id: "inventory",
    label: "Inventory Management",
    icon: "box",
    children: [
      { id: "items", label: "Item Master", planned: true },
      {
        id: "structure",
        label: "Stock Points, Outlets And Counters",
        href: "/stock-outlets",
        area: "structure",
      },
      { id: "purchases", label: "Purchase Entry", planned: true },
      { id: "transfers", label: "Stock Transfers", planned: true },
      { id: "corrections", label: "Physical Stock Correction", planned: true },
      {
        id: "stock-reports",
        label: "Stock Reports",
        children: [
          { id: "stock-report", label: "Stock Report", planned: true },
          { id: "stock-value-report", label: "Stock Value Report", planned: true },
        ],
      },
    ],
  },
  {
    id: "accounts",
    label: "Accounts",
    icon: "book",
    children: [
      { id: "day-book", label: "Day Book", planned: true },
      {
        id: "ledgers",
        label: "Ledger Groups And Ledgers",
        href: "/ledgers",
        area: "ledgers",
      },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: "cart",
    children: [
      { id: "bar-pos", label: "Bar POS", planned: true },
      { id: "sales-reports", label: "Sales Reports", planned: true },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    icon: "cog",
    children: [
      { id: "users", label: "Users", href: "/users", area: "users" },
      { id: "roles", label: "Roles And Access", planned: true },
      { id: "audit", label: "Audit Log", planned: true },
    ],
  },
];

function prune(
  nodes: MenuDefinition[],
  role: Role,
  showPlanned: boolean,
): MenuNode[] {
  const result: MenuNode[] = [];
  for (const node of nodes) {
    if (node.children) {
      const children = prune(node.children, role, showPlanned);
      // A group with nothing to show is hidden.
      if (children.length > 0) {
        result.push({ id: node.id, label: node.label, icon: node.icon, children });
      }
    } else if (node.planned) {
      if (showPlanned) {
        result.push({ id: node.id, label: node.label, icon: node.icon, planned: true });
      }
    } else if (node.href && node.area && canView(node.area, role)) {
      result.push({ id: node.id, label: node.label, icon: node.icon, href: node.href });
    }
  }
  return result;
}

// The menu for one role. Live items follow the permission matrix. Planned
// items show for office roles, so the full shape is visible in a demo.
export function buildMenu(role: Role): MenuNode[] {
  return prune(MENU, role, canView("structure", role));
}
