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

## 11. Roles And Access (Owner Decisions, 2026-11-12)

The permission table in section 2 and the fixed list of nine roles are replaced by data the System Admin controls on a **Roles And Access** screen. Nothing about roles or who can do what stays in code. The menu, the screens and the database rules all read the same tables.

### Roles Are Data
- Roles are rows in a `roles` table. The **System Admin creates, renames and deletes roles** on the Roles And Access screen. The fixed role list in the code and the database type is removed.
- **Starting roles (seeded by migration):** System Admin (locked), Managing Director, Chief Accountant, Accounting Staff, Billing / Cashier, Warehouse Manager, Bar Captain and Restaurant Captain. Any other role is created by the System Admin when needed. The old Night Accountant, Stock Keeper, Security and Kitchen Staff roles are not seeded.
- Each role has: name, Active switch, Require Two-Factor switch, and **sign-in method** (Email And Password, or Username And PIN). Billing / Cashier starts with Username And PIN, which is built later with the cashier login. The other roles start with Email And Password. **Open:** confirm the sign-in method for Bar Captain and Restaurant Captain.
- **System Admin** is the one built-in role. It cannot be renamed, deleted, deactivated or reduced. It always has full access. Only its two-factor switch can change.
- Any other role, including the seeded ones, can be renamed. A role can be **deleted only when no user has it**. Otherwise the screen says how many users hold it and asks for them to be moved first.
- A new role can **copy the access of an existing role** when it is created, then be adjusted.
- Role names are unique and written in Title Case.

### Access By Role And Feature
- For every role and every feature the System Admin ticks **checkboxes inside a dropdown**: **View, Edit and Delete**, or **Select All**. Each one is ticked on its own, so a role gets exactly what applies. View is see only. Edit is create and change. Delete is remove records.
- **Edit and Delete need View.** Ticking Edit or Delete ticks View for you, and unticking View clears them, because a role cannot change what it cannot see.
- A feature offers only the actions that apply to it. The Dashboard and Reports offer View only. Edit Or Void Posted Vouchers is a single Allowed box.
- **Features** are rows in the database, each with the actions it offers: Dashboard, Users, Stock Points And Outlets And Counters, Ledger Groups And Ledgers, Transactions (View, Edit to enter new vouchers, Delete to delete them), Edit Or Void Posted Vouchers, and Reports. New features are added as new rows when their screens are built.
- **Role active.** A role that is not active cannot sign in, and no new user can be given it.
- **Two-factor per role.** A user in a role that requires it must set up and pass an authenticator code at each sign in. This replaces the fixed list of roles in the code and the database.

### Access By User (Owner Decisions, 2026-11-14)
- A role sets the **overall limit**. A user can be given **less than their role, never more**. A user with no custom access has everything their role allows.
- On the **Edit User** screen there is an **Access** section for the user. It lists every feature with the same dropdown and checkboxes (View, Edit, Delete, Select All) as the role screen. Boxes the role does not allow are greyed and cannot be ticked. A feature the role does not offer at all shows "Not in role". Changes save as soon as they are made. A **Reset To Role Access** button gives back everything the role allows.
- **Who changes it:** anyone who can **edit users** (Edit on the Users feature), always inside the person's role. Nobody can change their own access. A System Admin cannot be reduced, so the Access section is not shown for that role.
- **Changing a user's role clears their custom access**, because the new role has its own limits. It can be narrowed again afterwards.
- The Users list shows a **Custom Access** tag next to the role of anyone whose access is narrower than their role. The tag shows only when something is actually reduced.
- The user's effective access is the role's access **and** the user's access. If the role is later reduced, the user loses it too. If the role is later widened, the user does not gain more than their own custom access allows.
- Tables: `user_access` (user, feature, can view, can edit, can delete). A row exists only where the user is narrower than the role. The same `has_access()` function now combines role and user, so every policy, server check and the menu use the combined access.
- Not part of this slice: two-factor or sign-in method per user (those stay on the role).

### Starting Values
- After the reset, **System Admin is the only role with access**. Every other seeded role starts inactive, with nothing ticked on any feature.
- Two-factor starts **on for System Admin only**.
- The Roles And Access screen itself is for the System Admin only.

### Rules
- Tables: `roles`, `features` (with the actions each offers), and `role_access` (role, feature, can view, can edit, can delete). A function answers "does this user have this action on this feature" and every policy and server check uses it. The `profiles.role` column points at the roles table.
- Changes take effect on the user's next request. The audit log records every change to roles and access.
- The Users screen lists only active roles when choosing a role for a user.
- **Open:** a role switched inactive while users are signed in loses access at once, and those users see a "No Access" page. Confirm that is wanted.

### Built So Far (Roles And Access)
- Screen at `/roles`, System Admin only, under Administration. Migration `20261114100000_roles_and_access.sql` adds `roles`, `features` and `role_access`, moves `profiles` to `role_id`, and replaces every policy and voucher function with the `has_access(feature, action)` helper. The old `user_role` type and `current_user_role()` are removed.
- The app loads the user's role, switches and access with the user (`getCurrentUser`). Menu items, pages and server actions check that access. A role switched off cannot sign in. Two-factor is read from the role.
- Not built yet: access by user inside the role's limit, and a screen to add features (features are seeded by migration).
