"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { DataList, ErrorLine, Modal } from "@/components/ui/admin-parts";
import { Pager } from "@/components/ui/pager";
import { badge, button, field } from "@/components/ui/styles";
import { formatDate, formatPaise, parseAmountToPaise } from "@/lib/format/money";
import { fetchRates, saveItem, saveRate } from "@/lib/liquor/actions";
import { cessForPrice, itemSubline, itemTitle, rateFigures } from "@/lib/liquor/calc";
import {
  VOLUMES,
  type ItemQuery,
  type LiquorItemPage,
  type LiquorItemRow,
  type LiquorLookups,
  type RateRow,
} from "@/lib/liquor/types";

// All visible text sits here so it can be translated later.
const text = {
  hint: "Rates and costs shown are the list rates in force on the chosen date, worked out from the rate history. Items are never deleted, only made Inactive.",
  addItem: "Add Item",
  search: "Search Name Or Code",
  allCategories: "All Categories",
  allTypes: "All Types",
  allSizes: "All Sizes",
  pegAll: "Peg Sale: All",
  pegYes: "Peg Sale: Yes",
  pegNo: "Peg Sale: No",
  statusActive: "Active",
  statusInactive: "Inactive",
  statusAll: "All",
  ratesAsOn: "Rates As On",
  colItem: "Item",
  colCategory: "Category",
  colBottlesCase: "Bottles / Case",
  colRate: "Rate / Bottle",
  colCess: "Cess",
  colCost: "Cost / Bottle",
  colCostPeg: "Cost / Peg",
  colPeg: "Peg Sale",
  colStatus: "Status",
  actions: "Actions",
  rates: "Rates",
  edit: "Edit",
  yes: "Yes",
  no: "No",
  noRate: "No rate",
  emptyTitle: "No Items Found",
  emptyHint: "Change the filters, or add an item.",
  rowsPerPage: "Rows per page",
  first: "First",
  previous: "Previous",
  next: "Next",
  last: "Last",
  pagerLabel: "Pages",
  note: "Average cost and stock on hand are added to this list in a later phase, when purchases and stock movements are built.",
  addTitle: "Add Liquor Item",
  editTitle: "Edit Liquor Item",
  itemSub: "Identity of the item. Rates are kept in the rate history, not here.",
  howShows: "How It Shows On Screens",
  code: "Item Code",
  codeHint: "The BevCo code. It cannot repeat.",
  volume: "Volume (ml)",
  itemName: "Item Name (BevCo)",
  stockName: "Stock Name",
  stockHint: "The short name staff use. Shown first, followed by the size.",
  category: "Category",
  type: "Type",
  bpc: "Bottles Per Case",
  pegSale: "Peg Sale Allowed",
  pegHint: "No means it can only be sold by the bottle.",
  status: "Status",
  firstRate: "First Rate (Saved With The New Item)",
  caseRate: "Case Rate",
  caseHint: "BevCo price after tax, per case.",
  fl1: "FL1 Shop Price",
  fl1Hint: "Decides the cess slab.",
  effective: "Effective From",
  editRateHint:
    "To change a price, use Rates on the item. A price change adds a new dated row and keeps the old one.",
  workedOut: "Worked out by the system, never typed",
  enterRate: "Enter the case rate, FL1 price, bottles per case and volume.",
  ratePerBottle: "Rate per bottle",
  cessPerBottle: "Cess per bottle",
  costPerBottle: "Cost per bottle",
  pegsPerBottle: "Pegs per bottle",
  ratePerPeg: "Rate per peg",
  costPerPeg: "Cost per peg",
  pegFigures: "Peg figures",
  bottleOnly: "Not used. Bottle sale only.",
  cancel: "Cancel",
  close: "Close",
  save: "Save Item",
  saveChanges: "Save Changes",
  saving: "Saving...",
  ratesTitle: "Rate History",
  inForce: "In force now",
  ratesLoading: "Loading the rates...",
  ratesNone: "This item has no rate yet.",
  ratesRule:
    "Rows are never edited or deleted. A mistake is corrected by adding a new row from that date.",
  updateRate: "Update Rate",
  addRate: "Add Rate",
  newRow: "New row, worked out by the system",
  select: "Select",
  colEffective: "Effective From",
  colCase: "Case Rate",
  colFl1: "FL1 Price",
} as const;


