# HDF Spiritflow (Beta): Claude Code Kickoff

**Read this whole file first, then follow the steps. This is the only file you need to start.** It carries the full project brief inside it. Step 3 splits it into the repo files.

## 1. Who And What

- Owner: Vineeth, Cafe Technocrat (a subsidiary unit of Ezhuthola EdTech Pvt Ltd), Kerala, India.
- Client: Hotel Diamond Fort (HDF). We are building one web ERP, progressively, one phase at a time.
- Stack: Next.js (App Router), TypeScript, Tailwind with shadcn/ui, Supabase, hosted on Vercel, pnpm.
- Build order: Phase 0 Foundation, Phase 1 Login And Roles, Phase 2 Day Book (accounts entry without inventory), then item master, stock, POS and reports.
- **Today's scope is Phase 0 only.** Do not start Phase 1 or Phase 2 until the owner accepts the phase before it.

## 2. Locations And Names

- Working folder on the owner's computer: `D:/Projects/Commercial/Hotel-Diamond-Fort/Spirit-Flow/apps`. Claude Code is opened here, and this kickoff file sits here at the start.
- The Next.js project is created inside it, named **`hdf-spiritflow-com-beta`**, so the app lives at `D:/Projects/Commercial/Hotel-Diamond-Fort/Spirit-Flow/apps/hdf-spiritflow-com-beta`.
- GitHub repo (Cafe Technocrat account): `https://github.com/cafetechnocrat/hdf-spiritflow-com-beta.git`
- Supabase project and Vercel project: both named `hdf-spiritflow-com-beta`. One Supabase project for beta; a separate production project is created before HDF goes live.

## 3. First Session Steps

### Step 1: Check Prerequisites With The Owner
Ask the owner to confirm each of these. Do not assume any of them.
1. The GitHub repo is renamed to `hdf-spiritflow-com-beta`.
2. A Supabase project named `hdf-spiritflow-com-beta` exists in the Mumbai region, public sign-ups are turned off, and the owner has the project URL, public key and secret key ready.
3. Node.js (current LTS), pnpm, Git and the Supabase CLI are installed. Check versions yourself.
4. Which shell the owner uses on Windows (PowerShell or Git Bash), so the commands you give work for them.
5. The Vercel plan on the Cafe Technocrat account. The free Hobby plan is for non-commercial use, so HDF's live operations need a commercial plan before go-live. This does not block beta development.

If something is not ready, say exactly what the owner must do, then continue with the parts that do not depend on it.

### Step 2: Create The App
In the working folder (`apps`), create `hdf-spiritflow-com-beta` with `create-next-app`: TypeScript, ESLint, Tailwind, App Router, `src` directory, import alias `@/*`. Initialise Git, set the remote to the repo URL above, and make the first commit on `main`.

### Step 3: Write The Project Files
This file contains six parts (`CLAUDE.md` and five files for `docs`). Each part starts with an HTML comment line that reads FILE followed by the path, and ends with an HTML comment line that reads END FILE. The parts are listed at the end of this file.

Write the content of each part, exactly as given and without the marker lines, to its path inside the new app folder (`hdf-spiritflow-com-beta`). Create the `docs` folder as needed. Then move this kickoff file to `docs/KICKOFF.md`. From now on `CLAUDE.md` at the repo root holds the standing rules and is read first in every session.

### Step 4: Create The Phase 0 Branch
Create the branch `phase-0-foundation` and work there.

### Step 5: Phase 0 Mockup, Then Stop
Follow `docs/02-Phase-0-Foundation.md`. Before building the app shell, produce the static HTML mockup it describes in `docs/mockups/phase-0/` (app shell and one sample report layout at phone, tablet and desktop widths, in light and dark themes). **Stop and wait for the owner's written approval.** Do not implement the shell, install the packages or connect Supabase before the mockup is approved.

## 4. How To Work With The Owner

- Ask, do not guess. Never invent rates, balances, names, quantities or business rules.
- Plain language. Keep replies short and clear.
- UI labels, headings and buttons in Title Case. Notes and messages in normal sentence case.
- Indian standards: ₹, DD/MM/YYYY, lakh and crore number format, Asia/Kolkata timezone.
- When the owner must run Git, give exactly three commands: `git add`, `git commit`, `git push`.
- Before any commit: `pnpm lint`, `pnpm typecheck` and `pnpm build` pass.
- Never put secrets in the repo. `.env.local` is git-ignored; `.env.example` has names only. Never paste or log the Supabase secret key.

