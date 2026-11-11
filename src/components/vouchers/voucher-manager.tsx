"use client";

import { useId, useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { DataList, ErrorLine, Modal } from "@/components/ui/admin-parts";
import { badge, button, field } from "@/components/ui/styles";
import {
  formatAmountText,
  formatDate,
  formatPaise,
  parseAmountToPaise,
  sumPaise,
} from "@/lib/format/money";
import { loadVoucherEntries, saveVoucher, voidVoucher } from "@/lib/vouchers/actions";
import type {
  LedgerChoice,
  VoucherData,
  VoucherEntryRow,
  VoucherRow,
  VoucherTypeRow,
} from "@/lib/vouchers/types";

// All visible text sits here so it can be translated later.
const text = {
  newVoucher: "New Voucher",
  hint: "Posted vouchers are never deleted. Void one with a reason if it was entered wrongly.",
  truncated: "Showing the newest vouchers only. The Day Book report will cover the full history.",
  fromDate: "From Date",
  toDate: "To Date",
  allTypes: "All Types",
  typeFilter: "Voucher Type",
  statusFilter: "Status",
  statusPosted: "Posted",
  statusVoid: "Void",
  statusAll: "All",
  searchPlaceholder: "Search Narration Or Reference",
  searchLabel: "Search",
  colVoucher: "Voucher",
  colDate: "Date",
  colDetails: "Details",
  colAmount: "Amount",
  colStatus: "Status",
  view: "View",
  edit: "Edit",
  void: "Void",
  loading: "Loading...",
  debit: "Debit",
  credit: "Credit",
  to: "to",
  emptyTitle: "No Vouchers Found",
  emptyHint: "Add the first voucher, or change the filters.",
  noTypes: "No voucher types are set up yet.",
  // Form
  formTitleNew: "New Voucher",
  formTitleEdit: "Edit Voucher",
  formSub:
    "Choose the type. Each row holds the debit ledger, the credit ledger and the amount, so a voucher always balances.",
  formSubEdit:
    "The type and number stay the same. The date must stay in the same financial year. A reason is required.",
  typeLabel: "Voucher Type",
  transactionDate: "Transaction Date",
  dateHint:
    "Starts on the transaction date in the top bar. You can change it for this voucher.",
  backDated: "Back-dated",
  voucherNumber: "Voucher Number",
  numberHint: "Assigned when you save",
  amount: "Amount",
  selectLedger: "Select A Ledger",
  addLine: "Add Line",
  removeLine: "Remove Line",
  total: "Total",
  reference: "Reference",
  referencePlaceholder: "Bill or cheque number",
  narration: "Narration",
  narrationPlaceholder: "What this entry is for",
  reason: "Reason For Edit",
  reasonPlaceholder: "Why is this voucher being changed?",
  cancel: "Cancel",
  save: "Save Voucher",
  saving: "Saving...",
  // View
  viewNarration: "Narration",
  viewReference: "Reference",
  viewEditReason: "Last edit reason",
  viewVoidReason: "Voided because",
  close: "Close",
  // Void
  voidTitle: "Void Voucher?",
  voidBody:
    "will stay in the list marked Void and will no longer count in any balance. Its number is not reused. The audit log keeps a record.",
  voidReason: "Reason",
  voidReasonPlaceholder: "Why is this voucher being voided?",
  voiding: "Voiding...",
  voidAction: "Void Voucher",
} as const;

type Row = { key: number; debit: string; credit: string; amount: string };

function blankRow(key: number): Row {
  return { key, debit: "", credit: "", amount: "" };
}

function StatusBadge({ status }: { status: "posted" | "void" }) {
  return status === "posted" ? (
    <span className={`${badge.base} ${badge.ok}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {text.statusPosted}
    </span>
  ) : (
    <span className={`${badge.base} ${badge.off}`}>{text.statusVoid}</span>
  );
}

// Ledgers a side may pick from. The rule comes from the database. The ledger
// already on a row stays in the list even if it is no longer active.
function ledgerChoices(
  all: LedgerChoice[],
  allowedGroupIds: string[] | null,
  keepIds: string[],
  extra: LedgerChoice[],
): LedgerChoice[] {
  const allowed = allowedGroupIds ? new Set(allowedGroupIds) : null;
  const list = all.filter((l) => allowed === null || allowed.has(l.groupId));
  for (const id of keepIds) {
    if (id && !list.some((l) => l.id === id)) {
      const found = extra.find((l) => l.id === id);
      if (found) list.push(found);
    }
  }
  return list;
}

function VoucherForm({
  data,
  voucher,
  initialEntries,
  onClose,
}: {
  data: VoucherData;
  voucher: VoucherRow | null;
  initialEntries: VoucherEntryRow[] | null;
  onClose: () => void;
}) {
  const editing = voucher !== null;
  const [typeId, setTypeId] = useState(voucher?.voucherTypeId ?? data.types[0]?.id ?? "");
  const [date, setDate] = useState(voucher?.date ?? data.transactionDate);
  const [reference, setReference] = useState(voucher?.reference ?? "");
  const [narration, setNarration] = useState(voucher?.narration ?? "");
  const [reason, setReason] = useState("");
  const [rows, setRows] = useState<Row[]>(() =>
    initialEntries && initialEntries.length > 0
      ? initialEntries.map((entry, index) => ({
          key: index,
          debit: entry.debitLedgerId,
          credit: entry.creditLedgerId,
          amount: entry.amountText,
        }))
      : [blankRow(0)],
  );
  const [nextKey, setNextKey] = useState(initialEntries?.length ?? 1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dateId = useId();
  const referenceId = useId();
  const narrationId = useId();
  const reasonId = useId();

  const type: VoucherTypeRow | undefined = data.types.find((t) => t.id === typeId);

  // Ledgers already on the rows when editing, so inactive ones still show.
  const extraLedgers = useMemo<LedgerChoice[]>(() => {
    const found = new Map<string, LedgerChoice>();
    for (const entry of initialEntries ?? []) {
      found.set(entry.debitLedgerId, { id: entry.debitLedgerId, name: entry.debitName, groupId: "" });
      found.set(entry.creditLedgerId, { id: entry.creditLedgerId, name: entry.creditName, groupId: "" });
    }
    return [...found.values()];
  }, [initialEntries]);

  const totalPaise = sumPaise(
    rows.map((row) => parseAmountToPaise(row.amount) ?? BigInt(0)),
  );

  function changeType(nextId: string) {
    setTypeId(nextId);
    // The ledger lists differ by type, so start the rows again.
    setRows([blankRow(nextKey)]);
    setNextKey(nextKey + 1);
  }

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((current) => [...current, blankRow(nextKey)]);
    setNextKey(nextKey + 1);
  }

  function removeRow(key: number) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("voucherId", voucher?.id ?? "");
    formData.set("typeId", typeId);
    formData.set("date", date);
    formData.set("reference", reference);
    formData.set("narration", narration);
    formData.set("reason", reason);
    formData.set(
      "entries",
      JSON.stringify(rows.map((row) => ({ debit: row.debit, credit: row.credit, amount: row.amount }))),
    );
    startTransition(async () => {
      const result = await saveVoucher({ error: null }, formData);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  if (!type) {
    return (
      <Modal title={text.formTitleNew} onClose={onClose} wide>
        <p className="mb-3 text-[0.88rem] text-muted">{text.noTypes}</p>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={button.secondary}>
            {text.cancel}
          </button>
        </div>
      </Modal>
    );
  }

  const debitChoices = (current: string) =>
    ledgerChoices(data.ledgers, type.debitGroupIds, [current], extraLedgers);
  const creditChoices = (current: string) =>
    ledgerChoices(data.ledgers, type.creditGroupIds, [current], extraLedgers);

  return (
    <Modal
      title={editing ? text.formTitleEdit : text.formTitleNew}
      subtitle={editing ? text.formSubEdit : text.formSub}
      onClose={onClose}
      wide
    >
      <form onSubmit={onSubmit} noValidate>
        {editing ? (
          <p className="mb-3 text-[0.9rem] font-semibold">
            {voucher.typeName} <span className="font-normal text-muted">{voucher.referenceNo}</span>
          </p>
        ) : (
          <div role="tablist" aria-label={text.typeLabel} className="mb-3.5 flex flex-wrap gap-1">
            {data.types.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === typeId}
                onClick={() => changeType(item.id)}
                className={`min-h-[38px] rounded-full px-3.5 text-[0.84rem] ${
                  item.id === typeId
                    ? "bg-accent font-semibold text-white"
                    : "bg-track font-medium text-muted hover:text-text"
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-x-4 sm:grid-cols-2">
          <div className="mb-3.5">
            <label htmlFor={dateId} className={field.label}>
              {text.transactionDate} <span className="text-error">*</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id={dateId}
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className={`${field.input} max-w-[200px]`}
              />
              {date !== data.today ? (
                <span className={`${badge.base} ${badge.warn}`}>{text.backDated}</span>
              ) : null}
            </div>
            <p className={field.hint}>{text.dateHint}</p>
          </div>
          <div className="mb-3.5">
            <span className={field.label}>{text.voucherNumber}</span>
            <span className="block rounded-xl bg-background px-3 py-[11px] text-[0.9rem] text-muted">
              {editing ? voucher.referenceNo : text.numberHint}
            </span>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="mb-1.5 mt-3.5 hidden gap-2 pl-0.5 text-[0.74rem] font-semibold uppercase tracking-[0.04em] text-muted md:grid md:grid-cols-[1fr_1fr_130px_40px]"
        >
          <span>{type.debitLabel}</span>
          <span>{type.creditLabel}</span>
          <span>{text.amount}</span>
          <span />
        </div>

        <div>
          {rows.map((row) => (
            <div
              key={row.key}
              className="mb-2 grid gap-2.5 rounded-xl bg-background p-3 md:grid-cols-[1fr_1fr_130px_40px] md:items-center md:gap-2 md:bg-transparent md:p-0"
            >
              <label className="block min-w-0">
                <span className={`${field.label} md:sr-only`}>{type.debitLabel}</span>
                <select
                  value={row.debit}
                  onChange={(event) => updateRow(row.key, { debit: event.target.value })}
                  className={field.input}
                >
                  <option value="">{text.selectLedger}</option>
                  {debitChoices(row.debit).map((ledger) => (
                    <option key={ledger.id} value={ledger.id}>
                      {ledger.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block min-w-0">
                <span className={`${field.label} md:sr-only`}>{type.creditLabel}</span>
                <select
                  value={row.credit}
                  onChange={(event) => updateRow(row.key, { credit: event.target.value })}
                  className={field.input}
                >
                  <option value="">{text.selectLedger}</option>
                  {creditChoices(row.credit).map((ledger) => (
                    <option key={ledger.id} value={ledger.id}>
                      {ledger.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block min-w-0">
                <span className={`${field.label} md:sr-only`}>{text.amount}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={row.amount}
                  onChange={(event) => updateRow(row.key, { amount: event.target.value })}
                  placeholder="0.00"
                  className={field.input}
                />
              </label>
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                disabled={rows.length === 1}
                aria-label={text.removeLine}
                className="h-10 rounded-[10px] bg-track text-[1.1rem] text-muted hover:text-text disabled:opacity-50 md:h-11"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
          ))}
        </div>

        <button type="button" onClick={addRow} className={`${button.secondary} ${button.small}`}>
          {text.addLine}
        </button>
        <div className="mt-2 flex gap-5 rounded-xl bg-background px-3 py-2.5 text-[0.88rem]">
          <span>
            {text.total}{" "}
            <span className="font-semibold tabular-nums">{formatPaise(totalPaise)}</span>
          </span>
        </div>

        <div className="mt-3.5 grid gap-x-4 sm:grid-cols-2">
          <div className="mb-3.5">
            <label htmlFor={referenceId} className={field.label}>
              {text.reference}
            </label>
            <input
              id={referenceId}
              type="text"
              autoComplete="off"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder={text.referencePlaceholder}
              className={field.input}
            />
          </div>
          <div className="mb-3.5">
            <label htmlFor={narrationId} className={field.label}>
              {text.narration}
            </label>
            <input
              id={narrationId}
              type="text"
              autoComplete="off"
              value={narration}
              onChange={(event) => setNarration(event.target.value)}
              placeholder={text.narrationPlaceholder}
              className={field.input}
            />
          </div>
        </div>

        {editing ? (
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
        ) : null}

        <ErrorLine message={error} />
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} disabled={pending} className={button.secondary}>
            {text.cancel}
          </button>
          <button type="submit" disabled={pending} className={button.primary}>
            {pending ? text.saving : text.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ViewDialog({
  voucher,
  entries,
  onClose,
}: {
  voucher: VoucherRow;
  entries: VoucherEntryRow[];
  onClose: () => void;
}) {
  return (
    <Modal
      title={`${voucher.typeName} ${voucher.referenceNo}`}
      subtitle={formatDate(voucher.date)}
      onClose={onClose}
    >
      <div className="mb-3 overflow-hidden rounded-xl border border-divider">
        <table className="w-full border-collapse text-[0.88rem]">
          <thead>
            <tr className="bg-[#fafafb] text-left text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-muted">
              <th className="px-3 py-2">{text.debit}</th>
              <th className="px-3 py-2">{text.credit}</th>
              <th className="px-3 py-2 text-right">{text.amount}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={index} className="border-t border-divider">
                <td className="px-3 py-2 font-semibold">{entry.debitName}</td>
                <td className="px-3 py-2">{entry.creditName}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatAmountText(entry.amountText)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-divider">
              <td className="px-3 py-2 font-semibold">{text.total}</td>
              <td />
              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                {formatAmountText(voucher.totalText)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <dl className="mb-3 grid gap-1 text-[0.85rem]">
        {voucher.narration ? (
          <div>
            <dt className="inline text-muted">{text.viewNarration}: </dt>
            <dd className="inline">{voucher.narration}</dd>
          </div>
        ) : null}
        {voucher.reference ? (
          <div>
            <dt className="inline text-muted">{text.viewReference}: </dt>
            <dd className="inline">{voucher.reference}</dd>
          </div>
        ) : null}
        {voucher.editReason ? (
          <div>
            <dt className="inline text-muted">{text.viewEditReason}: </dt>
            <dd className="inline">{voucher.editReason}</dd>
          </div>
        ) : null}
        {voucher.voidReason ? (
          <div>
            <dt className="inline text-muted">{text.viewVoidReason}: </dt>
            <dd className="inline">{voucher.voidReason}</dd>
          </div>
        ) : null}
      </dl>
      <div className="flex justify-end">
        <button type="button" onClick={onClose} className={button.primary}>
          {text.close}
        </button>
      </div>
    </Modal>
  );
}

function VoidDialog({ voucher, onClose }: { voucher: VoucherRow; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputId = useId();

  function confirm() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", voucher.id);
      formData.set("reason", reason);
      const result = await voidVoucher({ error: null }, formData);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <Modal
      title={text.voidTitle}
      subtitle={
        <>
          <strong className="font-semibold text-text">
            {voucher.typeName} {voucher.referenceNo}
          </strong>{" "}
          {text.voidBody}
        </>
      }
      onClose={onClose}
    >
      <div className="mb-3">
        <label htmlFor={inputId} className={field.label}>
          {text.voidReason} <span className="text-error">*</span>
        </label>
        <input
          id={inputId}
          type="text"
          autoComplete="off"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={text.voidReasonPlaceholder}
          className={field.input}
        />
      </div>
      <ErrorLine message={error} />
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} disabled={pending} className={button.secondary}>
          {text.cancel}
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={pending || reason.trim() === ""}
          className={button.danger}
        >
          {pending ? text.voiding : text.voidAction}
        </button>
      </div>
    </Modal>
  );
}

type FormTarget = { voucher: VoucherRow | null; entries: VoucherEntryRow[] | null };
type ViewTarget = { voucher: VoucherRow; entries: VoucherEntryRow[] };

export function VoucherManager({
  data,
  canEnter,
  canChange,
}: {
  data: VoucherData;
  canEnter: boolean;
  canChange: boolean;
}) {
  const [form, setForm] = useState<FormTarget | null>(null);
  const [viewing, setViewing] = useState<ViewTarget | null>(null);
  const [voiding, setVoiding] = useState<VoucherRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"posted" | "void" | "all">("posted");
  const [search, setSearch] = useState("");

  // Loads the rows of one voucher, then opens it for viewing or editing.
  function open(voucher: VoucherRow, mode: "view" | "edit") {
    setMessage(null);
    setBusyId(voucher.id);
    startTransition(async () => {
      const result = await loadVoucherEntries(voucher.id);
      setBusyId(null);
      if (result.error !== null) {
        setMessage(result.error);
        return;
      }
      if (mode === "view") setViewing({ voucher, entries: result.entries });
      else setForm({ voucher, entries: result.entries });
    });
  }

  const term = search.trim().toLowerCase();
  const visible = data.vouchers.filter(
    (v) =>
      (statusFilter === "all" || v.status === statusFilter) &&
      (typeFilter === "" || v.voucherTypeId === typeFilter) &&
      (fromDate === "" || v.date >= fromDate) &&
      (toDate === "" || v.date <= toDate) &&
      (term === "" ||
        (v.narration ?? "").toLowerCase().includes(term) ||
        (v.reference ?? "").toLowerCase().includes(term) ||
        v.referenceNo.toLowerCase().includes(term)),
  );

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-[640px] text-[0.8rem] text-muted">{text.hint}</p>
        {canEnter ? (
          <button
            type="button"
            onClick={() => setForm({ voucher: null, entries: null })}
            className={button.primary}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              className="h-[18px] w-[18px]"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {text.newVoucher}
          </button>
        ) : null}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <input
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
          aria-label={text.fromDate}
          className={`${field.input} sm:max-w-[170px]`}
        />
        <input
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
          aria-label={text.toDate}
          className={`${field.input} sm:max-w-[170px]`}
        />
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          aria-label={text.typeFilter}
          className={`${field.input} sm:max-w-[170px]`}
        >
          <option value="">{text.allTypes}</option>
          {data.types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "posted" | "void" | "all")}
          aria-label={text.statusFilter}
          className={`${field.input} sm:max-w-[140px]`}
        >
          <option value="posted">{text.statusPosted}</option>
          <option value="void">{text.statusVoid}</option>
          <option value="all">{text.statusAll}</option>
        </select>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={text.searchPlaceholder}
          aria-label={text.searchLabel}
          className={`${field.input} sm:max-w-[260px]`}
        />
      </div>

      {message ? (
        <p
          role="alert"
          className="mb-3 rounded-[10px] bg-error-bg px-3 py-2.5 text-[0.85rem] text-error"
        >
          {message}
        </p>
      ) : null}

      <DataList<VoucherRow>
        rows={visible}
        emptyTitle={text.emptyTitle}
        emptyHint={text.emptyHint}
        actionsLabel={text.view}
        columns={[
          {
            label: text.colVoucher,
            cell: (row) => (
              <div className={row.status === "void" ? "text-muted line-through" : ""}>
                <div className="font-semibold">
                  {row.typeName}
                </div>
                <div className="text-[0.8rem] text-muted">{row.referenceNo}</div>
              </div>
            ),
          },
          { label: text.colDate, cell: (row) => formatDate(row.date) },
          {
            label: text.colDetails,
            cell: (row) => (
              <div>
                <div>
                  {row.debitNames} <span className="text-[0.8rem] text-muted">{text.to}</span>{" "}
                  {row.creditNames}
                </div>
                {row.narration || row.reference ? (
                  <div className="text-[0.8rem] text-muted">
                    {[row.narration, row.reference].filter(Boolean).join(". ")}
                  </div>
                ) : null}
              </div>
            ),
          },
          {
            label: text.colAmount,
            cell: (row) => (
              <span className="font-semibold tabular-nums">{formatAmountText(row.totalText)}</span>
            ),
          },
          { label: text.colStatus, cell: (row) => <StatusBadge status={row.status} /> },
        ]}
        actions={(row) => (
          <div className="flex flex-wrap gap-1.5 md:justify-end">
            <button
              type="button"
              onClick={() => open(row, "view")}
              disabled={busyId === row.id}
              className={`${button.secondary} ${button.small}`}
            >
              {busyId === row.id ? text.loading : text.view}
            </button>
            {canChange && row.status === "posted" ? (
              <>
                <button
                  type="button"
                  onClick={() => open(row, "edit")}
                  disabled={busyId === row.id}
                  className={`${button.secondary} ${button.small}`}
                >
                  {text.edit}
                </button>
                <button
                  type="button"
                  onClick={() => setVoiding(row)}
                  className={`${button.danger} ${button.small}`}
                >
                  {text.void}
                </button>
              </>
            ) : null}
          </div>
        )}
      />

      {data.truncated ? (
        <p className="mt-3 text-[0.8rem] text-muted">{text.truncated}</p>
      ) : null}

      {form ? (
        <VoucherForm
          key={form.voucher?.id ?? "new"}
          data={data}
          voucher={form.voucher}
          initialEntries={form.entries}
          onClose={() => setForm(null)}
        />
      ) : null}
      {viewing ? (
        <ViewDialog
          key={viewing.voucher.id}
          voucher={viewing.voucher}
          entries={viewing.entries}
          onClose={() => setViewing(null)}
        />
      ) : null}
      {voiding ? (
        <VoidDialog key={voiding.id} voucher={voiding} onClose={() => setVoiding(null)} />
      ) : null}
    </>
  );
}
