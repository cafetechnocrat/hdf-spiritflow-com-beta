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