// Builds an address from the filters. The page reloads with them.
function addressFor(path: string, query: ItemQuery, change: Partial<ItemQuery>): string {
  const next = { ...query, ...change };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.category) params.set("category", next.category);
  if (next.type) params.set("type", next.type);
  if (next.volume) params.set("volume", String(next.volume));
  if (next.peg) params.set("peg", next.peg);
  if (next.status !== "active") params.set("status", next.status);
  params.set("asOn", next.asOn);
  if (next.page > 1) params.set("page", String(next.page));
  if (next.size !== 10) params.set("size", String(next.size));
  return `${path}?${params.toString()}`;
}

function amount(textValue: string): string {
  const paise = parseAmountToPaise(textValue);
  return paise === null ? textValue : formatPaise(paise);
}

// The two lines of an item name. The second line is smaller, in another colour
// and another font.
function ItemName({ item }: { item: Pick<LiquorItemRow, "stockName" | "volumeMl" | "itemCode" | "itemName"> }) {
  return (
    <div className="min-w-[240px]">
      <div className="font-semibold">{itemTitle(item.stockName, item.volumeMl)}</div>
      <div className="mt-px font-mono text-[0.72rem] leading-snug text-link">
        {itemSubline(item.itemCode, item.itemName, item.stockName)}
      </div>
    </div>
  );
}

// What the item costs, worked out from one rate row. Shown under both forms.
function Figures({
  caseRate,
  fl1Price,
  bottlesPerCase,
  volumeMl,
  pegSale,
  compareCost,
}: {
  caseRate: string;
  fl1Price: string;
  bottlesPerCase: number;
  volumeMl: number;
  pegSale: boolean;
  // The cost per bottle of the row in force, to show the change against.
  compareCost?: bigint;
}) {
  const cess = cessForPrice(fl1Price);
  const figures = cess === null ? null : rateFigures(caseRate, cess, bottlesPerCase, volumeMl);
  if (!figures) {
    return (
      <div className="mb-3.5 rounded-[14px] bg-track px-3.5 py-3 text-[0.86rem]" role="status">
        <div className="font-semibold">{text.enterRate}</div>
      </div>
    );
  }
  const row = (label: string, value: string, strong = false) => (
    <div className="flex justify-between gap-3 py-0.5 tabular-nums">
      <span className="text-muted">{label}</span>
      <span className={strong ? "font-semibold" : undefined}>{value}</span>
    </div>
  );
  const change =
    compareCost === undefined
      ? ""
      : ` (${figures.costPerBottle >= compareCost ? "+" : "-"}${formatPaise(
          figures.costPerBottle >= compareCost
            ? figures.costPerBottle - compareCost
            : compareCost - figures.costPerBottle,
        )} from ₹${formatPaise(compareCost)})`;
  return (
    <div className="mb-3.5 rounded-[14px] bg-track px-3.5 py-3 text-[0.86rem]" role="status">
      <div className="mb-1.5 font-semibold">{text.workedOut}</div>
      {row(text.ratePerBottle, `₹${formatPaise(figures.ratePerBottle)}`)}
      {row(text.cessPerBottle, `₹${formatPaise(figures.cess)}`)}
      {row(text.costPerBottle, `₹${formatPaise(figures.costPerBottle)}${change}`, true)}
      {pegSale ? (
        <>
          {row(text.pegsPerBottle, figures.pegsPerBottle)}
          {row(text.ratePerPeg, `₹${formatPaise(figures.ratePerPeg)}`)}
          {row(text.costPerPeg, `₹${formatPaise(figures.costPerPeg)}`, true)}
        </>
      ) : (
        row(text.pegFigures, text.bottleOnly)
      )}
    </div>
  );
}

