# Liquor Item Master

Phase 3, first slice. The liquor inventory master under Inventory Management. Mockup: `docs/mockups/phase-3/liquor-items.html` (approved 13 November 2026). Source list: `HDF_Inventory_Master_20261113_Full.xlsx`, sheet Inventory Master.

## Scope

- A dedicated liquor master. Food and other inventory get their own tables and columns later.
- The whole BevCo list is kept: 4,627 items. 142 are Active (the items stocked now). The rest are Inactive BevCo items that may be bought later. An item is never deleted, only made Inactive.
- Not in this slice: stock on hand, the stock ledger and average cost (Phase 4), selling rates per outlet (POS), the Inventory Report.

## Tables

| Table | Holds |
|---|---|
| `liquor_categories` | name, sort order, status. Beer, Brandy, Gin, Liqueur, Rum, Tequila, Vodka, Whisky, White Rum, Wine. More can be added on the screen. |
| `liquor_types` | name, meaning, status. IMFL and FMFL. |
| `liquor_items` | identity only: item code (unique), BevCo item name, stock name, type, category, volume in ml, bottles per case, peg sale allowed, status. |
| `liquor_item_rates` | the rate ledger: item, effective date, case rate, FL1 shop price, cess. One row per price change. Unique per item and date. Rows are added, never changed or deleted. |

Rate and cost per bottle and per peg are never stored. They are worked out from the rate row in force and the item's size.

## Rules

- **Display name.** First line: stock name, then the size and ML, like AMSTEL BEER 650 ML. Second line, smaller, in another colour and font: (item code | BevCo item name). When the stock name is only the BevCo name, the second line shows the code alone.
- **Peg Sale Allowed.** Yes means the liquor can be sold by the peg. No means by the bottle only; peg figures are hidden.
- **Peg.** 60 ml. Pegs per bottle = volume ÷ 60.
- **Rate in force.** For a date, the newest rate row with an effective date on or before it.
- **Cess.** Set by the database from the FL1 shop price: below 500 none, 500 to 999 it is 20, 1,000 and above it is 40. A price of exactly 500 or 1,000 falls in the higher slab. No item in the BevCo list sits on either boundary. Cess is part of cost.
- **Rate per bottle** = case rate ÷ bottles per case. **Cost per bottle** = rate per bottle + cess. **Rate per peg** = rate per bottle ÷ volume × 60. **Cost per peg** = cost per bottle ÷ volume × 60. Worked out in whole paise and rounded once.
- **First load.** Rates are effective from 01/04/2023, the start of the business. A later price list uses its own date and adds a row only where a price changed.
- **Used rows.** When purchases exist, a rate row that a purchase used cannot be edited or deleted. A mistake is corrected by adding a new row from that date.

## Access

Two role features, set on the Roles screen. Each offers View and Edit; there is no Delete.

- `liquor_items`: the items, categories and types, and the import.
- `liquor_rates`: the rate history and adding a rate.

Whoever has access to Ledger Groups And Ledgers starts with the same on both. The System Admin always has full access.

## Screens

Under Inventory Management, Liquor Items has three tabs.

- **Items.** Search, filters (category, type, size, peg sale, status) and a Rates As On date. Ten rows per page by default, with First, Previous, Next and Last. Add Item, Edit, and Rates for each item. Rates opens the history and the Update Rate form.
- **Categories And Types.** Add and edit. Shows how many items each holds.
- **Import From Excel.** Choose the file and the effective date. The file is checked first and shows the rows read, new items, new rates, new categories and types, warnings and errors. Nothing is saved until Import is pressed. A file with errors cannot be imported.

## Later

Stock balance and stock ledger (average cost across the whole hotel, as on any date), purchase entry, sales rates per outlet, the Inventory, Stock and Stock Value reports.
