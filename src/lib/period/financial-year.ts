// Financial year helpers. A financial year runs from 1 April to 31 March and is
// named by the year it starts in, so 2026 means 2026-27. Safe to import in
// browser code.

export type Period = {
  // The financial year picked, and the current one (by today's date in India).
  selected: number;
  current: number;
  // Every year from the one holding the books begin date up to the current one.
  years: number[];
  // First and last day of the picked year, as YYYY-MM-DD.
  start: string;
  end: string;
};

// The financial year a date falls in.
export function financialYearOf(date: string): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return month >= 4 ? year : year - 1;
}

export function financialYearStartDate(startYear: number): string {
  return `${startYear}-04-01`;
}

export function financialYearEndDate(startYear: number): string {
  return `${startYear + 1}-03-31`;
}

// 2026 becomes 2026-27.
export function financialYearLabel(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function buildPeriod(selected: number, current: number, years: number[]): Period {
  return {
    selected,
    current,
    years,
    start: financialYearStartDate(selected),
    end: financialYearEndDate(selected),
  };
}
