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
- Ledger statement with running balance, trial balance, profit and loss and balance sheet.
- Opening balances and back-dated entry (section 5).
- Void with reason instead of delete; full audit trail.

## 2. Who Does What (Proposed)

| Action | Chief Accountant | Accounts Staff | Night Accountant | MD | System Admin |
| --- | --- | --- | --- | --- | --- |
| Create and edit ledger groups and ledgers | Yes | No | No | No | Open |
| View ledgers | Yes | Yes | Limited | View only | Open |
| Enter transactions | Yes | Yes | Not in this slice | No | Yes |
| Edit or void a transaction | Yes | No | No | No | No |
| View Day Book and reports | Yes | Yes | No reports | View only | Open |

Rules already fixed elsewhere:
- Only the Chief Accountant creates ledgers. Accountants enter transactions and cannot create or change ledgers.
- The MD is view-only.
- The Night Accountant has no power to make any payment and has entry-only rights. Their entries are limited to already paid or incurred expenses left over by the day accountant, and they receive no reports.
- **Open:** the owner says "accountant". This frame assumes the day accountant is the Accounts Staff role and the night accountant is the Night Accountant role. Confirm.

## 3. Ledger Groups (Agreed Direction, Details To Confirm)

**Nothing is hardcoded.** The group list lives only in the database (`ledger_groups`). The app reads every group, its parent and its nature from there. The code holds no list of group names. A migration seeds the starting set once; after that the groups are ordinary data.

### Starting Set (Seeded By Migration): The 28 Tally Default Groups
Primary groups (15), each with its nature:
- Assets: Current Assets, Fixed Assets, Investments, Misc. Expenses (Asset)
- Liabilities: Capital Account, Current Liabilities, Loans (Liability), Suspense Account, Branch / Divisions
- Income: Sales Accounts, Direct Incomes, Indirect Incomes
- Expenses: Purchase Accounts, Direct Expenses, Indirect Expenses

Sub-groups (13), which take the nature of their parent:
- Under Capital Account: Reserves And Surplus
- Under Current Assets: Bank Accounts, Cash-in-Hand, Deposits (Asset), Loans And Advances (Asset), Stock-in-Hand, Sundry Debtors
- Under Current Liabilities: Duties And Taxes, Provisions, Sundry Creditors
- Under Loans (Liability): Bank OD Account, Secured Loans, Unsecured Loans

Names use Title Case and "And" instead of "&".

### Proposed Rules For Groups
- Each group has: name, parent (none for a primary group), nature (Assets, Liabilities, Income, Expenses), default flag, status, sort order.
- A sub-group always has the same nature as its parent. The database enforces it.
- Seeded groups are marked **Default**. A default group cannot be deleted. Its parent and nature are fixed because reports depend on them. **Open:** may the Chief Accountant rename a default group? Proposed: yes.
- The Chief Accountant may add custom groups under any group, and edit them. A custom group can be deleted only when it is inactive and has no ledgers and no sub-groups.
- A group with active ledgers or active sub-groups cannot be deactivated.
- Every change is audited.
- **Open:** keep Stock-in-Hand, Purchase Accounts and Branch / Divisions, given there is no inventory in this phase and HDF is one hotel? They are seeded for now and can be deactivated.
- **Open:** split Duties And Taxes into separate Excise and GST sub-groups so the two never mix. Proposed: yes, as custom groups created by the Chief Accountant.

### Ledgers
Ledgers are never seeded. The Chief Accountant creates them.

### Built So Far (Ledger Groups And Ledgers Screen)
- Screen at `/ledgers`, under Accounts in the menu. Tables `ledger_groups` and `ledgers`, with the 28 default groups seeded by `20261113090000_ledger_groups_and_ledgers.sql`.
- Access: Chief Accountant and System Admin create, edit and delete (owner decision, 2026-11-12). MD and Accounts Staff view. The Night Accountant has no access for now and gets a ledger list with the entry screens.
- Rules held in the database: sub-group nature equals its group; default groups keep their place and cannot be deleted; a group with active ledgers or sub-groups cannot be made inactive; only inactive records can be deleted; income and expense ledgers carry no opening balance.
- Ledger names reject long dashes and slashes. Opening balance is stored as `numeric(14,2)` with Dr or Cr, and an As On Date picked from a calendar on each ledger (`opening_date`, required when there is an amount). No date is fixed in code or the database.

