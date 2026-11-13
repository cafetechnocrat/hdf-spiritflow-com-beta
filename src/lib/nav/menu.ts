import {
  canView,
  type AccessMap,
  type FeatureKey,
} from "@/lib/auth/permissions";

// The side menu as a tree. Groups can hold groups, to any depth.
// An item with `planned` is shown but switched off until its module is built.
// Remove `planned` and add `href` and `area` when the screen goes live.

export type MenuIcon = "home" | "box" | "book" | "cart" | "cog";

type MenuDefinition = {
  id: string;
  label: string;
  icon?: MenuIcon;
  href?: string;
  // The feature that decides who sees a live item.
  area?: FeatureKey;
  // The feature is a lock: a person without View still sees the item, greyed
  // out with a lock, and cannot open it.
  lock?: true;
  // Only the System Admin sees this item.
  systemOnly?: true;
  planned?: true;
  children?: MenuDefinition[];
};

// What the browser receives for one user. No permission logic travels with it.
export type MenuNode = {
  id: string;
  label: string;
  icon?: MenuIcon;
  href?: string;
  // Shown greyed out with a lock. Not a link.
  locked?: true;
  planned?: true;
  children?: MenuNode[];
};

const MENU: MenuDefinition[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "home",
    href: "/",
    area: "dashboard",
  },
  {
    id: "inventory",
    label: "Inventory Management",
    icon: "box",
    children: [
      {
        id: "items",
        label: "Liquor Items",
        href: "/liquor-items",
        area: "liquor_items",
      },
      {
        id: "structure",
        label: "Stock Points, Outlets And Counters",
        href: "/stock-outlets",
        area: "structure",
      },
      { id: "purchases", label: "Purchase Entry", planned: true },
      { id: "transfers", label: "Stock Transfers", planned: true },
      {
        id: "corrections",
        label: "Physical Stock Correction",
        href: "/stock-count",
        area: "stock_count",
      },
      {
        id: "stock-reports",
        label: "Stock Reports",
        children: [
          { id: "stock-report", label: "Stock Report", planned: true },
          {
            id: "stock-value-report",
            label: "Stock Value Report",
            planned: true,
          },
        ],
      },
    ],
  },
  {
    id: "accounts",
    label: "Accounts",
    icon: "book",
    children: [
      {
        id: "transactions",
        label: "Transactions",
        href: "/transactions",
        area: "transactions",
      },
      {
        id: "closing-stock",
        label: "Closing Stock",
        href: "/closing-stock",
        area: "closing_stock",
      },
      {
        id: "reports",
        label: "Reports",
        children: [
          {
            id: "day-book",
            label: "Day Book",
            href: "/reports/day-book",
            area: "report_day_book",
            lock: true,
          },
          {
            id: "ledger-statement",
            label: "Ledger Statement",
            href: "/reports/ledger-statement",
            area: "report_ledger_statement",
            lock: true,
          },
          {
            id: "sales-register",
            label: "Sales Register",
            href: "/reports/sales-register",
            area: "report_sales_register",
            lock: true,
          },
          {
            id: "purchase-register",
            label: "Purchase Register",
            href: "/reports/purchase-register",
            area: "report_purchase_register",
            lock: true,
          },
          {
            id: "trial-balance",
            label: "Trial Balance",
            href: "/reports/trial-balance",
            area: "report_trial_balance",
            lock: true,
          },
          {
            id: "profit-loss",
            label: "Profit And Loss",
            href: "/reports/profit-loss",
            area: "report_profit_loss",
            lock: true,
          },
          {
            id: "balance-sheet",
            label: "Balance Sheet",
            href: "/reports/balance-sheet",
            area: "report_balance_sheet",
            lock: true,
          },
        ],
      },
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
      {
        id: "roles",
        label: "Roles And Access",
        href: "/roles",
        systemOnly: true,
      },
      { id: "audit", label: "Audit Log", planned: true },
    ],
  },
];

// Who the menu is built for: their access and whether they are the System Admin.
export type MenuUser = { access: AccessMap; isSystemAdmin: boolean };

function prune(
  nodes: MenuDefinition[],
  user: MenuUser,
  showPlanned: boolean,
): MenuNode[] {
  const result: MenuNode[] = [];
  for (const node of nodes) {
    if (node.children) {
      const children = prune(node.children, user, showPlanned);
      // A group with nothing to show is hidden.
      if (children.length > 0) {
        result.push({
          id: node.id,
          label: node.label,
          icon: node.icon,
          children,
        });
      }
    } else if (node.planned) {
      if (showPlanned) {
        result.push({
          id: node.id,
          label: node.label,
          icon: node.icon,
          planned: true,
        });
      }
    } else if (node.href && node.systemOnly) {
      if (user.isSystemAdmin) {
        result.push({
          id: node.id,
          label: node.label,
          icon: node.icon,
          href: node.href,
        });
      }
    } else if (node.href && node.area && node.lock) {
      result.push(
        canView(user, node.area)
          ? { id: node.id, label: node.label, icon: node.icon, href: node.href }
          : { id: node.id, label: node.label, icon: node.icon, locked: true },
      );
    } else if (node.href && node.area && canView(user, node.area)) {
      result.push({
        id: node.id,
        label: node.label,
        icon: node.icon,
        href: node.href,
      });
    }
  }
  return result;
}

// The menu for one user. Live items follow the access set on their role.
// Planned items show for the System Admin and for anyone who can see stock
// points and outlets, so the full shape is visible in a demo.
export function buildMenu(user: MenuUser): MenuNode[] {
  return prune(MENU, user, user.isSystemAdmin || canView(user, "structure"));
}