## 5. What Comes After Phase 0

When Phases 0 and 1 are accepted, the owner will give the detailed **Day Book** requirement in this chat. Record it in `docs/04-Phase-2-Day-Book.md` before coding, produce the Phase 2 mockups, and wait for approval. The Day Book is value-based with no inventory. The Chief Accountant creates ledgers (cash, bank accounts, sales, vendors, expense heads and so on) and the accountants enter transactions. The open questions are listed at the end of that file.

---

<!-- FILE: CLAUDE.md -->
# CLAUDE.md: Standing Rules For HDF Spiritflow (Beta)

This file is read first in every Claude Code session. It holds the rules that never change. The detail lives in `docs/`.

## What This Project Is

- A custom web ERP for **Hotel Diamond Fort (HDF)**, Kerala, India, built by **Cafe Technocrat** (a subsidiary unit of Ezhuthola EdTech Pvt Ltd).
- One Next.js app holding every module: Spirit Flow (bar), Cuisine Flow (restaurant), Guest Flow, HR Flow, Business Flow (MIS) and Accounts. Modules share one database and one login.
- Built for HDF only. A multi-tenant SaaS version, if any, will be a separate system later.
- This repository is the **beta** build. Production will be a separate Supabase project and Vercel project.
- **Build order:** foundation, login and roles, then the **Day Book** (accounts entry without inventory), then item master, stock, POS and reports.

## Read Order

1. `CLAUDE.md` (this file)
2. `docs/00-Overview-And-Architecture.md`
3. `docs/01-Phase-Plan.md`
4. The spec for the **current phase** only (for example `docs/02-Phase-0-Foundation.md`, or `docs/04-Phase-2-Day-Book.md` for the Day Book)

## How To Work

- **One Phase At A Time.** Build only the phase you are told to build. Do not build ahead. Do not add tables, screens or packages that belong to a later phase.
- **Mockup Gate.** Before coding any new screen, produce a static HTML mockup in `docs/mockups/phase-N/` and stop. Wait for the owner's written approval. Only then implement it.
- **Ask, Do Not Guess.** If a spec is unclear or a figure is missing, ask the owner. Never invent rates, balances, names, quantities or business rules.
- **Real Data Only.** No sample figures in the code or the database except clearly marked test seeds in `supabase/seed.sql`. Test seeds must never run against production.
- **Complete Files.** Deliver full, copy-paste-ready files, not partial snippets, whenever the owner will paste or review them.
- **Before Every Commit:** `pnpm lint`, `pnpm typecheck` and `pnpm build` must pass.

## Tech Stack (Fixed Unless The Owner Changes It)

- Next.js (App Router), TypeScript in strict mode, pnpm.
- Tailwind CSS with shadcn/ui, themed to look like a clean Material admin.
- Supabase: Postgres, Auth, Row Level Security. Use the `@supabase/ssr` package for server and browser clients.
- Charts: Recharts. Forms: React Hook Form with Zod. Tables: TanStack Table.
- Hosting: Vercel. Database changes only through versioned migrations in `supabase/migrations/`.

## Conventions

### Language And Formatting
- UI labels, headings, buttons and form fields use **Title Case**. Notes, help text and messages use normal sentence case.
- Currency is ₹. Format with `Intl.NumberFormat('en-IN')` so amounts show in lakh and crore style (for example 1,00,000).
- Dates display as DD/MM/YYYY. Timezone is Asia/Kolkata. Store timestamps in UTC (`timestamptz`) and convert for display.
- English labels only in the first release, but write all UI text so it can be translated later (no strings hidden in logic).

### Money And Quantity
- Never use JavaScript floating point for money. Store amounts as `numeric(14,2)` and unit costs as `numeric(14,4)`. Do arithmetic in SQL or with a decimal library.
- Liquor is **Kerala excise (non-GST)**. Food and rooms are **GST**. Never mix them in one tax calculation or one tax ledger.
- Complimentary and cancelled bills are already deducted from sales. They are reporting-only figures and never part of sales or collections.