Each ledger has: name, group, opening balance (as on the books beginning date) with Dr or Cr, status (active or inactive), optional note.

### Naming Rule
Prefix style with a plain hyphen and a space on each side, Title Case: **Sales - Liquor**, **Sales - Food**, **Purchase - Liquor**. No en-dashes or slashes. An alias can hold a name staff already use.

### Examples From The Tally Plan (For The Chief Accountant To Create, Not Seeded)
Cash, SBI, Federal Bank, BoI, Sales - Liquor, Sales - Food, KSBC (vendor), TCS Receivable, Liquor Cess, plus expense heads. Liquor is Kerala excise (non-GST); food and rooms are GST. Never mix them in one tax ledger.

## 4. Transactions (Agreed Direction, Details To Confirm)

Owner decisions, 2026-11-12:
- Voucher types in the first release: **Receipt, Payment, Journal, Contra, Sales, Purchase**. All value only.
- Numbering: **per voucher type, per financial year** (April to March). Each type counts from 1 every April. A number is never reused, even after a void.
- Edit and void: **Chief Accountant only**, a reason is required for both. Accounts Staff, Night Accountant and System Admin cannot change a posted voucher.
- Who enters: Chief Accountant, Accounts Staff and System Admin. The Night Accountant form is left out of this slice (owner, 2026-11-12) and comes later.
- No outlet tag on vouchers (owner, 2026-11-12).
- New Voucher opens as a popup window, like the stock and ledger screens.

Nothing is hardcoded. Voucher types, their numbering prefix and which ledger groups each side may pick from are rows in the database, not lists in code.

### Voucher Fields
- Header: voucher type, date (from a calendar), voucher number (assigned on save), optional reference (bill or cheque number), narration.
- Rows: every entry is a list of rows, and **each row is one line holding the debit ledger, the credit ledger and the amount** (owner, 2026-11-12). Each row posts that amount to the debit ledger and the same amount to the credit ledger, so a voucher always balances by construction. The two ledgers of a row must differ and the amount is above zero. A voucher has at least one row.
- A new voucher starts with **one row**. The user adds more rows with Add Line and can remove them.
- **Double-entry underneath, simple on screen.** The database stores each row as one pair, so debit equals credit is guaranteed and enforced there.
- Amounts are `numeric(14,2)` and shown in Indian format. Back-dated entry is allowed.
- Complimentary and cancelled bills are not transactions. They are reporting figures only.

### Entry Screens (One Line Per Row)
Every type uses the same row: debit ledger, credit ledger, amount, on one line. The type decides the labels and which ledgers each side may pick.
- **Payment:** Paid To (debit, any ledger), Paid From (credit, a cash or bank ledger), Amount.
- **Receipt:** Received In (debit, a cash or bank ledger), Received From (credit, any ledger), Amount.
- **Contra:** To (debit, cash or bank), From (credit, cash or bank), Amount. Covers cash deposits, withdrawals and bank transfers.
- **Journal:** Debit (any ledger), Credit (any ledger), Amount.
- **Sales:** Received In Or Due From (debit: cash, bank or a debtor), Sales Or Tax (credit: sales and tax ledgers), Amount. A sale with tax is two rows, for example cash to sales and cash to tax. Liquor excise and GST ledgers are never mixed in one row.
- **Purchase:** Purchase, Expense Or Tax (debit), Paid From Or Due To (credit: cash, bank or a creditor), Amount.
- On a phone the row wraps to two lines to stay readable.

