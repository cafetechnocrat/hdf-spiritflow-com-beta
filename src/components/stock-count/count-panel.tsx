"use client";

import { useEffect, useId, useState } from "react";
import type { KeyboardEvent } from "react";
import { ErrorLine, Modal } from "@/components/ui/admin-parts";
import { button, field } from "@/components/ui/styles";
import { formatAmountText, formatDate } from "@/lib/format/money";
import { itemSubline, itemTitle } from "@/lib/liquor/calc";
import {
  deleteCount,
  fetchValues,
  postClosing,
  previewPost,
  saveCount,
  saveLine,
  type PreviewResult,
} from "@/lib/stock-count/actions";
import {
  isBottle,
  isCounted,
  isPeg,
  needsPegs,
  type CountEntry,
  type CountHeader,
  type CountItem,
  type CountPoint,
  type CountRights,
  type CountStatus,
  type ValueLine,
} from "@/lib/stock-count/types";

// All visible text sits here so it can be translated later.
const text = {
  stockPoint: "Stock point",
  date: "Stock Date",
  dateHint: "Starts on the transaction date in the top bar.",
  countedBy: "Counted By",
  countedByHint: "Starts as the signed in user. You can change it.",
  counted: (done: number, total: number) => `${done} of ${total} items counted`,
  blank: (n: number) => `${n} blank`,
  search: "Search Name Or Code",
  all: "All",
  blankChip: "Blank",
  countedChip: "Counted",
  bottles: "Bottles",
  pegs: "Pegs",
  bottlesOnly: "Bottles only",
  bottleSaleOnly: "Bottle sale only",
  noItems: "No items match.",
  noBlank: "No blank items. Every item has a value.",
  noPoints: "No Liquor Stock Points",
  noPointsHint: "Add an active Liquor stock point on the Stock Points screen.",
  draft: "Draft",
  complete: "Complete",
  allFilled: "all items filled",
  saving: "Saving...",
  savedAuto: "Entries save as you type",
  save: "Save",
  saved: "Saved",
  saveBusy: "Saving...",
  notCounted: (n: number) => (n === 1 ? "1 item not counted" : `${n} items not counted`),
  pdf: "PDF",
  excel: "Excel",
  post: "Post To Closing Stock",
  posted: "Posted",
  postedNote: "Posted to the accounts. It can no longer be changed or deleted.",
  remove: "Delete Count",
  removeTitle: "Delete This Count?",
  removeBody: (point: string, date: string) =>
    `The count of ${point} for ${date} will be deleted, with everything entered in it. The audit log keeps a record. This cannot be undone.`,
  removing: "Deleting...",
  hintNoPost:
    "Post To Closing Stock needs the Post right (Chief Accountant, Accountant or System Admin).",
  hintNeedAll: "Post To Closing Stock needs a saved, Complete count for every stock point on this date.",
  note: "Enter at least 0 for every item, to show every item was handled. Entries save as you type. Press Save at the end: if any item is blank the Save button shows how many are left; if none are blank it shows Saved. PDF and Excel open once a count is Complete. This screen shows counts only.",
  valueTitle: "Stock Value",
  valueSub: (date: string) => `As on ${date}, from the saved counts, at cost`,
  valueDraft: "Draft, not saved yet",
  valueNone: "No count yet",
  valueTotal: "Total",
  valueSaved: (done: number, total: number) => `${done} of ${total} stock points saved`,
  postTitle: "Post To Closing Stock",
  postSub: (date: string) =>
    `Closing stock for ${date}, from the saved counts of all stock points.`,
  postTotal: "Total Closing Stock At Cost",
  postBasis:
    "Valued at the rates in force on that date, cess included. Only people who can post see this figure.",
  postExisting: (date: string, value: string) =>
    `Closing stock is already entered for ${date} (₹${value}). Posting again replaces it, and the books are adjusted. A reason is needed.`,
  postNeedAll: (done: number, total: number) =>
    `Only ${done} of ${total} stock points have a saved, Complete count for this date. Save the rest first.`,
  postUnpriced: (n: number) =>
    `${n} counted items have no rate on this date. Add their rates on the Liquor Items screen first.`,
  reason: "Reason",
  reasonPlaceholder: "For example Recount of the Liquor Store",
  loading: "Loading...",
  cancel: "Cancel",
  close: "Close",
  postNow: "Post Closing Stock",
  posting: "Posting...",
  postedToast: (value: string) => `Closing stock posted: ₹${value}.`,
} as const;