### Accounting (Day Book Module)
- Value-based only. No inventory and no quantities in the Day Book.
- Ledgers sit under ledger groups. Only the Chief Accountant creates or changes ledgers. Accountants enter transactions and cannot create ledgers.
- Every transaction is double-entry underneath: total debit equals total credit, enforced in the database. Entry screens stay simple for non-professional staff.
- Posted transactions are never hard-deleted. Corrections are by edit or void with a reason, and the audit log keeps old and new values.
- Ledger names use prefix style with a plain hyphen and spaces, in Title Case (for example `Sales - Liquor`).
- Financial year is April to March. Books begin 1 April 2023; live entry starts 1 November 2026; earlier periods are back-filled later in any order.
- The owner gives the detailed Day Book requirement in the Claude Code chat. Record it in `docs/04-Phase-2-Day-Book.md` before coding. Ask, do not guess.

### Database
- Table and column names are `snake_case`. Every table has `id` (uuid), `created_at`, `created_by`, `updated_at`, `updated_by`.
- **Row Level Security is on for every table, always.** No table ships without policies.
- **No hard deletes** on business data. Use a `status` column or `voided_at`, `voided_by`, `void_reason`.
- Every create, update and void on business data writes to `audit_log` (who, when, table, record, old value, new value).
- The service role key is used only in server code. Never expose it to the browser, never log it.

### Security
- Secrets live only in `.env.local` (local) and Vercel environment settings. `.env.local` is git-ignored. Commit a `.env.example` with names only, no values.
- Permission checks happen twice: in the UI (hide what a role cannot use) and in the database (RLS). The database is the real gate.

### UI And Reports
- Minimal Material-style admin, light and dark themes, fully responsive from phone to wide desktop. Design tokens and chart palette are in `docs/00-Overview-And-Architecture.md`.
- Every report uses the global report template defined there. Footers carry **© Cafe Technocrat**.
- Charts use the fixed category colours defined in the overview, so the same category is always the same colour on every screen.

## Git

- One branch per phase: `phase-0-foundation`, `phase-1-login-and-roles`, and so on. Vercel creates a preview link per branch.
- When asking the owner to run Git, always give exactly three commands: `git add`, `git commit`, `git push`.
- Merge to `main` only after the owner approves the preview.

## Never

- Never use caste-associated surnames in examples or sample data. Use first names or neutral identifiers.
- Never put real staff names, phone numbers, passwords or API keys in code or docs.
- Never add a feature, package or table "while we are here". Raise it as a suggestion instead.
- Never run migrations against the production database from a local machine without the owner's explicit instruction.

<!-- END FILE -->

<!-- FILE: docs/00-Overview-And-Architecture.md -->
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

<!-- END FILE -->

<!-- FILE: docs/01-Phase-Plan.md -->
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

<!-- END FILE -->

<!-- FILE: docs/02-Phase-0-Foundation.md -->
# 02: Phase 0 Foundation

Goal: an empty but production-quality shell. Nothing business-specific is built here. When this phase is done, every later phase has solid ground.

Branch: `phase-0-foundation`

## 1. Owner Prerequisites (Done By The Owner, Not Claude Code)

1. **Rename Repository.** On GitHub, rename the repo to `hdf-spiritflow-com-beta` (Settings, General, Repository name) under the Cafe Technocrat account.
2. **Supabase Account.** Sign in to Supabase with the Cafe Technocrat GitHub account. Create a project named `hdf-spiritflow-com-beta`, region **Mumbai (ap-south-1)**. Save the database password in a password manager.
3. **Supabase Settings.** Under Authentication, turn **off** public sign-ups. Users will only be created by the System Admin.
4. **Keys.** Copy the project URL, the public (anon or publishable) key and the service role (secret) key. Keep the secret key private. Never paste it in chat or commit it.
5. **Vercel.** Confirm which Vercel plan the Cafe Technocrat account is on. The free Hobby plan is for non-commercial use; HDF's live operations need a commercial plan before go-live. Beta development can proceed while this is decided.
6. **Tools On The Computer.** Node.js (current LTS), pnpm, Git, and the Supabase CLI.

## 2. Create The Project

Working directory: `D:/Projects/Commercial/Hotel-Diamond-Fort/Spirit-Flow/apps`

