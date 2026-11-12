"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { DataList, ErrorLine } from "@/components/ui/admin-parts";
import { button, field } from "@/components/ui/styles";
import { previewClosingStock, saveClosingStock } from "@/lib/closing-stock/actions";
import type { ClosingStockData, HistoryRow, PreviewResult } from "@/lib/closing-stock/types";
import { formatPaise, parseSignedPaise } from "@/lib/format/money";

// All visible text sits here so it can be translated later.
const text = {
  stockAccount: "Stock Account",
  bookNow: "Book Stock Now",
  bookNowSub: (date: string) => `Balance of the stock ledger on ${date}`,
  lastClosing: "Last Closing Stock",
  nextToEnter: (date: string) => `Next to enter: ${date}`,
  none: "None yet",
  enterTitle: "Enter Closing Stock",
  editTitle: "Change Closing Stock",
  date: "Date",
  dateHint: "Starts on the transaction date in the top bar.",
  value: "Closing Stock Value At Cost",
  valueHint: "At purchase price, never selling price.",
  note: "Note",
  notePlaceholder: "Optional",
  reason: "Reason For The Change",
  reasonPlaceholder: "For example Count corrected",
  post: "Post Closing Stock",
  saveChange: "Save Change",
  posting: "Saving...",
  cancel: "Cancel",
  enterValue: "Enter the closing stock value.",
  checking: "Checking...",
  previewFailed: "The check could not be done. Nothing was changed. Try again.",
  noChange: (book: string) => `No change from the book stock of ${book}.`,
  noChangeLine: "The value is saved. No journal is posted.",
  wentDown: (amount: string) => `Stock went down by ${amount}. Cost goes up.`,
  wentUp: (amount: string) => `Stock went up by ${amount}. Cost goes down.`,
  bookToClosing: (book: string, closing: string) => `Book stock ${book} → closing stock ${closing}`,
  journalDown: (adjust: string, stock: string, amount: string) =>
    `Journal: Dr ${adjust} ${amount}, Cr ${stock} ${amount}`,
  journalUp: (adjust: string, stock: string, amount: string) =>
    `Journal: Dr ${stock} ${amount}, Cr ${adjust} ${amount}`,
  alreadyTitle: "Already Entered",
  alreadyHint: "This date already has a closing stock. Use Change on the history line. A change needs a reason.",
  alreadyNoRight:
    "This date already has a closing stock. You do not have the right to change a posted voucher, so ask the Chief Accountant.",
  laterTitle: "Later Days Change",
  laterHint: (date: string, from: string, to: string) =>
    `The journal of ${date} will move from ${from} to ${to} so the books stay right.`,
  laterConfirm: "Save And Update Later Days",
  history: "History",
  colDate: "Date",
  colClosing: "Closing Stock",
  colChange: "Change",
  colJournal: "Journal",
  actions: "Actions",
  change: "Change",
  viewDay: "View Day Book",
  noChangeShort: "No change",
  noJournal: "No journal needed",
  historyEmptyTitle: "No Closing Stock Yet",
  historyEmptyHint: "Enter the first closing stock above.",
  noAccountTitle: "No Stock Account Yet",
  noAccountHint: "Ask the System Admin to set up the stock account.",
  openingNote:
    "Opening stock is not entered here. The Chief Accountant enters it once as a Journal: Dr the stock ledger, Cr Capital, dated 01/04/2026. When the Bar POS and stock module go live, this screen is switched off.",
  readOnly: "You can see closing stock but not enter it.",
  saved: "Closing stock saved.",
  saveFailed: "Something went wrong. Nothing was changed. Try again.",
} as const;

const displayDate = (date: string) => date.split("-").reverse().join("/");
const rupees = (paise: bigint) => `₹${formatPaise(paise < BigInt(0) ? -paise : paise)}`;
const addOneDay = (date: string) => {
  const moment = new Date(`${date}T00:00:00Z`);
  moment.setUTCDate(moment.getUTCDate() + 1);
  return moment.toISOString().slice(0, 10);
};

type Ready = Extract<PreviewResult, { ok: true }>;