// Saves entries one at a time, in the order they were left, and remembers what was
// last saved for each item so an unchanged box is not saved again. Kept outside the
// component so the screen can pass it around without touching refs.
function createSaver(initial: Record<string, string>) {
  let chain: Promise<void> = Promise.resolve();
  const saved = new Map<string, string>(Object.entries(initial));
  return {
    isSaved: (id: string, key: string) => (saved.get(id) ?? "|") === key,
    mark: (id: string, key: string) => {
      saved.set(id, key);
    },
    run: (task: () => Promise<void>) => {
      chain = chain.then(task).catch(() => undefined);
      return chain;
    },
    idle: () => chain,
  };
}

type BtnState = { kind: "idle" } | { kind: "short"; missing: number } | { kind: "ok" };

function PostDialog({
  date,
  onClose,
  onPosted,
}: {
  date: string;
  onClose: () => void;
  onPosted: (total: string) => void;
}) {
  const [loaded, setLoaded] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const reasonId = useId();

  useEffect(() => {
    let live = true;
    previewPost(date).then((result) => {
      if (live) setLoaded(result);
    });
    return () => {
      live = false;
    };
  }, [date]);

  const preview = loaded?.preview ?? null;
  const incomplete = preview !== null && preview.pointsComplete < preview.pointsTotal;
  const unpriced = preview !== null && preview.unpricedLines > 0;
  const needsReason = preview?.hasExisting ?? false;
  const canPost =
    preview !== null && !incomplete && !unpriced && (!needsReason || reason.trim() !== "");

  async function onPost() {
    setBusy(true);
    setError(null);
    const result = await postClosing(date, reason);
    setBusy(false);
    if (result.error || !result.total) {
      setError(result.error);
    } else {
      onPosted(result.total);
    }
  }

  return (
    <Modal title={text.postTitle} subtitle={text.postSub(formatDate(date))} onClose={onClose}>
      {loaded === null ? (
        <p className="mb-3 text-[0.88rem] text-muted">{text.loading}</p>
      ) : loaded.error || !preview ? (
        <ErrorLine message={loaded.error} />
      ) : (
        <>
          <div className="mb-3 rounded-2xl bg-track px-4 py-3">
            <div className="text-[0.74rem] font-semibold uppercase tracking-[0.05em] text-muted">
              {text.postTotal}
            </div>
            <div className="mt-0.5 text-[1.35rem] font-semibold tabular-nums">
              <span className="mr-0.5 text-[0.95rem] font-medium text-muted">{"₹"}</span>
              {formatAmountText(preview.total)}
            </div>
            <div className="mt-0.5 text-[0.78rem] text-muted">{text.postBasis}</div>
          </div>
          {incomplete ? (
            <p role="alert" className="mb-3 rounded-[10px] bg-warn-bg px-3 py-2.5 text-[0.85rem] text-warn">
              {text.postNeedAll(preview.pointsComplete, preview.pointsTotal)}
            </p>
          ) : null}
          {unpriced ? (
            <p role="alert" className="mb-3 rounded-[10px] bg-warn-bg px-3 py-2.5 text-[0.85rem] text-warn">
              {text.postUnpriced(preview.unpricedLines)}
            </p>
          ) : null}
          {needsReason && preview.existingValue ? (
            <>
              <p className="mb-3 rounded-xl bg-accent-soft px-3 py-2.5 text-[0.84rem] text-link">
                {text.postExisting(formatDate(date), formatAmountText(preview.existingValue))}
              </p>
              <div className="mb-3.5">
                <label htmlFor={reasonId} className={field.label}>
                  {text.reason} <span className="text-error">*</span>
                </label>
                <input
                  id={reasonId}
                  type="text"
                  autoComplete="off"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={text.reasonPlaceholder}
                  className={field.input}
                />
              </div>
            </>
          ) : null}
        </>
      )}
      <ErrorLine message={error} />
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} disabled={busy} className={button.secondary}>
          {text.cancel}
        </button>
        <button
          type="button"
          onClick={onPost}
          disabled={busy || !canPost}
          className={button.primary}
        >
          {busy ? text.posting : text.postNow}
        </button>
      </div>
    </Modal>
  );
}