1. Create the app named `hdf-spiritflow-com-beta` with `create-next-app`: TypeScript, ESLint, Tailwind, App Router, `src` directory, import alias `@/*`.
2. Initialise Git inside the app folder, set the remote to `https://github.com/cafetechnocrat/hdf-spiritflow-com-beta.git`, and make the first commit on `main`.
3. Copy `CLAUDE.md` to the app root and the `docs/` folder into it.
4. Create the branch `phase-0-foundation` and work there.

## 3. Packages

Install only what Phase 0 needs:
- `@supabase/supabase-js` and `@supabase/ssr`
- shadcn/ui (initialised with the CSS variables option), with these components: button, card, input, label, dialog, dropdown-menu, sheet, tabs, table, badge, skeleton, sonner (toasts), separator, tooltip
- `lucide-react` for icons
- `next-themes` for light and dark mode
- `recharts`, `zod`, `react-hook-form`, `@tanstack/react-table` (installed now so versions are fixed, used from Phase 1 onward)
- `supabase` CLI as a dev dependency

Do not install anything else without asking.

## 4. Folder Structure

```
hdf-spiritflow-com-beta/
  CLAUDE.md
  docs/
    mockups/
  supabase/
    migrations/
    seed.sql
    config.toml
  src/
    app/
      (auth)/            login screens (Phase 1)
      (app)/             signed-in area with the app shell
        layout.tsx
        page.tsx         dashboard placeholder
      health/page.tsx    connection check
    components/
      ui/                shadcn components
      shell/             app shell, navigation, theme toggle
      report/            global report template components
    lib/
      supabase/          browser, server and middleware clients
      format.ts          Indian number, currency and date helpers
      palette.ts         category and outlet colour maps
    styles/
  .env.example
```

## 5. Environment Variables

Create `.env.example` with names only:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
Use whichever key names the Supabase dashboard currently shows for the public and secret keys, and update `.env.example` to match. The owner fills `.env.local` locally and the same values in the Vercel project settings (Preview and Development environments). Confirm `.env.local` is in `.gitignore`.

## 6. Supabase Connection

- Browser client, server client and middleware client using `@supabase/ssr`, following the current Supabase and Next.js documentation.
- Request middleware refreshes the Auth session on each request. Check the current Next.js documentation for the correct file name and location, since it has changed between versions.
- Link the local project to the beta Supabase project with the CLI. The first migration is an empty baseline, committed to `supabase/migrations/`.
- `/health` page: shows app version, environment name and whether a trivial database query succeeds. It must not reveal keys, URLs or any data.

## 7. Design System

- Implement the colour tokens and chart palette from `docs/00-Overview-And-Architecture.md` as CSS variables, with light and dark sets.
- Typography: one sans-serif family, readable sizes on phones, clear heading scale.
- `lib/format.ts`: `formatINR`, `formatNumber` (en-IN grouping), `formatDate` (DD/MM/YYYY, Asia/Kolkata) with unit tests.
- `lib/palette.ts`: the fixed category and outlet colour maps in one place.

## 8. App Shell

- Top bar with page title, theme toggle and a user menu placeholder.
- Navigation: drawer on phones, collapsible side rail on tablets, full sidebar on desktop. Nav items are driven by one config file so later phases only add entries.
- Dashboard placeholder page.
- Consistent page container, spacing and card styles.

## 9. Global Report Template Components

Build empty, reusable components (no business data yet) following section 9 of the overview: `ReportHeader`, `KpiCard`, `ChartCard` (with legend and data-table toggle), `DataTable` (sort, filter, totals row, right-aligned Indian numbers), `ReportFooter` (with © Cafe Technocrat), and loading, empty and error states. Show them on a hidden `/design-preview` page using clearly labelled placeholder values, so the owner can review the look. This page is removed before production.

## 10. Vercel

- Import the GitHub repo into Vercel as `hdf-spiritflow-com-beta` under the Cafe Technocrat account.
- Add the environment variables for Preview and Development.
- Confirm the branch preview builds and the `/health` page works on the preview URL.

## 11. Mockup Gate For Phase 0

Before building the shell, produce one static HTML mockup in `docs/mockups/phase-0/` showing the app shell and one sample report layout at phone, tablet and desktop widths, in light and dark themes. Wait for approval.

## 12. Acceptance Checklist