### Transaction Date
- The system keeps a **transaction date** for each user: the date new vouchers start on. If none has been set, it is today's date in Asia/Kolkata. It is stored in the database, not in code.
- The **top bar**, next to Sign Out, has a small "Transaction Date" label and a calendar (owner, 2026-11-12). Picking a date saves it at once. There is no Set button and no dashboard card. On phones the label hides and only the calendar shows. A small dot appears beside it when the date is not today. This is how the accountant sets the date once and then enters many vouchers, including back-fill of earlier months in any order.
- The selector shows on every screen of the signed-in app for roles that can enter transactions, and it is hidden for other roles.
- The voucher popup **always shows the date in a calendar field**, filled with the transaction date. The user can still change it for one voucher. A date that is not today shows a "Back-dated" note beside the field.
- **Open:** should the transaction date reset to today at the start of each day? Proposed: no, it stays until changed, with the dot and the Back-dated note as the reminder.
- Which ledger groups each side of each type may pick from is held in the database (`voucher_type_rules`) and set up by migration. **Proposed starting rules:** cash and bank sides pick under Cash-in-Hand and Bank Accounts; paid-to and received-from pick any ledger; Sales credit picks under Sales Accounts and Duties And Taxes; Sales debit picks under Cash-in-Hand, Bank Accounts and Sundry Debtors; Purchase debit picks under Purchase Accounts, Direct Expenses, Indirect Expenses and Duties And Taxes; Purchase credit picks under Cash-in-Hand, Bank Accounts and Sundry Creditors. **Open:** confirm these.

### Night Accountant
Left out of this slice. When it is added later it will be a restricted form for expenses already paid or incurred, with no payments and no reports. Open: which ledger it credits.

### Built So Far (Transactions Screen)
- Screen at `/transactions`, under Accounts. Migration `20261113130000_vouchers.sql` adds `voucher_types`, `voucher_type_rules`, `voucher_counters`, `vouchers`, `voucher_entries`, `user_preferences` and two views for the screen.
- The six voucher types and their ledger rules are seeded as rows. The screen reads types, labels, rules and ledgers from the database. No ledger or type is listed in code.
- The database assigns the number, writes every row in one step (`save_voucher`), refuses a ledger a type does not allow, refuses an inactive ledger, and never deletes a voucher. Void is `void_voucher`. Edit and void are Chief Accountant only, with a reason.
- Amounts travel as text and add up in whole paise. No floating point touches money.
- The transaction date selector in the top bar saves to `user_preferences` for roles that enter transactions. The list shows the newest 500 vouchers with filters; the Day Book report will cover full history.
- Night Accountant entry, month locking and a screen to manage voucher types and rules are not built yet.

### Development Rights And Balances (Owner Decisions, 2026-11-12)
- While the system is being built, **System Admin has every right** on vouchers: enter, edit, void and delete. Delete is a real delete (typed voucher number to confirm), kept in the audit log. This is an exception to "posted vouchers are never deleted" and **must be reviewed before the system goes live**. Migration `20261113140000_voucher_admin_rights_and_balances.sql`.
- When a ledger is picked on a voucher row, its **balance shows beside it as Dr or Cr**, as on the voucher date. Balance is the opening balance plus posted debits minus posted credits up to that date (the voucher being edited is left out). A balance that has gone the other way shows on the opposite side **with no minus sign**, as in Tally. A zero balance shows no side.

### Built So Far (Reports)
- Reports at `/reports/day-book`, `/reports/ledger-statement`, `/reports/trial-balance`, `/reports/profit-loss` and `/reports/balance-sheet`, under Accounts, Reports in the menu. Migration `20261113150000_reports.sql` adds the group flags (`pl_section`), the `app_settings` hotel name, the `day_book_rows` view and the functions `report_ledger_nets`, `report_ledger_statement` and `report_cash_bank_days`.
- One document model feeds the screen, print view, Excel and PDF, so all four show the same figures. Excel and PDF are built on the server at `/reports/export`. Packages added: `exceljs`, `jspdf`, `jspdf-autotable`.
- The cash and bank book and its group flag were removed on 2026-11-13 (migration `20261113160000_remove_cash_bank_book.sql`).
- Not built yet: editing the hotel name from a screen, and a year-end closing for the Balance Sheet profit.

