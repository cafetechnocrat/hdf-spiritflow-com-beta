import { addDays, financialYearStart, isValidDate, monthStart } from "./dates";
import type { ReportKey } from "./types";

// What a report is asked for, after checking the filters from the address.
// Anything missing or wrong falls back to a default built from the user's
// transaction date. Safe to import in browser code.
export type ReportParams = {
  from: string;
  to: string;
  asOn: string;
  typeId: string;
  ledgerId: string;
  showVoid: boolean;
  showZero: boolean;
};

export type RawParams = Record<string, string | string[] | undefined>;

function one(raw: RawParams, name: string): string | undefined {
  const value = raw[name];
  return Array.isArray(value) ? value[0] : value;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseReportParams(
  key: ReportKey,
  raw: RawParams,
  transactionDate: string,
): ReportParams {
  const date = (name: string, fallback: string) => {
    const value = one(raw, name);
    return isValidDate(value) ? value : fallback;
  };
  const id = (name: string) => {
    const value = one(raw, name);
    return value && UUID.test(value) ? value : "";
  };

  // Each report starts on a sensible range around the transaction date.
  const defaultFrom =
    key === "day-book"
      ? transactionDate
      : key === "cash-bank-book"
        ? monthStart(transactionDate)
        : financialYearStart(transactionDate);

  const from = date("from", defaultFrom);
  const to = date("to", transactionDate);
  return {
    // Keep the range the right way round.
    from: from <= to ? from : to,
    to: from <= to ? to : from,
    asOn: date("asOn", transactionDate),
    typeId: id("typeId"),
    ledgerId: id("ledgerId"),
    showVoid: one(raw, "showVoid") === "1",
    showZero: one(raw, "showZero") === "1",
  };
}

// The same params as a query string for links, such as the export links.
export function paramsToQuery(params: ReportParams): string {
  const query = new URLSearchParams();
  query.set("from", params.from);
  query.set("to", params.to);
  query.set("asOn", params.asOn);
  if (params.typeId) query.set("typeId", params.typeId);
  if (params.ledgerId) query.set("ledgerId", params.ledgerId);
  if (params.showVoid) query.set("showVoid", "1");
  if (params.showZero) query.set("showZero", "1");
  return query.toString();
}

export { addDays };