- App runs locally with `pnpm dev` and builds with `pnpm build`.
- `pnpm lint` and `pnpm typecheck` pass.
- Formatting helpers pass their tests, including lakh and crore grouping.
- `/health` confirms the Supabase connection locally and on the Vercel preview.
- Shell and design preview look correct at phone, tablet and desktop widths in both themes.
- No secrets in Git history. `.env.example` has names only.
- Branch merged to `main` only after the owner approves the preview.

## 13. Out Of Scope For Phase 0

Login, users, roles, any business tables, POS, stock, reports with real data, printing.

<!-- END FILE -->

<!-- FILE: docs/03-Phase-1-Login-And-Roles.md -->
# 03: Phase 1 Login And Roles

Goal: secure sign-in, nine roles, user management, outlet and counter masters, and an audit log, with Row Level Security on every table.

Branch: `phase-1-login-and-roles`. Starts only after Phase 0 is accepted.

## 1. Scope

- Email and password login for office staff.
- Username and PIN login for cashiers on counter devices.
- Two-factor (authenticator app) for MD, System Admin, Chief Accountant and Accounts Staff.
- User management by System Admin only. No self-sign-up.
- Roles and access: nine roles with a fixed permission matrix.
- Outlets and counters masters.
- Audit log and an audit log viewer.
- Password reset, change password, profile page.

## 2. Roles

MD, System Admin, Chief Accountant, Accounts Staff, Night Accountant, Cashier, Stock Keeper, Security, Kitchen Staff.

### Permission Matrix (Phase 1 Modules)

V = view, E = create and edit, A = approve or override, dash = no access.

| Area | MD | System Admin | Chief Accountant | Accounts Staff | Night Accountant | Cashier | Stock Keeper | Security | Kitchen Staff |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard | V | V | V | V | V | V (own outlet) | V | V | V |
| Users | V | E | V | - | - | - | - | - | - |
| Outlets And Counters | V | E | V | V | V | V (own) | V | - | V |
| Audit Log | V | V | V | - | - | - | - | - | - |
| Own Profile | E | E | E | E | E | E | E | E | E |

Later phases extend this matrix (Day Book ledgers and transactions in Phase 2, then item master, stock, POS, reports). Rules already fixed:
- **MD** is view-only everywhere.
- **Night Accountant** has no power to make any payment and has entry-only rights; receives no reports.
- **Cashier** is limited to their own outlet and counter and never sees POS totals during cash closing.
- **Security** operates attendance (HR Flow, later) and nothing else.
- Overrides (bill cancel, discount, stock correction) need a manager PIN held by an approving role. Which roles can approve is confirmed in the phase that introduces each override.

Implement the matrix once, in a single typed file, and mirror it in database policies. The Roles And Access screen shows the matrix read-only.

## 3. Authentication Design

### 3.1 Office Staff
- Supabase Auth with email and password. Public sign-ups disabled in Supabase.
- Users created by the System Admin through a server action using the service role key. The System Admin sets a temporary password and the user must change it at first login.

### 3.2 Cashiers (Username And PIN)
- Supabase Auth is email-based, so each cashier gets an internal email built from the username (for example `username@cashier.internal`; the domain is never shown to users). The PIN is the Auth password.
- A short PIN is weak, so: PIN length is 6 digits, the cashier role has the smallest permissions, failed attempts are rate-limited, and the System Admin can reset or lock a PIN instantly. Confirm Supabase's current rate-limit and minimum-password settings during build and adjust the PIN length if needed.
- Cashier sessions are limited to their assigned outlet and counter, set by the System Admin.

### 3.3 Two-Factor
- Supabase TOTP multi-factor for MD, System Admin, Chief Accountant and Accounts Staff. Enrolment at first login, recovery handled by the System Admin.

### 3.4 Sessions
- Session refresh through the request middleware set up in Phase 0.
- Idle timeout: default 30 minutes on shared counter devices and 8 hours elsewhere. Owner to confirm the numbers.
- Sign-out everywhere option on the profile page.

## 4. Database

Create with migrations. Every table gets Row Level Security, `created_at`, `created_by`, `updated_at`, `updated_by`.

