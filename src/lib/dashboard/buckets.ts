import { addDays, financialYearStart } from "@/lib/reports/dates";

// The Day, Week, Month and Year views of the dashboard charts. Every view ends
// on the anchor date (the transaction date) and looks back from there:
//   Day: the anchor day and the six days before it.
//   Week: the week of the anchor and the four before it, each Monday to Sunday.
//   Month: the month of the anchor and the five before it.
//   Year: the financial year of the anchor (April to March) and the four before it.
// The last bucket of each view stops at the anchor, so a day after it is not counted.
// Safe to import in browser code.

export type ChartRange = "day" | "week" | "month" | "year";
export const CHART_RANGES: ChartRange[] = ["day", "week", "month", "year"];

export type Bucket = { label: string; from: string; to: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayMonth(date: string): string {
  return `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
}

// The Monday of the week that holds the date.
function weekStart(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 is Sunday
  return addDays(date, -((day + 6) % 7));
}

function monthEnd(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

const cap = (date: string, anchor: string) => (date > anchor ? anchor : date);

export function chartBuckets(range: ChartRange, anchor: string): Bucket[] {
  const buckets: Bucket[] = [];

  if (range === "day") {
    for (let back = 6; back >= 0; back -= 1) {
      const day = addDays(anchor, -back);
      buckets.push({ label: dayMonth(day), from: day, to: day });
    }
  } else if (range === "week") {
    const current = weekStart(anchor);
    for (let back = 4; back >= 0; back -= 1) {
      const from = addDays(current, -7 * back);
      const to = cap(addDays(from, 6), anchor);
      buckets.push({ label: `${dayMonth(from)} - ${dayMonth(addDays(from, 6))}`, from, to });
    }
  } else if (range === "month") {
    const year = Number(anchor.slice(0, 4));
    const month = Number(anchor.slice(5, 7));
    for (let back = 5; back >= 0; back -= 1) {
      const index = year * 12 + (month - 1) - back;
      const y = Math.floor(index / 12);
      const m = (index % 12) + 1;
      const from = `${y}-${String(m).padStart(2, "0")}-01`;
      buckets.push({
        label: `${MONTHS[m - 1]} ${String(y).slice(2)}`,
        from,
        to: cap(monthEnd(y, m), anchor),
      });
    }
  } else {
    const startYear = Number(financialYearStart(anchor).slice(0, 4));
    for (let back = 4; back >= 0; back -= 1) {
      const y = startYear - back;
      buckets.push({
        label: `${y}-${String(y + 1).slice(2)}`,
        from: `${y}-04-01`,
        to: cap(`${y + 1}-03-31`, anchor),
      });
    }
  }
  return buckets;
}

// The dates the daily figures must cover to fill every view.
export function chartSpan(anchor: string): { from: string; to: string } {
  const from = CHART_RANGES.map((range) => chartBuckets(range, anchor)[0].from).sort()[0];
  return { from, to: anchor };
}

// One row of daily figures: the day and one amount in paise for each series.
export type DayFigures = { day: string; values: bigint[] };

// Adds the daily figures up for every bucket. Returns one list of amounts per
// bucket, one amount per series.
export function sumByBucket(buckets: Bucket[], rows: DayFigures[], series: number): bigint[][] {
  return buckets.map((bucket) => {
    const totals = Array.from({ length: series }, () => BigInt(0));
    for (const row of rows) {
      if (row.day < bucket.from || row.day > bucket.to) continue;
      for (let i = 0; i < series; i += 1) totals[i] += row.values[i] ?? BigInt(0);
    }
    return totals;
  });
}
