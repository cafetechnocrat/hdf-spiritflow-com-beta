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

