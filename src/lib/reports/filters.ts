import type { ReportParams } from "./params";
import type { FilterField, FilterOption, ReportKey } from "./types";

// The filter bar of each report. The option lists come from the database.
export function reportFilterFields(
  key: ReportKey,
  params: ReportParams,
  options: { ledgers: FilterOption[]; types: FilterOption[] },
): FilterField[] {
  switch (key) {
    case "day-book":
      return [
        { kind: "date", name: "from", label: "From", value: params.from },
        { kind: "date", name: "to", label: "To", value: params.to },
        {
          kind: "select",
          name: "typeId",
          label: "Voucher Type",
          value: params.typeId,
          options: [{ value: "", label: "All Types" }, ...options.types],
        },
        {
          kind: "select",
          name: "ledgerId",
          label: "Ledger",
          value: params.ledgerId,
          options: [{ value: "", label: "All Ledgers" }, ...options.ledgers],
        },
        { kind: "check", name: "showVoid", label: "Show Void", value: params.showVoid },
      ];
    case "ledger-statement":
      return [
        {
          kind: "select",
          name: "ledgerId",
          label: "Ledger",
          value: params.ledgerId,
          options: [{ value: "", label: "Select A Ledger" }, ...options.ledgers],
        },
        { kind: "date", name: "from", label: "From", value: params.from },
        { kind: "date", name: "to", label: "To", value: params.to },
      ];
    case "trial-balance":
      return [
        { kind: "date", name: "asOn", label: "As On", value: params.asOn },
        {
          kind: "check",
          name: "showZero",
          label: "Show Ledgers With Zero Balance",
          value: params.showZero,
        },
      ];
    case "profit-loss":
      return [
        { kind: "date", name: "from", label: "From", value: params.from },
        { kind: "date", name: "to", label: "To", value: params.to },
      ];
    case "balance-sheet":
      return [{ kind: "date", name: "asOn", label: "As On", value: params.asOn }];
  }
}