### Tables
- `profiles`: `id` (matches `auth.users.id`), `full_name`, `role` (enum of the nine roles), `username` (unique, nullable), `phone` (nullable), `status` (active, inactive), `must_change_password`.
- `outlets`: `code`, `name`, `type` (bar, restaurant, front_office, other), `status`, `sort_order`.
- `counters`: `outlet_id`, `name`, `status`.
- `user_outlet_access`: `user_id`, `outlet_id`, `counter_id` (nullable). Limits cashiers and other scoped roles. Roles that see all outlets (MD, accounts, admin) need no rows.
- `audit_log`: `occurred_at`, `actor_id`, `action` (insert, update, void, login, logout, failed_login), `table_name`, `record_id`, `old_data` (jsonb), `new_data` (jsonb). Insert-only: no update or delete allowed for any role through the app.

### Security Rules
- A helper database function returns the current user's role from `profiles`. Policies must **not** read the role from anything the user can edit (such as user metadata).
- Only System Admin can insert or update `profiles`, `outlets`, `counters` and `user_outlet_access`.
- Users can read their own profile and update only non-privileged fields of it.
- `audit_log` is readable by MD, System Admin and Chief Accountant only, and writable only by database triggers and server code.
- Triggers write `audit_log` rows on insert, update and status change of the tables above.
- Deactivate users; never delete them.

### Seed Data (Beta Only, In `supabase/seed.sql`)
- The six outlets: Spadikam, Dhruvam, No 20, Malarvadi, Front Office, Touchings, with types set by the owner at build time.
- No counters, no users. Counters are created in the app. The first System Admin is created manually in the Supabase dashboard and promoted with a one-time SQL statement, documented in the phase notes.

## 5. Screens

1. **Sign In:** email and password; a separate tab for Username And PIN.
2. **Two-Factor Setup And Verify.**
3. **Change Password:** forced at first login; also from the profile.
4. **Forgot Password:** reset by email for office roles. Cashiers reset through the System Admin.
5. **App Shell With Role-Based Navigation:** items a role cannot use are hidden.
6. **Users List:** search, filter by role and status, add, edit, deactivate, reset password or PIN, assign outlet and counter.
7. **User Form:** name, role, email or username, outlet and counter access.
8. **Outlets And Counters:** list and edit, add counters per outlet.
9. **Roles And Access:** read-only permission matrix.
10. **Audit Log:** filter by date, user, table and action; detail view showing old and new values.
11. **My Profile:** name, phone, password, sign out everywhere, theme.
12. **Access Denied And Not Found pages.**

All screens use the app shell and design tokens from Phase 0, work from phone to desktop, and use Title Case labels.

## 6. Mockup Gate For Phase 1

Produce static HTML mockups in `docs/mockups/phase-1/` for: sign in (both tabs), users list, user form, outlets and counters, audit log. Show phone and desktop widths. Wait for the owner's approval before implementing.

## 7. Testing

- Test each role against the permission matrix: what the UI shows and what the database allows. Include direct database calls that try to bypass the UI.
- A cashier must not read another outlet's data or any other user's profile.
- Audit entries appear for user creation, role change, deactivation, outlet and counter edits, logins and failed logins.
- Confirm sign-ups are disabled and a deactivated user cannot sign in.

## 8. Acceptance Checklist

- All nine roles can sign in and see only what the matrix allows.
- Policies exist on every table and are tested per role.
- Two-factor works for the four roles that need it.
- Cashier PIN login works and is scoped to outlet and counter.
- Audit log records every action listed above and cannot be edited or deleted from the app.
- Mockups approved before implementation; works at phone, tablet and desktop widths in both themes.
- `pnpm lint`, `pnpm typecheck` and `pnpm build` pass; migrations committed.
- Owner approves the Vercel preview before merge to `main`.

## 9. Out Of Scope For Phase 1

Day Book ledgers and transactions (Phase 2), item master, stock, POS, attendance, reports with business data, bill printing, the manager PIN override flows (built with the features they protect).

## 10. Questions To Settle Before Or During Phase 1

1. Idle timeout values for counter devices and office staff.
2. Whether the Night Accountant needs two-factor (currently not required).
3. Outlet types for the six outlets.
4. Which roles hold the manager PIN for approvals.

<!-- END FILE -->

<!-- FILE: docs/04-Phase-2-Day-Book.md -->
# 04: Phase 2 Day Book

