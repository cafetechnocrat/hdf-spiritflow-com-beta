# 05: Dashboard

Goal: one informative, good looking home screen with real data from the modules that are live, and clearly marked places for the modules that are not built yet. Each place fills in with real data when its module goes live, with no redesign.

Status: built (2026-11-14). Mockup approved: `docs/mockups/phase-2/dashboard.html`.

## 1. Owner Decisions (2026-11-14)

- Live sections to start with: **headline cards, monthly trends, positions, activity and checks**.
- Modules that are not built yet show as **dimmed cards with a Coming Soon tag**, in place in the layout.

## 2. Rules

- **Real data only.** Every figure comes from the database through the same functions the reports use, so the dashboard and the reports always agree. Amounts travel as text and add up in whole paise.
- **Follows the financial year.** The dashboard shows the financial year picked in the top bar (1 April to 31 March), up to today when it is the current year. Changing the year changes every figure.
- **Respects access, with locks.** Each section is tied to its own lock (see `docs/03-Phase-1-Login-And-Roles.md`, Reports And Dashboard Locks). A card the user may not see is **not hidden**. It stays in place with its title and a lock, shows no figure, and says: "You do not have access to view this report. Ask the System Admin to unlock it." The System Admin is never locked.
- **Nothing hardcoded.** Which groups count as sales, purchases, debtors and creditors, which ledgers are cash and bank, and the order of everything come from the ledger groups. Months come from the financial year. Upcoming cards come from a small list of planned modules; each card is switched to live data when its module is built.
- **Rupee symbol.** Amounts on cards and panels show the rupee symbol, as in ₹48,60,000.00. Report tables keep plain numbers under headings that say amounts are in rupees, and report cards show the symbol.
- **Colour-blind safe.** Charts use the Okabe-Ito palette from `docs/00-Overview-And-Architecture.md`. Status never relies on red and green alone, there is always a label or an icon. Every chart has a legend and a data-table view.
- **Responsive.** Phone: one column. Tablet: two columns. Desktop: a grid of up to four columns. Touch targets are at least 44 px. Tables become stacked cards on a phone. No sideways scroll on the page.
- **States.** Loading (skeleton cards), empty (a clear message and what to do), and error (a message and a retry hint) for every section, so one failing section never blanks the page.
- **Print.** The dashboard hides navigation when printed.

## 3. Layout

1. **Header:** a greeting with the user's name, the financial year with its first and last day, "as on" today's date, and when the data was last read (IST).
2. **Headline cards (four):** each has the figure, a change against the same period of the previous financial year when that year has data, and a small trend line.
   - **Sales:** posted credits to the sales group for the year to date.
   - **Purchases:** posted debits to the purchase group.
   - **Gross Profit (or Gross Loss):** trading income minus trading expenses for the same range, the same figure as Gross Profit on the Profit And Loss report. It replaces Net Profit (owner, 2026-11-14). The trading part comes from the section marker on each ledger group.
   - **Cash And Bank:** the combined balance of cash and bank ledgers as on today, with how many accounts.
3. **Monthly trends:** two charts across the months of the financial year.
   - **Income And Expenses:** clustered bars per month.
   - **Sales By Month:** stacked bars split by sales ledger.
   - Each has a legend and a Chart or Table switch.
4. **Positions:**
   - **Cash And Bank:** each account with its balance and a bar showing its share.
   - **Receivables:** the Sundry Debtors total and the largest few balances.
   - **Payables:** the Sundry Creditors total and the largest few balances.
5. **Activity and checks:**
   - **Latest Vouchers:** the six most recent, each opening its voucher.
   - **Books Check:** whether the Trial Balance matches, vouchers entered today, and void vouchers this month, each with a status label and icon.
   - **Quick Actions:** New Voucher, Day Book, Trial Balance, Profit And Loss. Only the ones the user may use.
   - **System snapshot (System Admin only):** active users, active roles and users with custom access.
6. **Coming soon:** dimmed cards that light up when their module is live:
   - Bar Sales Today (Bar POS)
   - Stock Value (stock reports)
   - Low Stock Items (stock)
   - Outlet-Wise Sales (outlets and POS)
   - Room Occupancy (Guest Flow)
   - Staff Attendance (HR Flow)

## 4. Data And Access

| Section | Lock it needs (View) | Source |
| --- | --- | --- |
| Sales, Purchases, Gross Profit, Cash And Bank cards | one lock each | the dashboard functions |
| Income And Expenses, Sales By Month, Cash And Bank Balances, Receivables, Payables | one lock each | the dashboard functions |
| Latest Vouchers, Books Check | one lock each | vouchers, trial balance |
| New Voucher quick action | Transactions (Edit) | the menu rules |
| Quick action links | the feature of each target | the menu rules |
| System snapshot | System Admin | users, roles, custom access |

A new database function (or views) returns each section's figures in one round trip per section, so a slow section does not hold up the others.

## 5. Open

- **Change against last year:** shown only when the previous financial year has posted entries. Otherwise the card shows no change. Confirm.
- **Receivables and payables:** taken from the Sundry Debtors and Sundry Creditors groups. If other groups should count, they are marked the same way the register groups are. Confirm.
- **Refresh:** the page reads fresh data on every visit and has a Refresh button. No automatic refresh in the background. Confirm.

## 6. Built

- Page `/` (the Dashboard). Migration `20261114120000_dashboard.sql` adds a `position_kind` marker on ledger groups (cash and bank, receivable, payable, seeded for the default groups and inherited by sub-groups) and the functions `dashboard_monthly`, `dashboard_register_monthly` and `dashboard_positions`. They read through Row Level Security.
- Each section loads on its own behind its own loading skeleton, and shows its own error panel if it fails, so one failing section never blanks the page.
- Charts use Recharts with the Okabe-Ito palette. The cash and bank card has no trend line, because the balance at each month end would need a call per month.
- The change against last year shows only when last year has a figure to compare with. Purchases going up is shown in the warning colour, not the success colour.
- The Coming Soon cards come from a small list in `sections.tsx`. To light one up, replace its card with a live one when its module is built.
