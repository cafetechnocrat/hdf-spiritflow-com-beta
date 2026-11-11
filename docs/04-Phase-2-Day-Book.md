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
- Ledger names reject long dashes and slashes. Opening balance is stored as `numeric(14,2)` with Dr or Cr.

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

All use the global report template from `docs/00-Overview-And-Architecture.md`, with Indian number format, a totals row, PDF, Excel and print view, and a footer with notes only (no copyright or company branding).

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

