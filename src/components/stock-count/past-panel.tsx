"use client";

import { useEffect, useState } from "react";
import { LoadingPopup } from "@/components/loading-popup";
import { DataList } from "@/components/ui/admin-parts";
import { badge, button, field } from "@/components/ui/styles";
import { formatAmountText, formatDate } from "@/lib/format/money";
import { addDays } from "@/lib/reports/dates";
import { deleteCount, fetchPastCounts } from "@/lib/stock-count/actions";
import type {
  CountPoint,
  CountRights,
  CountStatus,
  PastCount,
  PastFilters,
} from "@/lib/stock-count/types";

// All visible text sits here so it can be translated later.
const text = {
  allPoints: "All Stock Points",
  from: "From",
  to: "To",
  allStatus: "All",
  complete: "Complete",
  draft: "Draft",
  posted: "Posted",
  remove: "Delete",
  removeFailed: "The count could not be deleted.",
  colDate: "Date",
  colPoint: "Stock Point",
  colItems: "Items Counted",
  colBottles: "Bottles",
  colPegs: "Pegs",
  colValue: "Value",
  colBy: "Counted By",
  colStatus: "Status",
  actions: "Actions",
  open: "Open",
  continueCount: "Continue",
  pdf: "PDF",
  excel: "Excel",
  notSaved: "Not saved",
  emptyTitle: "No Counts Found",
  emptyHint: "Change the filters, or take a count on the Count tab.",
  loading: "Loading the counts...",
  failed: "The counts could not be loaded. Change a filter to try again.",
  note: "Open shows a finished count. Continue returns to a draft. A count can be changed or deleted until it is posted to the accounts. After posting it is locked.",
} as const;

export function PastPanel({
  points,
  rights,
  today,
  onOpen,
}: {
  points: CountPoint[];
  rights: CountRights;
  today: string;
  onOpen: (pointId: string, date: string) => void;
}) {
  const [filters, setFilters] = useState<PastFilters>({
    from: addDays(today, -30),
    to: today,
    pointId: "",
    status: "",
  });
  const [rows, setRows] = useState<PastCount[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [rowError, setRowError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchPastCounts(filters).then((loaded) => {
      if (!live) return;
      setFailed(loaded === null);
      setRows(loaded ?? []);
    });
    return () => {
      live = false;
    };
  }, [filters, version]);

  async function onRemove(row: PastCount) {
    setRowError(null);
    const result = await deleteCount({ pointId: row.pointId, date: row.date });
    if (result.error) setRowError(result.error);
    else {
      setRows(null);
      setVersion((v) => v + 1);
    }
  }

  const change = (next: Partial<PastFilters>) => {
    setRows(null);
    setFilters((current) => ({ ...current, ...next }));
  };

  const columns = [
    { label: text.colDate, cell: (r: PastCount) => <span className="font-semibold">{formatDate(r.date)}</span> },
    { label: text.colPoint, cell: (r: PastCount) => r.pointName },
    {
      label: text.colItems,
      cell: (r: PastCount) => <span className="tabular-nums">{`${r.itemsCounted} of ${r.itemsTotal}`}</span>,
    },
    { label: text.colBottles, cell: (r: PastCount) => <span className="tabular-nums">{r.bottles}</span> },
    { label: text.colPegs, cell: (r: PastCount) => <span className="tabular-nums">{r.pegs}</span> },
    ...(rights.viewValue
      ? [
          {
            label: text.colValue,
            cell: (r: PastCount) =>
              r.value ? (
                <span className="font-semibold tabular-nums">{formatAmountText(r.value)}</span>
              ) : (
                <span className="text-muted">{text.notSaved}</span>
              ),
          },
        ]
      : []),
    { label: text.colBy, cell: (r: PastCount) => r.countedBy || "-" },
    {
      label: text.colStatus,
      cell: (r: PastCount) => (
        <span className={`${badge.base} ${r.status === "complete" ? badge.ok : badge.warn}`}>
          {r.posted ? text.posted : r.status === "complete" ? text.complete : text.draft}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          aria-label={text.colPoint}
          className={`${field.input} !w-auto min-w-[170px]`}
          value={filters.pointId}
          onChange={(event) => change({ pointId: event.target.value })}
        >
          <option value="">{text.allPoints}</option>
          {points.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label={text.from}
          className={`${field.input} !w-[150px]`}
          value={filters.from}
          onChange={(event) => event.target.value && change({ from: event.target.value })}
        />
        <input
          type="date"
          aria-label={text.to}
          className={`${field.input} !w-[150px]`}
          value={filters.to}
          onChange={(event) => event.target.value && change({ to: event.target.value })}
        />
        <select
          aria-label={text.colStatus}
          className={`${field.input} !w-auto min-w-[120px]`}
          value={filters.status}
          onChange={(event) => change({ status: event.target.value as CountStatus | "" })}
        >
          <option value="">{text.allStatus}</option>
          <option value="complete">{text.complete}</option>
          <option value="draft">{text.draft}</option>
        </select>
      </div>

      {rows === null ? (
        <>
          <LoadingPopup />
          <p className="sr-only">{text.loading}</p>
        </>
      ) : failed ? (
        <p role="alert" className="rounded-2xl bg-surface px-4 py-7 text-center text-[0.9rem] text-error shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          {text.failed}
        </p>
      ) : (
        <DataList<PastCount>
          rows={rows}
          columns={columns}
          emptyTitle={text.emptyTitle}
          emptyHint={text.emptyHint}
          actionsLabel={text.actions}
          actions={(r) => (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className={`${button.secondary} ${button.small}`}
                onClick={() => onOpen(r.pointId, r.date)}
              >
                {r.status === "complete" ? text.open : text.continueCount}
              </button>
              {r.status === "complete" && rights.exportFiles ? (
                <>
                  <a
                    className={`${button.secondary} ${button.small}`}
                    href={`/stock-count/export?point=${r.pointId}&date=${r.date}&format=pdf`}
                    download
                  >
                    {text.pdf}
                  </a>
                  <a
                    className={`${button.secondary} ${button.small}`}
                    href={`/stock-count/export?point=${r.pointId}&date=${r.date}&format=xlsx`}
                    download
                  >
                    {text.excel}
                  </a>
                </>
              ) : null}
              {rights.remove && !r.posted ? (
                <button
                  type="button"
                  className={`${button.danger} ${button.small}`}
                  onClick={() => onRemove(r)}
                >
                  {text.remove}
                </button>
              ) : null}
            </div>
          )}
        />
      )}
      {rowError ? (
        <p role="alert" className="mt-2 rounded-[10px] bg-error-bg px-3 py-2.5 text-[0.85rem] text-error">
          {rowError}
        </p>
      ) : null}
      <p className="mt-3.5 rounded-xl bg-accent-soft px-3 py-2.5 text-[0.84rem] text-link">{text.note}</p>
    </div>
  );
}
