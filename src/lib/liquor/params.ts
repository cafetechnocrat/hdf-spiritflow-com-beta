import { DEFAULT_PAGE_SIZE, PAGE_SIZES, VOLUMES, type ItemQuery } from "./types";

export type RawParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Reads the Items list filters from the address. Anything odd falls back to the
// default, so a hand-edited address cannot break the page.
export function parseItemQuery(raw: RawParams, today: string): ItemQuery {
  const status = one(raw.status);
  const peg = one(raw.peg);
  const volume = Number(one(raw.volume));
  const size = Number(one(raw.size));
  const page = Number(one(raw.page));
  const asOn = one(raw.asOn);
  return {
    q: one(raw.q).trim().slice(0, 100),
    category: UUID.test(one(raw.category)) ? one(raw.category) : "",
    type: UUID.test(one(raw.type)) ? one(raw.type) : "",
    volume: (VOLUMES as readonly number[]).includes(volume) ? volume : null,
    peg: peg === "yes" || peg === "no" ? peg : null,
    status: status === "inactive" || status === "all" ? status : "active",
    asOn: /^\d{4}-\d{2}-\d{2}$/.test(asOn) ? asOn : today,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    size: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
  };
}