### Built So Far (Registers)
- Sales Register and Purchase Register at `/reports/sales-register` and `/reports/purchase-register`. Migration `20261113170000_registers.sql` adds the group marker `register_kind` (seeded for Sales Accounts and Purchase Accounts, inherited by sub-groups) and the function `report_register`.
- Each voucher gets the direction of its register ledgers: a normal sale or purchase has the register side positive and a return is the other way, shown as negative amounts in the same columns. There is no screen yet to change which groups feed a register.

### Financial Year Selector (Owner Decision, 2026-11-12)
- The top bar has a **Financial Year** selector at the left (the transaction date stays at the right). A financial year runs 1 April to 31 March. The first and last day of the picked year show beside it.
- With no year picked, the **current financial year** is used. The list of years starts with the year that holds the books begin date (a setting, `books_begin_date`, seeded 01/04/2023) and ends with the current year. The picked year is saved per user in `user_preferences.fy_start_year` the moment it is chosen. Migration `20261113190000_financial_year.sql`.
- Shown for roles that see the accounts: MD, System Admin, Chief Accountant and Accounts Staff.
- The reports follow it: Ledger Statement, both registers and Profit And Loss start from the first day to the last day of the picked year, and Trial Balance and Balance Sheet start as on its last day. The Day Book still starts on the transaction date. Every report can still be changed by its own filters.
- It does not change the transaction date or stop a voucher being dated outside the year. **Suggestion:** when the picked year does not hold the transaction date, move the transaction date into it, which helps back-filling. Not built; say if you want it.

### Voucher Numbers
- Each voucher gets its type's prefix, the financial year and a running number for that type and year, for example Payment No. 12 of 2026-27. The database assigns the number when the voucher is saved, so two people saving at once never get the same number.
- The financial year comes from the voucher date, not from today.
- **Open:** exact display format of the number. Proposed: type prefix, financial year, number, like PAY/2026-27/0012.

### Edit And Void
- Posted vouchers are never deleted. The Chief Accountant can edit a voucher (it keeps its number) or void it. Both need a reason. A voided voucher stays in the list, is marked Void, and is left out of every balance and report total.
- The audit log keeps old and new values for every edit and void.
- **Open:** may the Chief Accountant edit the date of a voucher into a different financial year? Proposed: no, void and re-enter instead, so numbering stays clean.
- Month locking by the Chief Accountant stays **Proposed** and is not part of this first slice.

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
- Tables: `ledger_groups` and `ledgers` (built). For transactions: `voucher_types`, `voucher_type_rules`, `voucher_counters`, `vouchers` (header) and `voucher_entries` (one row per debit ledger, credit ledger and amount), plus the user's transaction date. Names to confirm.
- A database check (constraint or trigger) rejects any voucher whose debits and credits differ.
- Ledger balances and the Day Book come from database views or functions, so every report shows the same numbers.
- Permission checks in the UI and in database policies, from one typed permission matrix. Phase 2 adds Ledgers and Transactions rows to the matrix from Phase 1.

## 7. Reports (Global Report Template)

All use the global report template from `docs/00-Overview-And-Architecture.md`, with Indian number format, a totals row, PDF, Excel and print view, and a footer with notes only (no copyright or company branding).

Owner decisions, 2026-11-12:
- Reports in this slice: **Day Book, Ledger Statement, Sales Register, Purchase Register, Trial Balance, Profit And Loss, Balance Sheet**. The two registers were added on 2026-11-13. A separate Cash And Bank Book is not needed, since the Ledger Statement covers every ledger, cash and bank included (owner, 2026-11-13).
- Exports: **print view, Excel and a direct PDF download**. No paid services.
- Headline cards only. No charts yet.
- Day Book shows **both layouts, switchable**: one line per row (date, voucher, debit, credit, amount) and Tally style (one block per voucher, with each ledger and Dr or Cr underneath).
- No outlet filter (outlets are not on vouchers).

