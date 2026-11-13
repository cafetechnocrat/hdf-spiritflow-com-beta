# Stock Count

Phase 3. Physical stock taking, by stock point and date, in the web app. It replaces the standalone count tool (`HDF_Stock_Count`). Mockup: `docs/mockups/phase-3/stock-count.html` (approved 15 November 2026).

## Scope

- Counts the Active liquor items at each active Liquor stock point. Both lists come from the database. No stock point or item is named in the code.
- Quantities only: bottles, and pegs where the stock point and the item both allow them. A Liquor stock point has a Peg Allowed choice; an item has Peg Sale Allowed. Beer and the Liquor Store are bottles only.
- The only link to the accounts is **Post To Closing Stock**: the total closing stock value of all the stock points for a date is posted to the Closing Stock screen. Counts, stock values and quantities change no other figure. They will be linked later, when the POS is ready.

## Tables

- `stock_counts`: one per stock point and date. Counted by, status (Draft or Complete), when and by whom it was completed.
- `stock_count_lines`: one per item in a count. Bottles and pegs. Blank means not entered; zero means counted and none left.

Counts are written only through database functions, which check the rights. Reading needs the Stock Count right.

## The five rights

Each is set on the Roles screen.

| Right | What it allows |
|---|---|
| Stock Count (View, Edit, Delete) | See counts. Edit is Stock Taking: enter quantities. Delete removes a count that is not posted. |
| Save Stock Count (Edit) | Press Save. |
| Export Stock Count (Edit) | PDF and Excel of a Complete count. |
| View Stock Value (View) | See the stock value, stock point by stock point and in total, and the Value column on Past Counts. |
| Post To Closing Stock (Edit) | Post the total to Closing Stock. Needs View Stock Value as well, because the dialog shows the total. |

The F & B Manager gets Stock Taking, Save and Export. The Chief Accountant, Accountant and System Admin get all five. Without a right the button is switched off. The F & B Manager never sees a value.

## Counting

- Entries save as the person leaves each box. A count can continue on another phone.
- Every item needs a value, at least 0, to show it was handled.
- **Save** checks every item. If any are blank, the Save button shows how many ("3 items not counted") and the count stays a Draft. If none are blank, the button shows Saved and the count is Complete.
- Changing a Complete count returns it to Draft until Save is pressed again. The audit log keeps the old and new values.
- PDF and Excel open only for a Complete count. They show quantities only.

## Editing, deleting and posting

- A count can be changed or deleted until it is posted to the accounts. A delete removes the count with its lines; the audit log keeps what was in it.
- Posting to Closing Stock locks every count of that date. After that nothing can be entered, saved, changed or deleted, in the screen or in the database. Counts show Posted.
- The 10, 11 and 12 November 2026 counts were loaded from the PDF count sheets (counted by Imported). Their totals match the valuation reports and the closing stock already booked for those dates (₹30,36,163.73, ₹29,04,000.26 and ₹27,54,610.02), so they are marked Posted.

## Stock value

At cost: the bottles plus the pegs (60 ml each) times the cost of a bottle. The cost of a bottle is the case rate in force on the stock date divided by the bottles in a case, plus the cess. Each item is rounded to the paisa. Only Complete counts are valued. On 10 November 2026 the three counts valued this way matched the booked closing stock of ₹30,36,163.73 exactly. Average cost replaces the list rate when purchases are built.

## Post To Closing Stock

Needs a Complete count for every active Liquor stock point on the date, and a rate for every counted item. The dialog shows the total. If closing stock is already entered for that date, posting again needs a reason and the Closing Stock rules apply: the journal is changed and the later days are recalculated. Posting calls the same function as the Closing Stock screen.