export function CountPanel({
  points,
  items,
  pointId,
  date,
  header,
  initialEntries,
  rights,
  userName,
  onSelect,
  onDeleted,
}: {
  points: CountPoint[];
  items: CountItem[];
  pointId: string;
  date: string;
  header: CountHeader | null;
  initialEntries: Record<string, CountEntry>;
  rights: CountRights;
  userName: string;
  onSelect: (pointId: string, date: string) => void;
  onDeleted: () => void;
}) {
  const point = points.find((p) => p.id === pointId) ?? points[0];
  const [entries, setEntries] = useState<Record<string, CountEntry>>(initialEntries);
  const [status, setStatus] = useState<CountStatus>(header?.status ?? "draft");
  const [countedBy, setCountedBy] = useState(header?.countedBy || userName);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [btn, setBtn] = useState<BtnState>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [auto, setAuto] = useState<"idle" | "saving">("idle");
  const [lines, setLines] = useState<ValueLine[]>([]);
  const [valueKey, setValueKey] = useState(0);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(header?.posted ?? false);
  const [removing, setRemoving] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dateId = useId();
  const byId = useId();

  const [saver] = useState(() =>
    createSaver(
      Object.fromEntries(Object.entries(initialEntries).map(([k, e]) => [k, `${e.b}|${e.p}`])),
    ),
  );

  // The value panel. Only for a person with the View Stock Value right.
  useEffect(() => {
    if (!rights.viewValue) return;
    let live = true;
    fetchValues(date).then((loaded) => {
      if (live) setLines(loaded);
    });
    return () => {
      live = false;
    };
  }, [date, valueKey, rights.viewValue]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!point) return null;

  const counted = (item: CountItem) => isCounted(point, item, entries[item.id]);
  const done = items.filter(counted).length;
  const blank = items.length - done;
  const categories = [...new Set(items.map((i) => i.categoryName))];

  function visible(item: CountItem): boolean {
    if (filter === "blank" && counted(item)) return false;
    if (filter === "done" && !counted(item)) return false;
    if (filter.startsWith("cat:") && item.categoryName !== filter.slice(4)) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        item.stockName.toLowerCase().includes(q) ||
        item.itemName.toLowerCase().includes(q) ||
        item.itemCode.toLowerCase().includes(q)
      );
    }
    return true;
  }

  function touchedAfterSave() {
    // Changing a saved count returns it to Draft until Save is pressed again.
    setBtn({ kind: "idle" });
    setSaveNote(null);
    if (status === "complete") {
      setStatus("draft");
      setValueKey((k) => k + 1);
    }
  }

  function onChange(item: CountItem, which: "b" | "p", raw: string) {
    let v = raw.replace(",", ".").replace(/\s/g, "");
    v = which === "b" ? v.replace(/[^\d]/g, "") : v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
    const current = entries[item.id] ?? { b: "", p: "" };
    setEntries({ ...entries, [item.id]: { ...current, [which]: v } });
    touchedAfterSave();
  }

  // Saves one item when its box is left.
  function persist(item: CountItem) {
    const entry = entries[item.id] ?? { b: "", p: "" };
    const key = `${entry.b}|${entry.p}`;
    if (saver.isSaved(item.id, key)) return;
    saver.mark(item.id, key);
    const by = countedBy;
    saver.run(async () => {
      setAuto("saving");
      const result = await saveLine({
        pointId: point.id,
        date,
        itemId: item.id,
        bottles: entry.b,
        pegs: entry.p,
        countedBy: by,
      });
      setAuto("idle");
      if (result.error) setSaveNote(result.error);
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    const all = [...document.querySelectorAll<HTMLInputElement>("#count-list input[data-f]")];
    const index = all.indexOf(event.currentTarget);
    event.preventDefault();
    const next = all[index + 1];
    if (next) {
      next.focus();
      next.select();
    } else {
      event.currentTarget.blur();
    }
  }

  async function onSave() {
    setBusy(true);
    setSaveNote(null);
    await saver.idle();
    const result = await saveCount({ pointId: point.id, date, countedBy });
    setBusy(false);
    if (result.error !== null) {
      setSaveNote(result.error);
      return;
    }
    if (result.missing > 0) {
      setBtn({ kind: "short", missing: result.missing });
      setStatus("draft");
      setFilter("blank");
      setQuery("");
      setTimeout(() => {
        document
          .querySelector("#count-list input[data-blank='true']")
          ?.scrollIntoView({ block: "center" });
      }, 50);
    } else {
      setBtn({ kind: "ok" });
      setStatus("complete");
    }
    setValueKey((k) => k + 1);
  }

  const complete = status === "complete";
  const locked = posted;
  const canRemove = rights.remove && !posted && (header !== null || Object.keys(entries).length > 0);

  async function onRemove() {
    setRemoveBusy(true);
    setRemoveError(null);
    await saver.idle();
    const result = await deleteCount({ pointId: point.id, date });
    setRemoveBusy(false);
    if (result.error) setRemoveError(result.error);
    else onDeleted();
  }
  const allComplete = lines.length > 0 && lines.every((l) => l.status === "complete");
  const exportBase = `/stock-count/export?point=${point.id}&date=${date}`;
  const exportOn = rights.exportFiles && complete;
  const saveLabel =
    busy ? text.saveBusy : btn.kind === "short" ? text.notCounted(btn.missing) : btn.kind === "ok" && complete ? text.saved : text.save;
  const saveClass =
    btn.kind === "short"
      ? `${button.primary} !bg-warn-bg !text-warn hover:!bg-warn-bg`
      : btn.kind === "ok" && complete
        ? `${button.primary} !bg-success-bg !text-success hover:!bg-success-bg`
        : button.primary;
  const total = lines.reduce(
    (sum, l) => (l.status === "complete" && l.value ? sum + Math.round(Number(l.value) * 100) : sum),
    0,
  );

  const groups = categories
    .map((category) => ({ category, rows: items.filter((i) => i.categoryName === category && visible(i)) }))
    .filter((g) => g.rows.length > 0);

  const chipClass = (on: boolean) =>
    `inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[0.8rem] ${
      on ? "bg-accent-soft font-semibold text-link" : "bg-track font-medium text-muted hover:text-text"
    }`;

  return (
    <div>
      <div
        role="group"
        aria-label={text.stockPoint}
        className="mb-3 inline-flex max-w-full flex-wrap gap-0.5 rounded-[10px] bg-track p-0.5"
      >
        {points.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === point.id}
            onClick={() => onSelect(p.id, date)}
            className={`min-h-10 rounded-lg px-4 text-[0.88rem] ${
              p.id === point.id
                ? "bg-surface font-semibold text-text shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                : "font-medium text-muted hover:text-text"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="grid gap-x-4 sm:grid-cols-2">
          <div className="mb-3">
            <label htmlFor={dateId} className={field.label}>
              {text.date} <span className="text-error">*</span>
            </label>
            <input
              id={dateId}
              type="date"
              value={date}
              onChange={(event) => event.target.value && onSelect(point.id, event.target.value)}
              className={field.input}
            />
            <p className={field.hint}>{text.dateHint}</p>
          </div>
          <div className="mb-3">
            <label htmlFor={byId} className={field.label}>
              {text.countedBy}
            </label>
            <input
              id={byId}
              type="text"
              autoComplete="name"
              value={countedBy}
              maxLength={100}
              onChange={(event) => setCountedBy(event.target.value)}
              className={field.input}
            />
            <p className={field.hint}>{text.countedByHint}</p>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-track">
          <span
            className="block h-full rounded-full bg-success transition-[width]"
            style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[0.82rem] text-muted">
          <span>{text.counted(done, items.length)}</span>
          <span>{text.blank(blank)}</span>
        </div>
      </div>

      {rights.viewValue ? (
        <div className="mt-3 rounded-2xl bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <h2 className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-[1rem] font-semibold">
            {text.valueTitle}
            <small className="text-[0.76rem] font-medium text-muted">
              {text.valueSub(formatDate(date))}
            </small>
          </h2>
          {lines.map((l) => (
            <div
              key={l.pointId}
              className="flex justify-between gap-3 border-b border-divider py-2 text-[0.9rem] tabular-nums"
            >
              <div>
                {l.pointName}
                <span className="block text-[0.74rem] text-muted">
                  {l.status === "complete" ? text.complete : l.status === "draft" ? text.valueDraft : text.valueNone}
                </span>
              </div>
              <div>{l.status === "complete" && l.value ? `₹${formatAmountText(l.value)}` : "-"}</div>
            </div>
          ))}
          <div className="flex justify-between gap-3 pt-2 text-[1rem] font-semibold tabular-nums">
            <div>
              {text.valueTotal}
              <span className="block text-[0.74rem] font-normal text-muted">
                {text.valueSaved(lines.filter((l) => l.status === "complete").length, lines.length)}
              </span>
            </div>
            <div>{`₹${formatAmountText((total / 100).toFixed(2))}`}</div>
          </div>
        </div>
      ) : null}

      <div className="mb-2.5 mt-3.5 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="count-search">
          {text.search}
        </label>
        <input
          id="count-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={text.search}
          className={`${field.input} !w-[240px]`}
        />
        <div className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={filter === "all"} className={chipClass(filter === "all")} onClick={() => setFilter("all")}>
            {text.all} <span className="tabular-nums opacity-80">{items.length}</span>
          </button>
          <button type="button" aria-pressed={filter === "blank"} className={chipClass(filter === "blank")} onClick={() => setFilter("blank")}>
            {text.blankChip} <span className="tabular-nums opacity-80">{blank}</span>
          </button>
          <button type="button" aria-pressed={filter === "done"} className={chipClass(filter === "done")} onClick={() => setFilter("done")}>
            {text.countedChip} <span className="tabular-nums opacity-80">{done}</span>
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              aria-pressed={filter === `cat:${category}`}
              className={chipClass(filter === `cat:${category}`)}
              onClick={() => setFilter(`cat:${category}`)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div id="count-list">
        {groups.length === 0 ? (
          <div className="rounded-2xl bg-surface px-4 py-7 text-center text-[0.9rem] text-muted shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            {filter === "blank" ? text.noBlank : text.noItems}
          </div>
        ) : (
          groups.map(({ category, rows }) => {
            const all = items.filter((i) => i.categoryName === category);
            const finished = all.filter(counted).length;
            return (
              <section key={category}>
                <h3 className="mb-2 ml-0.5 mt-4 flex items-baseline justify-between text-[0.78rem] font-semibold uppercase tracking-[0.05em] text-muted">
                  {category}
                  <span className="tabular-nums">{`${finished}/${all.length}`}</span>
                </h3>
                <div className="overflow-hidden rounded-2xl bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                  {rows.map((item) => {
                    const entry = entries[item.id] ?? { b: "", p: "" };
                    const hasPegs = needsPegs(point, item);
                    const ok = isCounted(point, item, entry);
                    const bMiss = entry.b === "" || !isBottle(entry.b);
                    const pMiss = entry.p === "" || !isPeg(entry.p);
                    const box = `${field.input} !h-11 !w-[92px] text-center font-semibold tabular-nums`;
                    return (
                      <div
                        key={item.id}
                        className={`grid grid-cols-[1fr_auto_auto] items-center gap-x-3.5 gap-y-2 border-b border-divider px-3.5 py-2.5 last:border-b-0 ${
                          ok ? "bg-success-bg/40" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-[0.92rem] font-semibold">
                            {itemTitle(item.stockName, item.volumeMl)}
                          </div>
                          <div className="font-mono text-[0.72rem] leading-snug text-link">
                            {itemSubline(item.itemCode, item.itemName, item.stockName)}
                          </div>
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[0.68rem] font-semibold uppercase tracking-[0.05em] text-muted">
                            {text.bottles}
                          </label>
                          <input
                            data-f="b"
                            data-blank={bMiss ? "true" : "false"}
                            inputMode="numeric"
                            autoComplete="off"
                            disabled={!rights.take || locked}
                            value={entry.b}
                            onChange={(event) => onChange(item, "b", event.target.value)}
                            onBlur={() => persist(item)}
                            onKeyDown={onKeyDown}
                            onFocus={(event) => event.currentTarget.select()}
                            className={`${box} ${entry.b === "" ? "!border-[#e7b8b8] !bg-[#fff7f7]" : ""}`}
                          />
                        </div>
                        {hasPegs ? (
                          <div>
                            <label className="mb-0.5 block text-[0.68rem] font-semibold uppercase tracking-[0.05em] text-muted">
                              {text.pegs}
                            </label>
                            <input
                              data-f="p"
                              data-blank={pMiss ? "true" : "false"}
                              inputMode="decimal"
                              autoComplete="off"
                              disabled={!rights.take || locked}
                              value={entry.p}
                              onChange={(event) => onChange(item, "p", event.target.value)}
                              onBlur={() => persist(item)}
                              onKeyDown={onKeyDown}
                              onFocus={(event) => event.currentTarget.select()}
                              className={`${box} ${entry.p === "" ? "!border-[#e7b8b8] !bg-[#fff7f7]" : ""}`}
                            />
                          </div>
                        ) : (
                          <div className="w-[92px] pt-4 text-center text-[0.8rem] text-muted">
                            {point.pegAllowed ? text.bottleSaleOnly : text.bottlesOnly}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-divider bg-surface px-4 py-3 shadow-[0_-4px_18px_rgba(0,0,0,0.05)]">
        <div className="text-[0.84rem]" role="status">
          <span
            className={`mr-1.5 inline-flex rounded-full px-2.5 py-0.5 text-[0.74rem] font-semibold ${
              complete ? "bg-success-bg text-success" : "bg-warn-bg text-warn"
            }`}
          >
            {posted ? text.posted : complete ? text.complete : text.draft}
          </span>
          <b className="font-semibold">{point.name}</b>
          {` · ${blank ? text.blank(blank) : text.allFilled}`}
          <br />
          <span className="text-muted">{auto === "saving" ? text.saving : text.savedAuto}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {exportOn ? (
            <>
              <a href={`${exportBase}&format=xlsx`} className={button.secondary} download>
                {text.excel}
              </a>
              <a href={`${exportBase}&format=pdf`} className={button.secondary} download>
                {text.pdf}
              </a>
            </>
          ) : (
            <>
              <button type="button" disabled className={button.secondary}>
                {text.excel}
              </button>
              <button type="button" disabled className={button.secondary}>
                {text.pdf}
              </button>
            </>
          )}
          {rights.remove ? (
            <button
              type="button"
              className={button.danger}
              disabled={!canRemove}
              onClick={() => setRemoving(true)}
            >
              {text.remove}
            </button>
          ) : null}
          <button
            type="button"
            className={button.secondary}
            disabled={!rights.post || !allComplete || posted}
            onClick={() => setPosting(true)}
          >
            {text.post}
          </button>
          <button
            type="button"
            className={saveClass}
            disabled={!rights.save || busy || locked}
            onClick={onSave}
          >
            {saveLabel}
          </button>
        </div>
      </div>
      <p className="mt-2 text-right text-[0.78rem] text-muted">
        {posted
          ? text.postedNote
          : !rights.post
            ? text.hintNoPost
            : allComplete
              ? ""
              : text.hintNeedAll}
      </p>
      {saveNote ? (
        <p role="alert" className="mt-2 rounded-[10px] bg-error-bg px-3 py-2.5 text-[0.85rem] text-error">
          {saveNote}
        </p>
      ) : null}
      <p className="mt-3.5 rounded-xl bg-accent-soft px-3 py-2.5 text-[0.84rem] text-link">{text.note}</p>

      {posting ? (
        <PostDialog
          date={date}
          onClose={() => setPosting(false)}
          onPosted={(value) => {
            setPosting(false);
            setPosted(true);
            setToast(text.postedToast(formatAmountText(value)));
            setValueKey((k) => k + 1);
          }}
        />
      ) : null}
      {removing ? (
        <Modal
          title={text.removeTitle}
          subtitle={text.removeBody(point.name, formatDate(date))}
          onClose={() => setRemoving(false)}
        >
          <ErrorLine message={removeError} />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setRemoving(false)} disabled={removeBusy} className={button.secondary}>
              {text.cancel}
            </button>
            <button type="button" onClick={onRemove} disabled={removeBusy} className={button.danger}>
              {removeBusy ? text.removing : text.remove}
            </button>
          </div>
        </Modal>
      ) : null}
      {toast ? (
        <div
          role="status"
          className="fixed bottom-20 right-4 z-50 rounded-xl bg-[#0F1B3D] px-3.5 py-2.5 text-[0.84rem] text-white"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