### The Reports
- **Day Book:** vouchers for a date or date range. Filters: voucher type, ledger, show void. The default range is the transaction date. Cards: vouchers, total amount, void vouchers left out.
- **Ledger Statement:** one ledger and a date range. Opening balance on the first day, every entry with the other ledger, debit, credit and a running Dr or Cr balance, then the closing balance.
- **Sales Register and Purchase Register (owner, 2026-11-13):** one line per voucher with a column for each ledger on the register side, plus the particulars (the other side: cash, bank or the party) and a total. A monthly summary with the same columns sits above the list. A voucher belongs to a register when **any of its rows touches a ledger under the sales group (or the purchase group)**, whatever its voucher type, so a sale entered as a Journal is still caught. Sales columns are the ledgers credited (sales and tax ledgers). Purchase columns are the ledgers debited (purchase, expense and tax ledgers). A return shows as a negative amount in its column. Excise and GST ledgers get their own columns and are never added into one. Filters: date range and ledger. Cards: vouchers, gross total, highest voucher, days with entries.
- **Trial Balance:** every ledger with its closing Dr or Cr balance as on a date, grouped under its group tree, with group subtotals and a grand total. A difference line shows if debit and credit do not match.
- **Profit And Loss:** income and expenses for a date range, split into a trading part (gross profit) and the profit and loss part (net profit).
- **Balance Sheet:** assets and liabilities as on a date, with the profit carried in. A difference line shows if it does not balance.

### Rules Every Report Follows
- All figures come from database functions, so every report shows the same numbers. Amounts travel as text and add up in whole paise.
- A balance that has gone the other way shows on the opposite side with no minus sign, as in Tally.
- Void vouchers are left out of every balance and total.
- Nothing is hardcoded. Group headings and group order come from the groups table. The hotel name comes from a settings row.
- Header: report title, hotel name, date range, filters, generated by and generated at (IST). Footer: notes on how the figures are calculated and the date range each covers, with no copyright or company branding. Loading, empty and error states on every report. Print layout hides navigation.
- Filters apply as soon as they change. There is no Show button.
- Menu: Accounts, then a Reports group holding the seven reports. Roles that can view: MD, System Admin, Chief Accountant, Accounts Staff. The Night Accountant has no reports.

### Data Definitions To Confirm
- **Profit and loss split:** the trading part and the profit and loss part come from a section marker on each ledger group, seeded for the default groups (Sales Accounts, Direct Incomes, Purchase Accounts and Direct Expenses are trading; Indirect Incomes and Indirect Expenses are profit and loss). Sub-groups follow their group. **Open:** confirm.
- **Register groups:** a marker on each ledger group says which register it feeds, seeded for Sales Accounts (sales register) and Purchase Accounts (purchase register). Sub-groups follow their group. **Open:** confirm. If a sale or purchase is also posted under another group, mark that group too.
- **Stock:** there is no inventory, so there is no automatic opening or closing stock. Stock appears only as the balance of a Stock-in-Hand ledger. A month-end stock value can be journalled to a ledger under the trading groups and will then flow into gross profit. **Open:** is this how you want stock handled for now?
- **Balance Sheet profit:** the profit carried into the Balance Sheet is the cumulative net profit from the first entry up to the date, shown as its own line under liabilities. There is no year-end closing yet. **Open:** confirm.
- **Hotel name:** a settings row, seeded with the hotel name. **Open:** confirm the exact name to seed.
- **PDF and Excel files:** built on the server. Two packages are added at build time, an Excel writer and a PDF writer. Amounts in PDF use Rs because standard PDF fonts lack the rupee sign; Excel and the screen use the rupee sign. **Open:** confirm.

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
- Day Book and ledger statement match the sample.
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

