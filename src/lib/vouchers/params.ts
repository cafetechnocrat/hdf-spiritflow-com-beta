import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "@/components/ui/pager";
import type { VoucherQuery } from "./types";

export type RawParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Reads the Transactions filters and page from the address. Anything odd falls back
// to the default, so a hand-edited address cannot break the page.
export function parseVoucherQuery(raw: RawParams): VoucherQuery {
  const status = one(raw.status);
  const size = Number(one(raw.size));
  const page = Number(one(raw.page));
  return {
    from: DATE.test(one(raw.from)) ? one(raw.from) : "",
    to: DATE.test(one(raw.to)) ? one(raw.to) : "",
    type: UUID.test(one(raw.type)) ? one(raw.type) : "",
    status: status === "void" || status === "all" ? status : "posted",
    q: one(raw.q).trim().slice(0, 100),
    page: Number.isInteger(page) && page > 0 ? page : 1,
    size: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
  };
}