export function ClosingStockScreen({ data }: { data: ClosingStockData }) {
  const router = useRouter();
  const baseId = useId();
  const account = data.accounts.find((a) => a.id === data.selectedId) ?? data.accounts[0];
  const [date, setDate] = useState(data.startDate);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<number | null>(null);
  const token = useRef(0);
  const noticeTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    },
    [],
  );

  if (!account) {
    return (
      <div className="rounded-2xl bg-surface px-4 py-9 text-center text-[0.9rem] text-muted shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <strong className="mb-0.5 block text-[1rem] text-text">{text.noAccountTitle}</strong>
        {text.noAccountHint}
      </div>
    );
  }

  // Ask the database what the value would do, a moment after typing stops.
  function schedule(nextDate: string, nextValue: string) {
    if (timer.current) window.clearTimeout(timer.current);
    token.current += 1;
    const mine = token.current;
    setConfirming(false);
    if (nextValue.trim() === "") {
      setPreview(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    timer.current = window.setTimeout(async () => {
      // Whatever happens, the screen must stop waiting and say what went wrong.
      const result: PreviewResult = await previewClosingStock({
        accountId: account.id,
        date: nextDate,
        value: nextValue,
      }).catch(() => ({ ok: false as const, error: text.previewFailed }));
      if (mine !== token.current) return;
      setPreview(result);
      setChecking(false);
    }, 350);
  }

  function onDate(next: string) {
    setDate(next);
    schedule(next, value);
  }

  function onValue(next: string) {
    setValue(next);
    schedule(date, next);
  }

  function startChange(row: HistoryRow) {
    setDate(row.date);
    setValue(row.value);
    setNote(row.note ?? "");
    setReason("");
    setError(null);
    schedule(row.date, row.value);
    document.getElementById(`${baseId}-form`)?.scrollIntoView({ behavior: "smooth" });
  }

  const ready: Ready | null = preview && preview.ok ? preview : null;
  const existing = ready?.existing ?? false;
  const blockedExisting = existing && !data.canChange;
  const needsReason = existing && data.canChange;

  function reset() {
    setValue("");
    setNote("");
    setReason("");
    setPreview(null);
    setConfirming(false);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveClosingStock({
        accountId: account.id,
        date,
        value,
        note,
        reason,
      }).catch(() => ({ error: text.saveFailed }));
      if (result.error) {
        setError(result.error);
        return;
      }
      reset();
      setNotice(true);
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
      noticeTimer.current = window.setTimeout(() => setNotice(false), 1800);
      router.refresh();
    });
  }

  function post() {
    if (!ready) return;
    if (ready.later.length > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    save();
  }

  const bookBefore = ready ? parseSignedPaise(ready.bookBefore) : BigInt(0);
  const diff = ready ? parseSignedPaise(ready.diff) : BigInt(0);
  const entered = bookBefore + diff;
  const tone =
    diff === BigInt(0)
      ? "bg-track text-muted"
      : diff < BigInt(0)
        ? "bg-warn-bg text-warn"
        : "bg-success-bg text-success";

  const lastDate = data.history[0]?.date ?? null;
  const bookNow = parseSignedPaise(data.bookNow);

  const changeText = (row: HistoryRow) => {
    const paise = parseSignedPaise(row.diff);
    if (paise === BigInt(0)) {
      return <span className="text-muted">{row.voucherId ? "" : text.noChangeShort}</span>;
    }
    return (
      <span className={`font-semibold ${paise < BigInt(0) ? "text-warn" : "text-success"}`}>
        {paise < BigInt(0) ? "− " : "+ "}
        {formatPaise(paise < BigInt(0) ? -paise : paise)}
      </span>
    );
  };

  const rows = data.history.map((row) => ({ ...row, id: row.date }));

  return (
    <div>
      <div className="mb-3.5 grid gap-3.5 rounded-2xl bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] sm:grid-cols-3">
        <div>
          <div className="text-[0.74rem] font-semibold uppercase tracking-[0.05em] text-muted">
            {text.stockAccount}
          </div>
          {data.accounts.length > 1 ? (
            <select
              value={account.id}
              onChange={(event) => router.replace(`/closing-stock?account=${event.target.value}`)}
              className={`${field.input} mt-1`}
              aria-label={text.stockAccount}
            >
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="mt-0.5 font-semibold">{account.name}</div>
          )}
          <div className="text-[0.78rem] text-muted">
            {account.stockLedger}, {account.adjustmentLedger}
          </div>
        </div>
        <div>
          <div className="text-[0.74rem] font-semibold uppercase tracking-[0.05em] text-muted">
            {text.bookNow}
          </div>
          <div className="mt-0.5 text-[1.35rem] font-bold tracking-[-0.02em] tabular-nums">
            <span className="mr-0.5 text-[0.95rem] font-medium text-muted">&#8377;</span>
            {bookNow < BigInt(0) ? "-" : ""}
            {formatPaise(bookNow < BigInt(0) ? -bookNow : bookNow)}
          </div>
          <div className="text-[0.78rem] text-muted">{text.bookNowSub(displayDate(data.asOn))}</div>
        </div>
        <div>
          <div className="text-[0.74rem] font-semibold uppercase tracking-[0.05em] text-muted">
            {text.lastClosing}
          </div>
          <div className="mt-0.5 font-semibold">{lastDate ? displayDate(lastDate) : text.none}</div>
          {lastDate ? (
            <div className="text-[0.78rem] text-muted">{text.nextToEnter(displayDate(addOneDay(lastDate)))}</div>
          ) : null}
        </div>
      </div>

      {data.canEdit ? (
        <section
          id={`${baseId}-form`}
          aria-labelledby={`${baseId}-title`}
          className="rounded-2xl bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
        >
          <h2 id={`${baseId}-title`} className="mb-2.5 text-base font-semibold">
            {needsReason ? text.editTitle : text.enterTitle}
          </h2>
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-3">
            <div className="mb-2">
              <label htmlFor={`${baseId}-date`} className={field.label}>
                {text.date} <span className="text-error">*</span>
              </label>
              <input
                id={`${baseId}-date`}
                type="date"
                value={date}
                onChange={(event) => onDate(event.target.value)}
                className={field.input}
              />
              <p className={field.hint}>{text.dateHint}</p>
            </div>
            <div className="mb-2">
              <label htmlFor={`${baseId}-value`} className={field.label}>
                {text.value} <span className="text-error">*</span>
              </label>
              <input
                id={`${baseId}-value`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={value}
                onChange={(event) => onValue(event.target.value)}
                placeholder="0.00"
                className={field.input}
              />
              <p className={field.hint}>{text.valueHint}</p>
            </div>
            <div className="mb-2">
              <label htmlFor={`${baseId}-note`} className={field.label}>
                {text.note}
              </label>
              <input
                id={`${baseId}-note`}
                type="text"
                autoComplete="off"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={text.notePlaceholder}
                className={field.input}
              />
            </div>
          </div>

          {needsReason ? (
            <div className="mb-2 max-w-[480px]">
              <label htmlFor={`${baseId}-reason`} className={field.label}>
                {text.reason} <span className="text-error">*</span>
              </label>
              <input
                id={`${baseId}-reason`}
                type="text"
                autoComplete="off"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={text.reasonPlaceholder}
                className={field.input}
              />
            </div>
          ) : null}

          <div role="status" aria-live="polite">
            {checking ? (
              <p className="rounded-[14px] bg-track px-3.5 py-3 text-[0.88rem] text-muted">{text.checking}</p>
            ) : preview && !preview.ok ? (
              <p className="rounded-[14px] bg-error-bg px-3.5 py-3 text-[0.88rem] text-error">{preview.error}</p>
            ) : ready ? (
              <div className={`rounded-[14px] px-3.5 py-3 text-[0.9rem] ${tone}`}>
                {diff === BigInt(0) ? (
                  <>
                    <div className="font-semibold">{text.noChange(rupees(bookBefore))}</div>
                    <div className="mt-1 text-[0.84rem]">{text.noChangeLine}</div>
                  </>
                ) : (
                  <>
                    <div className="font-semibold">
                      {diff < BigInt(0) ? text.wentDown(rupees(diff)) : text.wentUp(rupees(diff))}
                    </div>
                    <div className="mt-1 text-[0.84rem] tabular-nums">
                      {text.bookToClosing(rupees(bookBefore), rupees(entered))}
                    </div>
                    <div className="mt-1 text-[0.84rem] tabular-nums">
                      {diff < BigInt(0)
                        ? text.journalDown(account.adjustmentLedger, account.stockLedger, rupees(diff))
                        : text.journalUp(account.adjustmentLedger, account.stockLedger, rupees(diff))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="rounded-[14px] bg-track px-3.5 py-3 text-[0.88rem] text-muted">{text.enterValue}</p>
            )}
          </div>

          {blockedExisting ? (
            <p className="mt-3 rounded-xl bg-warn-bg px-3 py-2.5 text-[0.84rem] text-warn">
              <strong>{text.alreadyTitle}.</strong> {text.alreadyNoRight}
            </p>
          ) : existing && !needsReason ? null : existing ? (
            <p className="mt-3 rounded-xl bg-warn-bg px-3 py-2.5 text-[0.84rem] text-warn">
              <strong>{text.alreadyTitle}.</strong> {text.alreadyHint}
            </p>
          ) : null}

          {ready && ready.later.length > 0 ? (
            <div className="mt-3 rounded-xl bg-warn-bg px-3 py-2.5 text-[0.84rem] text-warn">
              <strong>{text.laterTitle}.</strong>
              <ul className="mt-1">
                {ready.later.map((change) => (
                  <li key={change.date} className="tabular-nums">
                    {text.laterHint(
                      displayDate(change.date),
                      rupees(parseSignedPaise(change.from)),
                      rupees(parseSignedPaise(change.to)),
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <ErrorLine message={error} />

          <div className="mt-3.5 flex flex-wrap justify-end gap-2">
            {confirming ? (
              <button type="button" className={button.secondary} onClick={() => setConfirming(false)}>
                {text.cancel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={post}
              disabled={pending || checking || !ready || blockedExisting || (needsReason && reason.trim() === "")}
              className={button.primary}
            >
              {pending ? text.posting : confirming ? text.laterConfirm : needsReason ? text.saveChange : text.post}
            </button>
          </div>
        </section>
      ) : (
        <p className="rounded-xl bg-accent-soft px-3 py-2.5 text-[0.84rem] text-link">{text.readOnly}</p>
      )}

      <h2 className="mb-2.5 mt-6 px-0.5 text-[0.74rem] font-semibold uppercase tracking-[0.05em] text-muted">
        {text.history}
      </h2>
      <DataList
        rows={rows}
        actionsLabel={text.actions}
        emptyTitle={text.historyEmptyTitle}
        emptyHint={text.historyEmptyHint}
        columns={[
          {
            label: text.colDate,
            cell: (row) => <span className="font-semibold">{displayDate(row.date)}</span>,
          },
          {
            label: text.colClosing,
            cell: (row) => (
              <span className="font-semibold tabular-nums">
                {formatPaise(parseSignedPaise(row.value))}
              </span>
            ),
          },
          { label: text.colChange, cell: (row) => changeText(row) },
          {
            label: text.colJournal,
            cell: (row) =>
              row.referenceNo ? (
                <>
                  <div className="font-semibold">{row.typeName}</div>
                  <div className="text-[0.78rem] text-muted">{row.referenceNo}</div>
                </>
              ) : (
                <span className="text-[0.78rem] text-muted">{text.noJournal}</span>
              ),
          },
        ]}
        actions={(row) => (
          <div className="flex flex-wrap justify-end gap-2">
            {row.voucherId && data.canOpenDayBook ? (
              <Link
                href={`/reports/day-book?from=${row.date}&to=${row.date}`}
                className={`${button.secondary} ${button.small}`}
              >
                {text.viewDay}
              </Link>
            ) : null}
            {data.canEdit && data.canChange ? (
              <button
                type="button"
                onClick={() => startChange(row)}
                className={`${button.secondary} ${button.small}`}
              >
                {text.change}
              </button>
            ) : null}
          </div>
        )}
      />

      <p className="mt-4 rounded-xl bg-accent-soft px-3 py-2.5 text-[0.84rem] text-link">
        {text.openingNote}
      </p>

      <div
        role="status"
        className={`pointer-events-none fixed bottom-4 right-4 z-[60] rounded-xl bg-[#0F1B3D] px-3.5 py-2 text-[0.84rem] text-white transition-opacity ${
          notice ? "opacity-100" : "opacity-0"
        }`}
      >
        {notice ? text.saved : ""}
      </div>
    </div>
  );
}