Goal: a value-based Day Book. The Chief Accountant builds the chart of accounts (ledgers); the accountants enter transactions against it. No inventory and no quantities in this phase.

Branch: `phase-2-day-book`. Starts only after Phase 1 is accepted.

## 0. Status Of This File

This is a frame, not the final spec. The owner will give the detailed requirement in the Claude Code chat. Before writing any code, Claude Code must:
1. Read the owner's requirement.
2. Update this file with what was agreed (replace the "Proposed" and "Open" items below).
3. Produce the mockups (section 8) and wait for approval.

Anything marked **Proposed** is a starting suggestion. Anything marked **Open** must be asked, not guessed.

## 1. Scope

- Ledger groups and ledgers: cash, bank accounts, sales, vendors, expense heads, and other account heads.
- Transaction entry against ledgers, value only.
- Day Book: all transactions for a day or date range.
- Ledger statement with running balance, cash and bank book, trial balance (proposed).
- Opening balances and back-dated entry (section 5).
- Void with reason instead of delete; full audit trail.

## 2. Who Does What (Proposed)

| Action | Chief Accountant | Accounts Staff | Night Accountant | MD | System Admin |
| --- | --- | --- | --- | --- | --- |
| Create and edit ledger groups and ledgers | Yes | No | No | No | Open |
| View ledgers | Yes | Yes | Limited | View only | Open |
| Enter transactions | Yes | Yes | Restricted | No | Open |
| Edit or void a transaction | Yes | Open | No | No | No |
| View Day Book and reports | Yes | Yes | No reports | View only | Open |

Rules already fixed elsewhere:
- Only the Chief Accountant creates ledgers. Accountants enter transactions and cannot create or change ledgers.
- The MD is view-only.
- The Night Accountant has no power to make any payment and has entry-only rights. Their entries are limited to already paid or incurred expenses left over by the day accountant, and they receive no reports.
- **Open:** the owner says "accountant". This frame assumes the day accountant is the Accounts Staff role and the night accountant is the Night Accountant role. Confirm.

## 3. Ledger Groups (Proposed Starting List)

Follows the usual Tally-style grouping so the Chief Accountant and CA find it familiar. The Chief Accountant confirms and adjusts with the CA. Groups are seeded as structure; **ledgers are never seeded**. The Chief Accountant creates them.

- Cash-in-Hand
- Bank Accounts
- Sales Accounts
- Purchase Accounts
- Direct Expenses
- Indirect Expenses
- Direct Incomes
- Indirect Incomes
- Sundry Creditors (vendors)
- Sundry Debtors
- Duties And Taxes
- Current Assets
- Current Liabilities
- Fixed Assets
- Capital Account
- Loans (Liability)

Each ledger has: name, group, opening balance (as on the books beginning date) with Dr or Cr, status (active or inactive), optional note.

### Naming Rule
Prefix style with a plain hyphen and a space on each side, Title Case: **Sales - Liquor**, **Sales - Food**, **Purchase - Liquor**. No en-dashes or slashes. An alias can hold a name staff already use.

### Examples From The Tally Plan (For The Chief Accountant To Create, Not Seeded)
Cash, SBI, Federal Bank, BoI, Sales - Liquor, Sales - Food, KSBC (vendor), TCS Receivable, Liquor Cess, plus expense heads. Liquor is Kerala excise (non-GST); food and rooms are GST. Never mix them in one tax ledger.

## 4. Transactions (Proposed)

- Fields: date, voucher type, voucher number, debit and credit lines, narration, optional outlet tag.
- Proposed voucher types: Receipt, Payment, Journal, Contra. Sales and Purchase vouchers are **Open**.
- **Double-entry underneath, simple on screen.** Every transaction must have total debit equal to total credit, enforced in the database. The entry screens stay simple for non-professional staff. For example, a Payment screen asks: paid from (cash or bank ledger), paid to (ledger), amount, narration, and the system posts both sides.
- Voucher numbering per type, by financial year (April to March). Numbering rule is **Open**.
- Posted transactions are never deleted. A mistake is corrected by edit or void with a reason, and the audit log keeps old and new values. Who may edit and whether edits need approval is **Open**.
- Amounts are stored as `numeric(14,2)`, shown in Indian format (lakh and crore).
- Complimentary and cancelled bills are not transactions. They are reporting figures only.

