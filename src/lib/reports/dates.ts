// Date helpers on YYYY-MM-DD text, using UTC so no timezone shifts a day.
// Safe to import in browser code.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value: string | undefined): value is string {
  return (
    value !== undefined &&
    DATE_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

export function addDays(date: string, days: number): string {
  const moment = new Date(`${date}T00:00:00Z`);
  moment.setUTCDate(moment.getUTCDate() + days);
  return moment.toISOString().slice(0, 10);
}

// The financial year runs April to March. Returns the first day of the year
// that holds the date.
export function financialYearStart(date: string): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return `${month >= 4 ? year : year - 1}-04-01`;
}

export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

// DD/MM/YYYY.
export function displayDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}
