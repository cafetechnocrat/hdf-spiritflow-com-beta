# 01: Phase Plan

Build one phase at a time. Each phase ends with an approved preview on Vercel, a merge to `main`, and a short owner sign-off. Each phase that adds screens starts with an approved HTML mockup.

Change on 9 November 2026: the Day Book (accounts entry without inventory) now comes right after login and roles. Item master and stock move one phase later.

## Phase Summary

| Phase | Name | Goal | Depends On |
| --- | --- | --- | --- |
| 0 | Foundation | Empty app running locally and on Vercel, connected to Supabase, with design system and app shell | None |
| 1 | Login And Roles | Secure login, nine roles, users, outlets, counters, audit log | Phase 0 |
| 2 | Day Book | Chief Accountant creates ledgers; accountants enter transactions; value-based, no inventory | Phase 1 |
| 3 | Item Master And Inventory Report | Liquor items, categories, pack sizes, cost with cess, rates, import, **Inventory Report** | Phase 2 |
| 4 | Stock Operations And Stock Reports | Stock points, purchase entry, transfers, physical stock correction, **Stock Report**, **Stock Value Report** | Phase 3 |
| 5 | Bar POS | Billing at counters, payment modes, shifts, cash closing | Phase 4 |
| 6 | Sales Reports | Sales, excess, short, cash closing check sheet, outlet comparisons | Phase 5 |
| 7+ | Other Modules | Cuisine Flow, HR Flow, Guest Flow, Business Flow, full Accounts, bill printing | Earlier phases |

Reports: Day Book reports arrive in Phase 2. The three confirmed stock reports (Inventory, Stock, Stock Value) arrive in Phases 3 and 4, before POS. Sales reports follow POS in Phase 6.

## Phase 0: Foundation
Spec: `docs/02-Phase-0-Foundation.md`
- Create the Next.js app, Supabase beta project, Vercel project and Git workflow.
- Theme tokens, light and dark mode, responsive app shell, global report template components (empty shells).
- Environment handling, linting, type checking, health page.
- **Done when:** the app loads on a phone, tablet and desktop locally and on the Vercel preview, and the health page confirms a Supabase connection.

## Phase 1: Login And Roles
Spec: `docs/03-Phase-1-Login-And-Roles.md`
- Email and password login, username and PIN login for cashiers, two-factor for MD and accounts roles.
- Nine roles, user management by System Admin only, outlet and counter masters, audit log, Row Level Security on every table.
- **Done when:** each role sees only what its permission matrix allows, in the UI and in the database, and the audit log records user and master changes.

## Phase 2: Day Book
Spec frame: `docs/04-Phase-2-Day-Book.md`. The owner gives the detailed requirement in the Claude Code chat; the spec file is updated with it before any coding.
- Ledger groups and ledgers (cash, bank accounts, sales, vendors, expense heads and so on), created and managed by the Chief Accountant only.
- Transaction entry by the accountants against those ledgers, value only. No inventory, no quantities.
- Day Book view by date, ledger statement, cash and bank book, trial balance (proposed, to confirm).
- Opening balances and back-dated entry: books begin 1 April 2023, live entry from 1 November 2026.
- Database-level checks that every transaction balances, void instead of delete, full audit log.
- **Done when:** the Chief Accountant can build the chart of accounts, accountants can enter and review a day's transactions, and the Day Book and ledger balances agree with a hand-checked sample.

## Phase 3: Item Master And Inventory Report
Detail spec to be written after Phase 2 is accepted. Scope:
- Liquor categories: Beer, Brandy, Rum, Vodka, Whisky, White Rum, Wine.
- Item fields: name, category, bottle size in ml, bottles per case, KSBC case price after tax, FL-1 shop price, selling rates per outlet, status.
- Cost rules, confirmed (calculated by the system, never typed in):
  - Rate per bottle = KSBC warehouse case price after tax ÷ bottles per case, plus cess per bottle.
  - Cess per bottle by FL-1 shop retail price: below ₹500 is ₹0, ₹500 to ₹999 is ₹20, ₹1,000 and above is ₹40. Whether a price of exactly ₹500 or ₹1,000 falls in the higher slab is unconfirmed; ask the owner before coding the boundary.
  - Peg = 60 ml. Peg cost = bottle cost × 60 ÷ bottle size in ml (a 750 ml bottle is 12.5 pegs).
  - Cess is part of cost. TCS is not part of cost. There is no GST input credit on liquor.
- Pack sizes from the KSBC price list: 1000 ml is 9 per case, 750 ml is 12, 375 ml is 24, 180 ml is 48, 500 ml is 18 for most items and 24 for some, so pack size is stored per item.
- Import from Excel or CSV with a validation screen before anything is saved.
- **Inventory Report** built on the global report template.
- Design decision to confirm at the mockup stage: store quantities in one base unit. Recommendation: whole millilitres, so a half peg is 30 ml and any bottle size works without fractions.

## Phase 4: Stock Operations And Stock Reports
Detail spec to be written after Phase 3 is accepted. Scope:
- Stock points: Liquor Store, Dhruvam, Spadikam, mini bar.
- Purchase entry from KSBC invoices (item value excluding cess, cess, TCS recorded separately), transfers between stock points, damage entries. How purchases link to Day Book vouchers is decided at this phase.
- Physical stock correction, as the owner has defined it:
  - User enters real stock per item (bottles in whole numbers, pegs in halves) by category A to Z, then Reconcile.
  - Excess: reduce peg quantities on bills containing that item, largest first, one peg per bill per pass (half a peg if the line has one peg), never reducing a bill to zero, so sales fall and stock matches.
  - Short: pass as damaged so closing stock tallies.
  - Reports show real figures before reconcile and adjusted figures after.
- **Stock Report** (pegs first, then bottles) and **Stock Value Report** (at cost including cess, by category and stock point).
- Weekly physical stock-taking support.

## Phase 5: Bar POS
Detail spec to be written after Phase 4 is accepted. Needs load figures from the owner first.
- Several counters per outlet; a shift is identified by duty in and out time.
- Payment modes: cash, UPI and card, complimentary, cancelled. Complimentary and cancelled are already deducted from sales.
- Tips paid by UPI or card are paid to staff in cash from the till; cash closing must adjust for this.
- Peg-first screens. Different outlets can sell from the same physical stock at different rates.
- Cash closing: cashiers enter their own actuals without seeing POS totals; accounts compares with the POS report; variance is POS minus cashier entry.
- Printing is not in this phase.

## Phase 6: Sales Reports
Detail spec to be written after Phase 5 is accepted. Likely scope: sales by outlet and category, excess and short reports with before and after figures, the daily accounts check sheet (outlets as columns plus total), complimentary and cancelled reporting.

## Later Modules
Cuisine Flow (restaurant POS and food), HR Flow (split-duty attendance with duty-hour budgets), Guest Flow (rooms and room GST invoices), Business Flow (MD dashboard and daily one-page report), full Accounts (beyond the Day Book, with Tally replaced gradually or posted to where feasible), bill printing from the hotel's local server. Each gets its own spec when its turn comes.

## Phase Acceptance Checklist (Every Phase)
- Mockups approved before screens were coded.
- Works at phone, tablet and desktop widths in light and dark themes.
- Row Level Security on every new table, with policies tested for each role.
- Audit log entries written for every change to business data.
- `pnpm lint`, `pnpm typecheck` and `pnpm build` pass.
- Migrations committed in `supabase/migrations/`.
- Vercel preview reviewed and approved by the owner before merge to `main`.

