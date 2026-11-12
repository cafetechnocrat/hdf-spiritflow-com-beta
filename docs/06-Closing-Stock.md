# 06: Closing Stock (Daily Stock Adjustment)

Owner decision of 2026-11-14 (Option A). This is a bridge until the stock module and Bar POS are live. It gives the right Gross Profit now, with no inventory.

## 1. The Problem

- The Day Book counts a purchase as an expense the day it is bought and a sale the day it is made. Gross Profit is right only when the cost of the stock **consumed** is used: opening stock plus purchases minus closing stock.
- Without a stock figure, a day with a large liquor purchase shows a poor Gross Profit and a day with none shows an inflated one.

## 2. How It Works

- The asset ledger **Stock - Liquor** (under Stock-in-Hand) always holds the real stock value, so the Balance Sheet is right.
- A second ledger, **Stock Adjustment - Liquor** (under Direct Expenses, which is on the trading side), carries the change in stock into Gross Profit.
- Each day the accountant types the **closing stock value at cost**. Spirit Flow posts one Journal voucher for the difference:
  - Stock went up: Dr Stock - Liquor, Cr Stock Adjustment - Liquor. Cost goes down.
  - Stock went down: Dr Stock Adjustment - Liquor, Cr Stock - Liquor. Cost goes up.
  - No change: the value is saved and no voucher is posted.
- Cost of goods consumed for any range then equals opening stock plus purchases minus closing stock, so Gross Profit is right daily, monthly and yearly.
- **Opening stock** is not entered on this screen. The Chief Accountant enters it once as a normal Journal: Dr Stock - Liquor, Cr Capital, dated 1 April 2026, for the closing stock of the day before sales began.

## 3. The Rule For The Journal

- The journal for a date is **the value entered minus the book balance of the stock ledger on that date**, not counting that date's own closing-stock journal. So any other posting to the stock ledger (a wastage journal, for example) is absorbed automatically.
- One closing stock per stock account per date.
- **Back-filling and corrections:** values are kept by date. If a day is added or changed, Spirit Flow works out that day's journal again and then the journal of every later day, in date order, so the chain stays right. The screen tells the user which later days changed and by how much before they confirm.
- The value must be zero or more. Valuation is at cost (purchase price), never selling price.

## 4. The Screen

- **Accounts, Closing Stock.** Mockup: `docs/mockups/phase-2/closing-stock.html`.
- **Stock account:** the pair of ledgers (stock and adjustment) comes from the database. One pair exists today. More can be added later for other stock, with no code change.
- **Entry:** Date (calendar, starts on the transaction date), Closing Stock Value, optional note. A live line shows the book stock, the entered value, the change and the journal that will post.
- **History:** date, closing stock value, change, the journal reference, and View. Editing an existing day needs a reason, as with any posted voucher.
- **States:** no change (no journal), a day already entered (edit it instead), and a later day that will be recalculated.

## 5. Database

- `stock_accounts` (id, name, stock ledger, adjustment ledger, status). The ledgers must be active. The stock ledger sits under an asset group and the adjustment ledger under an expense or income group.
- `closing_stocks` (id, stock account, date, value, the journal voucher it posted or null, audit columns). Unique per stock account and date. Row Level Security on, audited, never hard-deleted.
- A security definer function `save_closing_stock` writes the value, posts or replaces the journal and recalculates later days in one step. It checks access itself.
- Journals are ordinary Journal vouchers with the narration "Closing stock on DD/MM/YYYY", so they show in the Day Book, Trial Balance and every report.
- **Access:** a new feature, Closing Stock, with View and Edit. Changing a day that already has a value also needs the Edit Or Void Posted Vouchers right.
- The ledger **Stock Adjustment - Liquor** and the first stock account are created as data when this is built.

## 6. When The Stock Module Goes Live

The Bar POS will know the cost of every item sold and post the cost of sales on each bill. The daily closing-stock entry then stops. One final adjustment closes the bridge, and this screen is switched off.

## 7. Open Items For The Owner

- The closing stock value of the day before sales began, to enter as the opening Journal.
- Where the daily closing stock figure comes from until the stock module is live.
