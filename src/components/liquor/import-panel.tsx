"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { ErrorLine } from "@/components/ui/admin-parts";
import { badge, button, field } from "@/components/ui/styles";
import {
  checkImport,
  runImport,
  type CheckResult,
  type ImportResult,
} from "@/lib/liquor/actions";

// All visible text sits here so it can be translated later.
const text = {
  step1: "Step 1. Choose The File",
  step2: "Step 2. Check The Result",
  effective: "Rates Effective From",
  effectiveHint: "The first load uses 01/04/2023. A later price list uses its own date.",
  whatFile: "What The File Is",
  modeFirst: "First load: items and rates",
  modeUpdate: "Price list update: rates only",
  file: "Excel File",
  fileHint: "The sheet named Inventory Master is read. Nothing is saved until you press Import.",
  check: "Check The File",
  checking: "Checking...",
  import: "Import",
  importing: "Importing...",
  chooseAnother: "Clear",
  rowsRead: "Rows Read",
  activeInactive: (active: number, inactive: number) => `${active} Active, ${inactive} Inactive`,
  newItems: "New Items",
  newItemsNote: (existing: number) => `${existing} already in the database`,
  newRates: "New Rates",
  newRatesNote: (same: number) => `${same} unchanged`,
  newCategories: "New Categories",
  newTypes: "New Types",
  none: "None",
  warnings: "Warnings",
  warningsNote: "Review before importing",
  errors: "Errors",
  errorsNote: "Fix the file to import",
  noErrors: "Nothing blocks the import",
  colRow: "Row",
  colCode: "Item Code",
  colLevel: "Level",
  colCheck: "What To Check",
  levelError: "Error",
  levelWarning: "Warning",
  issuesNote: "The first 100 lines are shown.",
  doneTitle: "Import Done",
  done: (items: number, rates: number) => `Added ${items} items and ${rates} rates.`,
  doneMore: (categories: number, types: number) =>
    `New categories: ${categories}. New types: ${types}.`,
} as const;

type Summary = NonNullable<CheckResult["summary"]>;

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <div className="text-[0.74rem] font-semibold uppercase tracking-[0.05em] text-muted">
        {label}
      </div>
      <div className="mt-0.5 text-[1.3rem] font-semibold tracking-[-0.02em] tabular-nums">
        {value}
      </div>
      {note ? <div className="text-[0.78rem] text-muted">{note}</div> : null}
    </div>
  );
}