## 5. Opening Balances And Back-Fill (From The Tally Setup)

This follows the plan agreed for the new Tally company. Confirm it applies to the web module.

- Financial year runs April to March. Books begin **1 April 2023** (the hotel opened in October 2023).
- Live entry starts **1 November 2026**. Earlier months are back-filled later, in any order.
- Known balances as on 31 October 2026 (cash, banks, lenders, parties) are brought in through one temporary journal, with the other side posted to a separate ledger, **Capital - Opening Adjustment**, under the Capital Account group. It is kept apart from the real Capital ledger.
- As back-fill proceeds, the adjustment ledger moves toward zero. When the back-fill reaches 31 October 2026 the adjustment ledger should be zero and the temporary journal can be voided. This doubles as a completeness check.
- Back-fill one financial year at a time, oldest first.
- Requirements this creates: back-dated entries must be allowed; the system must show the current balance of the adjustment ledger; optional month locking by the Chief Accountant (**Proposed**).
- Closing stock value and liquor stock are out of scope here (no inventory). How a month-end stock value enters the books is **Open**.

## 6. Database And Security Rules

- Tables follow the conventions in `CLAUDE.md`: Row Level Security on every table, audit columns, no hard deletes, audit log on every change.
- Proposed tables: `ledger_groups`, `ledgers`, `vouchers` (header), `voucher_lines` (debit and credit lines). Names to confirm.
- A database check (constraint or trigger) rejects any voucher whose debits and credits differ.
- Ledger balances and the Day Book come from database views or functions, so every report shows the same numbers.
- Permission checks in the UI and in database policies, from one typed permission matrix. Phase 2 adds Ledgers and Transactions rows to the matrix from Phase 1.

## 7. Reports (Global Report Template)

All use the global report template from `docs/00-Overview-And-Architecture.md`, with Indian number format, a totals row, PDF, Excel and print view, and the © Cafe Technocrat footer.

- **Day Book:** all transactions by date or date range, filter by voucher type, ledger and outlet tag.
- **Ledger Statement:** one ledger with opening balance, entries, running balance and closing balance.
- **Cash And Bank Book:** cash and each bank ledger by day.
- **Trial Balance (proposed):** all ledgers with debit and credit totals as on a date.

Which reports are needed first is **Open**.

## 8. Mockup Gate For Phase 2

Produce static HTML mockups in `docs/mockups/phase-2/` at phone and desktop widths for: ledger groups and ledger list, ledger form, transaction entry (Payment and Receipt at least), Day Book, ledger statement. Wait for the owner's approval before implementing.

## 9. Testing

- Every role tested against the table in section 2, in the UI and with direct database calls that try to bypass it.
- A voucher with unequal debit and credit is rejected by the database.
- Void keeps the original entry and the reason; nothing is hard-deleted.
- Day Book totals and ledger balances match a hand-checked sample from real HDF entries.
- Back-dated entries show correctly in Day Book and ledger statements.

## 10. Acceptance Checklist

- The Chief Accountant can create ledger groups and ledgers; accountants cannot.
- Accountants can enter, view and (where allowed) correct transactions.
- Debit equals credit is enforced by the database.
- Day Book, ledger statement and cash and bank book match the sample.
- Audit log records every create, edit and void.
- Mockups approved; works at phone, tablet and desktop widths in both themes.
- `pnpm lint`, `pnpm typecheck` and `pnpm build` pass; migrations committed.
- Owner approves the Vercel preview before merge to `main`.

## 11. Out Of Scope For Phase 2

Inventory, stock, item master, POS and bills, GST returns, bank reconciliation, posting to or export from Tally, bill printing, payroll.

## 12. Open Questions For The Claude Code Chat

1. Voucher types and numbering.
2. Who may edit or void a posted transaction, and whether approval is needed.
3. Whether "accountant" means Accounts Staff and Night Accountant as assumed.
4. Whether System Admin can see financial data.
5. Outlets: a tag on each transaction (cost-centre style) or separate ledgers per outlet.
6. How month-end closing stock value enters the books (no inventory).
7. Month locking and who controls it.
8. Whether existing Tally data will be imported or entered fresh.
9. Attachments (bills, receipts) on transactions: now or later.
10. The first reports needed.

<!-- END FILE -->