// Add or change an item. Changing leaves the prices alone; they have a history.
function ItemForm({
  record,
  lookups,
  asOn,
  onClose,
}: {
  record: LiquorItemRow | null;
  lookups: LiquorLookups;
  asOn: string;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [code, setCode] = useState(record?.itemCode ?? "");
  const [itemName, setItemName] = useState(record?.itemName ?? "");
  const [stockName, setStockName] = useState(record?.stockName ?? "");
  const [volume, setVolume] = useState(record ? String(record.volumeMl) : "");
  const [bpc, setBpc] = useState(record ? String(record.bottlesPerCase) : "");
  const [peg, setPeg] = useState(record?.pegSaleAllowed ? "yes" : "no");
  const [caseRate, setCaseRate] = useState(record?.rate?.caseRate ?? "");
  const [fl1, setFl1] = useState(record?.rate?.fl1Price ?? "");
  const ids = { code: useId(), volume: useId(), name: useId(), stock: useId(), category: useId(), type: useId(), bpc: useId(), peg: useId(), status: useId(), caseRate: useId(), fl1: useId(), effective: useId() };

  const volumeNumber = Number(volume);
  const bpcNumber = Number(bpc);
  const previewTitle = itemTitle(stockName || "STOCK NAME", Number.isFinite(volumeNumber) && volumeNumber > 0 ? volumeNumber : 0);
  const previewLine = itemSubline(code || "Item Code", itemName || stockName || "", stockName || "");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveItem(formData);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  const categories = lookups.categories.filter((c) => c.status === "active" || c.id === record?.categoryId);
  const types = lookups.types.filter((t) => t.status === "active" || t.id === record?.typeId);
  const input = (id: string, name: string, value: string, set: (v: string) => void, extra?: { inputMode?: "numeric" | "decimal"; placeholder?: string }) => (
    <input
      id={id}
      name={name}
      type="text"
      autoComplete="off"
      value={value}
      inputMode={extra?.inputMode}
      placeholder={extra?.placeholder}
      onChange={(event) => set(event.target.value)}
      className={field.input}
    />
  );
  const label = (id: string, labelText: string, required = true) => (
    <label htmlFor={id} className={field.label}>
      {labelText} {required ? <span className="text-error">*</span> : null}
    </label>
  );

  return (
    <Modal title={record ? text.editTitle : text.addTitle} subtitle={text.itemSub} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate>
        {record ? <input type="hidden" name="id" value={record.id} /> : null}

        <div className="mb-3.5 rounded-[14px] bg-accent-soft px-3.5 py-2.5" aria-live="polite">
          <div className="mb-0.5 text-[0.72rem] font-semibold uppercase tracking-[0.05em] text-muted">
            {text.howShows}
          </div>
          <div className="font-semibold">{previewTitle}</div>
          <div className="font-mono text-[0.72rem] text-link">{previewLine}</div>
        </div>

        <div className="grid gap-x-4 sm:grid-cols-2">
          <div className="mb-3.5">
            {label(ids.code, text.code)}
            {input(ids.code, "itemCode", code, setCode)}
            <p className={field.hint}>{text.codeHint}</p>
          </div>
          <div className="mb-3.5">
            {label(ids.volume, text.volume)}
            {input(ids.volume, "volumeMl", volume, setVolume, { inputMode: "numeric" })}
          </div>
        </div>
        <div className="mb-3.5">
          {label(ids.name, text.itemName)}
          {input(ids.name, "itemName", itemName, setItemName)}
        </div>
        <div className="mb-3.5">
          {label(ids.stock, text.stockName)}
          {input(ids.stock, "stockName", stockName, setStockName)}
          <p className={field.hint}>{text.stockHint}</p>
        </div>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <div className="mb-3.5">
            {label(ids.category, text.category)}
            <select id={ids.category} name="categoryId" defaultValue={record?.categoryId ?? ""} className={field.input}>
              <option value="">{text.select}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="mb-3.5">
            {label(ids.type, text.type)}
            <select id={ids.type} name="typeId" defaultValue={record?.typeId ?? ""} className={field.input}>
              <option value="">{text.select}</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <div className="mb-3.5">
            {label(ids.bpc, text.bpc)}
            {input(ids.bpc, "bottlesPerCase", bpc, setBpc, { inputMode: "numeric" })}
          </div>
          <div className="mb-3.5">
            {label(ids.peg, text.pegSale, false)}
            <select id={ids.peg} name="pegSaleAllowed" value={peg} onChange={(event) => setPeg(event.target.value)} className={field.input}>
              <option value="yes">{text.yes}</option>
              <option value="no">{text.no}</option>
            </select>
            <p className={field.hint}>{text.pegHint}</p>
          </div>
        </div>
        <div className="mb-3.5">
          {label(ids.status, text.status, false)}
          <select id={ids.status} name="status" defaultValue={record?.status ?? "active"} className={field.input}>
            <option value="active">{text.statusActive}</option>
            <option value="inactive">{text.statusInactive}</option>
          </select>
        </div>

        {record ? null : (
          <>
            <h3 className="mb-2 mt-4 text-[0.78rem] font-semibold uppercase tracking-[0.05em] text-muted">
              {text.firstRate}
            </h3>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <div className="mb-3.5">
                {label(ids.caseRate, text.caseRate)}
                {input(ids.caseRate, "caseRate", caseRate, setCaseRate, { inputMode: "decimal", placeholder: "0.00" })}
                <p className={field.hint}>{text.caseHint}</p>
              </div>
              <div className="mb-3.5">
                {label(ids.fl1, text.fl1)}
                {input(ids.fl1, "fl1Price", fl1, setFl1, { inputMode: "decimal", placeholder: "0.00" })}
                <p className={field.hint}>{text.fl1Hint}</p>
              </div>
            </div>
            <div className="mb-3.5">
              {label(ids.effective, text.effective)}
              <input id={ids.effective} name="effectiveDate" type="date" defaultValue={asOn} className={field.input} />
            </div>
          </>
        )}

        <Figures
          caseRate={caseRate}
          fl1Price={fl1}
          bottlesPerCase={Number.isInteger(bpcNumber) ? bpcNumber : 0}
          volumeMl={Number.isInteger(volumeNumber) ? volumeNumber : 0}
          pegSale={peg === "yes"}
        />
        {record ? <p className={`${field.hint} mb-3`}>{text.editRateHint}</p> : null}

        <ErrorLine message={error} />
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} disabled={pending} className={button.secondary}>
            {text.cancel}
          </button>
          <button type="submit" disabled={pending} className={button.primary}>
            {pending ? text.saving : record ? text.saveChanges : text.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// The rate history of one item, with a form to add a new dated row.
function RatesDialog({
  item,
  canEditRates,
  asOn,
  onClose,
}: {
  item: LiquorItemRow;
  canEditRates: boolean;
  asOn: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<RateRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [caseRate, setCaseRate] = useState("");
  const [fl1, setFl1] = useState("");
  const ids = { eff: useId(), case: useId(), fl1: useId() };

  useEffect(() => {
    let live = true;
    fetchRates(item.id).then((loaded) => {
      if (live) setRows(loaded);
    });
    return () => {
      live = false;
    };
  }, [item.id]);

  const newest = rows?.[0];
  const todayRow = rows?.find((r) => r.effectiveDate <= asOn);
  const current = todayRow
    ? rateFigures(todayRow.caseRate, todayRow.cessAmount, item.bottlesPerCase, item.volumeMl)
    : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveRate(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setCaseRate("");
      setFl1("");
      setRows(await fetchRates(item.id));
      router.refresh();
    });
  }

  return (
    <Modal
      title={text.ratesTitle}
      subtitle={<ItemName item={item} />}
      onClose={onClose}
    >
      {rows === null ? (
        <p className="mb-3 text-[0.88rem] text-muted">{text.ratesLoading}</p>
      ) : rows.length === 0 ? (
        <p className="mb-3 text-[0.88rem] text-muted">{text.ratesNone}</p>
      ) : (
        <div className="mb-3 overflow-x-auto rounded-2xl border border-divider">
          <table className="w-full border-collapse text-[0.84rem] tabular-nums">
            <thead>
              <tr className="border-b border-divider bg-[#f8f9fc] text-right text-[0.7rem] font-semibold uppercase tracking-[0.04em] text-muted">
                <th className="px-3 py-2 text-left">{text.colEffective}</th>
                <th className="px-3 py-2">{text.colCase}</th>
                <th className="px-3 py-2">{text.colFl1}</th>
                <th className="px-3 py-2">{text.colCess}</th>
                <th className="px-3 py-2">{text.colCost}</th>
                {item.pegSaleAllowed ? <th className="px-3 py-2">{text.colCostPeg}</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const figures = rateFigures(r.caseRate, r.cessAmount, item.bottlesPerCase, item.volumeMl);
                return (
                  <tr key={r.id} className="border-b border-divider text-right last:border-b-0">
                    <td className="px-3 py-2 text-left">
                      <div className="font-semibold">{formatDate(r.effectiveDate)}</div>
                      {r.id === todayRow?.id ? (
                        <div className="text-[0.72rem] text-muted">{text.inForce}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{amount(r.caseRate)}</td>
                    <td className="px-3 py-2">{amount(r.fl1Price)}</td>
                    <td className="px-3 py-2">{amount(r.cessAmount)}</td>
                    <td className="px-3 py-2 font-semibold">{figures ? formatPaise(figures.costPerBottle) : ""}</td>
                    {item.pegSaleAllowed ? (
                      <td className="px-3 py-2 font-semibold">{figures ? formatPaise(figures.costPerPeg) : ""}</td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className={`${field.hint} mb-3`}>{text.ratesRule}</p>

      {canEditRates ? (
        <form onSubmit={onSubmit} noValidate>
          <input type="hidden" name="itemId" value={item.id} />
          <h3 className="mb-2 mt-3 text-[0.78rem] font-semibold uppercase tracking-[0.05em] text-muted">
            {text.updateRate}
          </h3>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <div className="mb-3.5">
              <label htmlFor={ids.eff} className={field.label}>
                {text.effective} <span className="text-error">*</span>
              </label>
              <input id={ids.eff} name="effectiveDate" type="date" defaultValue={asOn} className={field.input} />
            </div>
            <div className="mb-3.5">
              <label htmlFor={ids.case} className={field.label}>
                {text.caseRate} <span className="text-error">*</span>
              </label>
              <input
                id={ids.case}
                name="caseRate"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder={newest ? amount(newest.caseRate) : "0.00"}
                value={caseRate}
                onChange={(event) => setCaseRate(event.target.value)}
                className={field.input}
              />
            </div>
          </div>
          <div className="mb-3.5">
            <label htmlFor={ids.fl1} className={field.label}>
              {text.fl1} <span className="text-error">*</span>
            </label>
            <input
              id={ids.fl1}
              name="fl1Price"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={newest ? amount(newest.fl1Price) : "0.00"}
              value={fl1}
              onChange={(event) => setFl1(event.target.value)}
              className={field.input}
            />
          </div>
          <Figures
            caseRate={caseRate}
            fl1Price={fl1}
            bottlesPerCase={item.bottlesPerCase}
            volumeMl={item.volumeMl}
            pegSale={item.pegSaleAllowed}
            compareCost={current?.costPerBottle}
          />
          <ErrorLine message={error} />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} className={button.secondary}>
              {text.close}
            </button>
            <button type="submit" disabled={pending} className={button.primary}>
              {pending ? text.saving : text.addRate}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={button.secondary}>
            {text.close}
          </button>
        </div>
      )}
    </Modal>
  );
}

export function ItemsPanel({
  page,
  query,
  lookups,
  canEdit,
  canEditRates,
}: {
  page: LiquorItemPage;
  query: ItemQuery;
  lookups: LiquorLookups;
  canEdit: boolean;
  canEditRates: boolean;
}) {
  const router = useRouter();
  const path = usePathname();
  const [form, setForm] = useState<{ record: LiquorItemRow | null } | null>(null);
  const [ratesFor, setRatesFor] = useState<LiquorItemRow | null>(null);
  const [search, setSearch] = useState(query.q);
  const [seenQuery, setSeenQuery] = useState(query.q);
  const searchId = useId();

  // The search box follows the address when it changes from outside.
  if (seenQuery !== query.q) {
    setSeenQuery(query.q);
    setSearch(query.q);
  }

  function go(change: Partial<ItemQuery>) {
    router.replace(addressFor(path, query, change));
  }

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    go({ q: search.trim(), page: 1 });
  }

  const select = `${field.input} !w-full sm:!w-auto sm:min-w-[150px]`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 max-w-[60ch] text-[0.8rem] text-muted">{text.hint}</p>
        {canEdit ? (
          <button type="button" className={button.primary} onClick={() => setForm({ record: null })}>
            {text.addItem}
          </button>
        ) : null}
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 sm:flex sm:flex-wrap sm:items-center">
        <form onSubmit={onSearch} className="flex w-full gap-2 sm:w-auto" role="search">
          <label htmlFor={searchId} className="sr-only">
            {text.search}
          </label>
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={text.search}
            className={`${field.input} !w-full sm:!w-[220px]`}
          />
        </form>
        <select aria-label={text.colCategory} className={select} value={query.category} onChange={(e) => go({ category: e.target.value, page: 1 })}>
          <option value="">{text.allCategories}</option>
          {lookups.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select aria-label={text.type} className={select} value={query.type} onChange={(e) => go({ type: e.target.value, page: 1 })}>
          <option value="">{text.allTypes}</option>
          {lookups.types.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select aria-label={text.volume} className={select} value={query.volume ?? ""} onChange={(e) => go({ volume: e.target.value ? Number(e.target.value) : null, page: 1 })}>
          <option value="">{text.allSizes}</option>
          {VOLUMES.map((v) => (
            <option key={v} value={v}>{`${v} ml`}</option>
          ))}
        </select>
        <select aria-label={text.pegSale} className={select} value={query.peg ?? ""} onChange={(e) => go({ peg: e.target.value === "yes" || e.target.value === "no" ? e.target.value : null, page: 1 })}>
          <option value="">{text.pegAll}</option>
          <option value="yes">{text.pegYes}</option>
          <option value="no">{text.pegNo}</option>
        </select>
        <select aria-label={text.status} className={select} value={query.status} onChange={(e) => go({ status: e.target.value === "inactive" || e.target.value === "all" ? e.target.value : "active", page: 1 })}>
          <option value="active">{text.statusActive}</option>
          <option value="inactive">{text.statusInactive}</option>
          <option value="all">{text.statusAll}</option>
        </select>
        <label className="flex items-center gap-1.5 text-[0.8rem] text-muted">
          {text.ratesAsOn}
          <input
            type="date"
            value={query.asOn}
            onChange={(event) => event.target.value && go({ asOn: event.target.value, page: 1 })}
            className={`${field.input} !w-full sm:!w-[150px]`}
          />
        </label>
      </div>

      <DataList
        rows={page.rows}
        emptyTitle={text.emptyTitle}
        emptyHint={text.emptyHint}
        actionsLabel={text.actions}
        columns={[
          { label: text.colItem, cell: (r) => <ItemName item={r} /> },
          { label: text.colCategory, cell: (r) => r.categoryName },
          { label: text.colBottlesCase, cell: (r) => <span className="tabular-nums">{r.bottlesPerCase}</span> },
          {
            label: text.colRate,
            cell: (r) => {
              const f = r.rate ? rateFigures(r.rate.caseRate, r.rate.cessAmount, r.bottlesPerCase, r.volumeMl) : null;
              return f ? <span className="font-semibold tabular-nums">{formatPaise(f.ratePerBottle)}</span> : <span className="text-muted">{text.noRate}</span>;
            },
          },
          { label: text.colCess, cell: (r) => <span className="tabular-nums">{r.rate ? amount(r.rate.cessAmount) : "-"}</span> },
          {
            label: text.colCost,
            cell: (r) => {
              const f = r.rate ? rateFigures(r.rate.caseRate, r.rate.cessAmount, r.bottlesPerCase, r.volumeMl) : null;
              return <span className="font-semibold tabular-nums">{f ? formatPaise(f.costPerBottle) : "-"}</span>;
            },
          },
          {
            label: text.colCostPeg,
            cell: (r) => {
              const f = r.rate && r.pegSaleAllowed ? rateFigures(r.rate.caseRate, r.rate.cessAmount, r.bottlesPerCase, r.volumeMl) : null;
              return f ? <span className="font-semibold tabular-nums">{formatPaise(f.costPerPeg)}</span> : <span className="text-muted">-</span>;
            },
          },
          {
            label: text.colPeg,
            cell: (r) => (
              <span className={`${badge.base} ${r.pegSaleAllowed ? badge.ok : badge.off}`}>
                {r.pegSaleAllowed ? text.yes : text.no}
              </span>
            ),
          },
          {
            label: text.colStatus,
            cell: (r) => (
              <span className={`${badge.base} ${r.status === "active" ? badge.ok : badge.off}`}>
                {r.status === "active" ? text.statusActive : text.statusInactive}
              </span>
            ),
          },
        ]}
        actions={(r) => (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={`${button.secondary} ${button.small}`} onClick={() => setRatesFor(r)}>
              {text.rates}
            </button>
            {canEdit ? (
              <button type="button" className={`${button.secondary} ${button.small}`} onClick={() => setForm({ record: r })}>
                {text.edit}
              </button>
            ) : null}
          </div>
        )}
      />
      <Pager total={page.total} page={query.page} size={query.size} onChange={(next) => go(next)} />
      <p className="mt-4 rounded-xl bg-accent-soft px-3 py-2.5 text-[0.84rem] text-link">{text.note}</p>

      {form ? (
        <ItemForm
          key={form.record?.id ?? "new"}
          record={form.record}
          lookups={lookups}
          asOn={query.asOn}
          onClose={() => setForm(null)}
        />
      ) : null}
      {ratesFor ? (
        <RatesDialog
          key={ratesFor.id}
          item={ratesFor}
          canEditRates={canEditRates}
          asOn={query.asOn}
          onClose={() => setRatesFor(null)}
        />
      ) : null}
    </div>
  );
}