export function ImportPanel() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"first" | "update">("first");
  const [effective, setEffective] = useState("2023-04-01");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [fileName, setFileName] = useState("");
  const [checkedKey, setCheckedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<NonNullable<ImportResult["done"]> | null>(null);
  const [checking, startChecking] = useTransition();
  const [importing, startImporting] = useTransition();
  const ids = { mode: useId(), eff: useId(), file: useId() };

  function build(): FormData | null {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose the Excel file first.");
      return null;
    }
    const data = new FormData();
    data.set("file", file);
    data.set("mode", mode);
    data.set("effectiveDate", effective);
    return data;
  }

  function onCheck() {
    const data = build();
    if (!data) return;
    setError(null);
    setDone(null);
    startChecking(async () => {
      const result = await checkImport(data);
      if (result.error || !result.summary) {
        setSummary(null);
        setError(result.error);
      } else {
        setSummary(result.summary);
        setCheckedKey(`${mode}|${effective}|${fileName}`);
      }
    });
  }

  function onImport() {
    const data = build();
    if (!data) return;
    setError(null);
    startImporting(async () => {
      const result = await runImport(data);
      if (result.error || !result.done) {
        setError(result.error);
      } else {
        setDone(result.done);
        setSummary(null);
        router.refresh();
      }
    });
  }

  // The checked result belongs to one file, mode and date. If any changes, check again.
  const fresh = summary !== null && checkedKey === `${mode}|${effective}|${fileName}`;
  const worth = summary ? summary.newItems + summary.newRates : 0;

  return (
    <div>
      <div className="mb-3.5 rounded-2xl bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <h2 className="mb-3 text-[1rem] font-semibold">{text.step1}</h2>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <div className="mb-3.5">
            <label htmlFor={ids.eff} className={field.label}>
              {text.effective} <span className="text-error">*</span>
            </label>
            <input
              id={ids.eff}
              type="date"
              value={effective}
              onChange={(event) => setEffective(event.target.value)}
              className={field.input}
            />
            <p className={field.hint}>{text.effectiveHint}</p>
          </div>
          <div className="mb-3.5">
            <label htmlFor={ids.mode} className={field.label}>
              {text.whatFile}
            </label>
            <select
              id={ids.mode}
              value={mode}
              onChange={(event) => setMode(event.target.value === "update" ? "update" : "first")}
              className={field.input}
            >
              <option value="first">{text.modeFirst}</option>
              <option value="update">{text.modeUpdate}</option>
            </select>
          </div>
        </div>
        <div className="mb-3.5">
          <label htmlFor={ids.file} className={field.label}>
            {text.file} <span className="text-error">*</span>
          </label>
          <input
            id={ids.file}
            ref={fileRef}
            type="file"
            accept=".xlsx"
            onChange={(event) => {
              setFileName(event.target.files?.[0]?.name ?? "");
              setSummary(null);
              setDone(null);
              setError(null);
            }}
            className={field.input}
          />
          <p className={field.hint}>{text.fileHint}</p>
        </div>
        <ErrorLine message={error} />
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" disabled={checking || importing} onClick={onCheck} className={button.primary}>
            {checking ? text.checking : text.check}
          </button>
        </div>
      </div>

      {done ? (
        <div role="status" className="mb-3.5 rounded-2xl bg-success-bg p-4 text-[0.9rem] text-success">
          <strong className="block">{text.doneTitle}</strong>
          {text.done(done.itemsAdded, done.ratesAdded)} {text.doneMore(done.categoriesAdded, done.typesAdded)}
        </div>
      ) : null}

      {summary ? (
        <div className="mb-3.5 rounded-2xl bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <h2 className="mb-3 text-[1rem] font-semibold">{text.step2}</h2>
          <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
            <Stat
              label={text.rowsRead}
              value={String(summary.rowsRead)}
              note={text.activeInactive(summary.activeRows, summary.inactiveRows)}
            />
            <Stat label={text.newItems} value={String(summary.newItems)} note={text.newItemsNote(summary.existingItems)} />
            <Stat label={text.newRates} value={String(summary.newRates)} note={text.newRatesNote(summary.unchangedRates)} />
            <Stat
              label={text.newCategories}
              value={String(summary.newCategories.length)}
              note={summary.newCategories.length ? summary.newCategories.join(", ") : text.none}
            />
            <Stat
              label={text.newTypes}
              value={String(summary.newTypes.length)}
              note={summary.newTypes.length ? summary.newTypes.join(", ") : text.none}
            />
            <Stat label={text.warnings} value={String(summary.warnings)} note={text.warningsNote} />
            <Stat
              label={text.errors}
              value={String(summary.errors)}
              note={summary.errors ? text.errorsNote : text.noErrors}
            />
          </div>

          {summary.issues.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-divider">
              <table className="w-full border-collapse text-[0.84rem]">
                <thead>
                  <tr className="border-b border-divider bg-[#f8f9fc] text-left text-[0.7rem] font-semibold uppercase tracking-[0.04em] text-muted">
                    <th className="px-3 py-2">{text.colRow}</th>
                    <th className="px-3 py-2">{text.colCode}</th>
                    <th className="px-3 py-2">{text.colLevel}</th>
                    <th className="px-3 py-2">{text.colCheck}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.issues.map((issue, index) => (
                    <tr key={`${issue.row}-${index}`} className="border-b border-divider last:border-b-0">
                      <td className="px-3 py-2 tabular-nums">{issue.row}</td>
                      <td className="px-3 py-2 font-mono text-[0.78rem]">{issue.code}</td>
                      <td className="px-3 py-2">
                        <span className={`${badge.base} ${issue.level === "error" ? badge.bad : badge.warn}`}>
                          {issue.level === "error" ? text.levelError : text.levelWarning}
                        </span>
                      </td>
                      <td className="px-3 py-2">{issue.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {summary.warnings + summary.errors > summary.issues.length ? (
            <p className={field.hint}>{text.issuesNote}</p>
          ) : null}

          <div className="mt-3.5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={importing || summary.errors > 0 || worth === 0 || !fresh}
              onClick={onImport}
              className={button.primary}
            >
              {importing
                ? text.importing
                : `${text.import} ${summary.newItems > 0 ? `${summary.newItems} Items` : `${summary.newRates} Rates`}`}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
