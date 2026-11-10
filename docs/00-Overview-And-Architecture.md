# 00: Overview And Architecture

Project: **hdf-spiritflow-com-beta**. Owner: Cafe Technocrat. Client: Hotel Diamond Fort (HDF), Kerala.

## 1. Purpose

Replace every existing system at HDF with one web ERP, built progressively, module by module. The first build after login is the Day Book (accounts entry without inventory). Spirit Flow (bar) and Cuisine Flow (restaurant) follow, because both have direct POS and a similar mechanism. The core database and report structure must stay upgradeable and integrable with later modules.

## 2. Scope By Module

| Module | Covers | Status |
| --- | --- | --- |
| Core | Login, roles, outlets, counters, audit log, shared masters | Phase 0 to 1 |
| Spirit Flow | Liquor item master, stock points, purchases, transfers, physical stock correction, bar POS, bar reports | Phase 3 onward |
| Cuisine Flow | Restaurant POS, food items, room charge, delivery platforms | After Spirit Flow |
| Guest Flow | Rooms, bookings, guest records, room GST invoices | Later |
| HR Flow | Attendance, duty budgets, payroll inputs | Later |
| Business Flow | MD dashboards and the daily one-page report | Later |
| Accounts | Day Book first (ledgers created by the Chief Accountant, transactions entered by accountants, no inventory); then the full accounting module, with Tally replaced gradually or posted to where technically feasible | Day Book in Phase 2; rest later |

## 3. Decided Principles

- One Next.js app, one Supabase database, one login for all modules.
- **Online only.** No offline mode and no PWA. If the internet is down, the app waits for it.
- Plain responsive web app on all screens. POS runs in the browser on counter tablets and computers.
- **Printing is deferred.** Thermal bill printing from the hotel's local server is handled in a later phase. Do not design for it now beyond keeping bill data complete.
- Beta uses one Supabase project, `hdf-spiritflow-com-beta`. A separate production project is created before HDF's first live day.
- Hosted on Vercel and GitHub under the Cafe Technocrat account.
- Legal and compliance are the hotel management's concern. The build delivers what they need.
- **Accounts come first.** The Day Book is built right after login and roles, value-based with no inventory. Stock and POS follow.

## 4. Architecture

```
Browser (phone, tablet, desktop)
        |
        v
Next.js App Router on Vercel
  - Server components and server actions (all data access)
  - Request middleware refreshes the Supabase session
        |
        v
Supabase (Mumbai region)
  - Postgres with Row Level Security
  - Auth (email and password, username and PIN)
  - Storage (later)
```

- Data access goes through server components and server actions. The browser never holds the service role key.
- Business rules that must never be bypassed (stock valuation, bill void rules, audit logging) live in the database as constraints, functions and triggers, not only in app code.
- Reports read from database views or functions so every report uses the same numbers.

## 5. Environments

| Environment | Next.js | Supabase | Data |
| --- | --- | --- | --- |
| Local | `pnpm dev` | Beta project | Test seeds |
| Vercel Preview (branch builds) | Per-branch URL | Beta project | Test seeds |
| Vercel Production (later) | Main URL | Separate production project | Real data only |

The production project is created before go-live, using the same migrations from git. Real bills, stock and payroll data never go into the beta project.

## 6. Users And Roles

Starting roles (confirmed): MD, System Admin, Chief Accountant, Accounts Staff, Night Accountant, Cashier, Stock Keeper, Security, Kitchen Staff.

- Cashiers are limited to their own outlet and counter.
- The MD is view-only.
- The Night Accountant has no payment power and entry-only rights.
- Full permission matrix is in `docs/03-Phase-1-Login-And-Roles.md`.

## 7. Outlets And Stock Points

- **Outlets:** Spadikam, Dhruvam, No 20, Malarvadi, Front Office, Touchings. Each outlet can have several counters.
- **Stock Points:** Liquor Store (warehouse), Dhruvam, Spadikam, and the in-room mini bar. The mini bar is a stock point, not a cashier counter.
- Room service sales belong to the outlet that serves them.

## 8. Design System

Style: **simple Material-style admin**. Clean, easy to use, minimal decoration, generous white space, clear hierarchy. Built from shadcn/ui components themed to match.

### 8.1 Colour Tokens (Proposed, Adjust On Owner Feedback)

Define as CSS variables, with a dark-mode set derived from the same roles.

| Token | Light Value | Use |
| --- | --- | --- |
| `--primary` | `#E65100` | Primary buttons, active nav, key accents |
| `--on-primary` | `#FFFFFF` | Text on primary |
| `--background` | `#F5F5F5` | Page background |
| `--surface` | `#FFFFFF` | Cards, tables, dialogs |
| `--text` | `#1F1F1F` | Body text |
| `--text-muted` | `#616161` | Secondary text |
| `--border` | `#E0E0E0` | Dividers and outlines |
| `--success` | `#2E7D32` | Good, matched, in stock |
| `--warning` | `#F9A825` | Attention, low stock |
| `--error` | `#C62828` | Short, mismatch, void |

### 8.2 Chart Palette

Visual representations use a **colour-blind-safe categorical palette** (Okabe-Ito based). Rules:

- Each liquor category has one fixed colour, used everywhere in the app:

| Category | Colour |
| --- | --- |
| Beer | `#E69F00` |
| Brandy | `#D55E00` |
| Rum | `#0072B2` |
| Vodka | `#56B4E9` |
| Whisky | `#009E73` |
| White Rum | `#CC79A7` |
| Wine | `#F0E442` |

- Outlets use the same palette in a separate fixed mapping, defined once in code.
- Status uses success, warning and error tokens only. Never use red and green as the only difference between two things; add an icon or label.
- Single-series charts use `--primary`. Sequential data (heat maps, intensity) uses one hue from light to dark.
- Always show a legend or direct labels. Always show a data table alternative for each chart.

### 8.3 Responsive Rules

- Mobile first. Breakpoints cover phone, tablet and desktop.
- Navigation: bottom or drawer navigation on phones, collapsible side rail on tablets, full sidebar on desktop.
- Data tables on phones collapse to stacked cards or allow horizontal scroll with a sticky first column.
- Touch targets are at least 44 px high.
- Every screen must be checked at phone, tablet and desktop widths before a phase is accepted.

## 9. Global Report Template

All reports share one layout so they look and behave the same.

1. **Header:** report title, hotel name, date range, filters (outlet, stock point, category), generated by and generated at (IST).
2. **KPI Cards:** three to five headline numbers for the report.
3. **Chart Area:** one or two charts using the palette above, each with a legend and a data-table toggle.
4. **Detail Table:** sortable, filterable, with a totals row. Numbers right-aligned in Indian format.
5. **Footer:** notes on how figures were calculated, the date range each figure covers, and **© Cafe Technocrat**.
6. **Exports:** PDF, Excel and print view (print layout hides navigation).
7. **State Handling:** loading, empty and error states on every report.

Reconcile before presenting: totals, derived rows and any gap must be explainable. Label any calculated figure as calculated and show the rule.

## 10. Reports Needed First

- **Phase 2 (Day Book), proposed, owner to confirm in the Claude Code chat:** Day Book, Ledger Statement, Cash And Bank Book, Trial Balance.
- **Confirmed stock reports, built later (Phases 3 and 4):** Inventory Report, Stock Report, Stock Value Report. Working definitions, to confirm at the Phase 3 mockup stage:
  - **Inventory Report:** the item master listing, with category, bottle size, pack size, cost, cess and selling rates.
  - **Stock Report:** quantity on hand by item and stock point, shown in pegs first, then bottles.
  - **Stock Value Report:** stock quantity valued at cost (including cess), by category and stock point.

## 11. Decisions Log

### Confirmed By Owner
- One app for all modules; online only; printing later.
- Beta Supabase project and Vercel project: `hdf-spiritflow-com-beta`. GitHub repo and app folder renamed to `hdf-spiritflow-com-beta`.
- Role list and cashier outlet scoping as above.
- Build order (changed 9 November 2026): foundation, login and roles, Day Book, then item master, stock operations, POS, sales reports, then other modules.
- Day Book: the Chief Accountant creates ledgers (cash, bank accounts, sales, vendors, expense heads and so on); accountants enter transactions; value-based, no inventory.
- Design: simple Material-style admin with proper chart palettes.
- Stock reports confirmed for later: Inventory, Stock, Stock Value (Phases 3 and 4).

### Working Defaults (Owner To Correct If Wrong)
- Stack: TypeScript, Tailwind, shadcn/ui, pnpm, Supabase migrations in git.
- Supabase region: Mumbai.
- Email and password login for office staff; username and PIN for cashiers; two-factor for MD and accounts roles.
- Manager PIN for cancellations, discounts and stock corrections; full audit log; no hard deletes.
- Branch per phase with a Vercel preview link.
- English only in the first release; light and dark themes.
- Domain: Vercel address for now.

### Open
- Detailed Day Book requirement: the owner will give it in the Claude Code chat. Open points are listed in `docs/04-Phase-2-Day-Book.md`.
- Load figures (counters and tablets live at once, bills per day at peak): real numbers needed before Phase 4.
- Whether the POS keeps the glass look in the orange, near-black and white palette, or follows the same Material style as the office screens. Decide at the Phase 4 mockup.
- Export formats and delivery of the MD's daily report (email or WhatsApp): later, with Business Flow.

