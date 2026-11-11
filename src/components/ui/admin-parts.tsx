"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { field } from "@/components/ui/styles";

// Pieces shared by the admin screens: the dialog, error line, form fields and
// the table that turns into cards on phones.

// A native dialog that opens when it appears and tells its parent when it closes.
export function Modal({
  title,
  subtitle,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  // A wider dialog for forms with several columns.
  wide?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-[980px]" : "max-w-[480px]"} rounded-[18px] bg-surface p-5 text-text shadow-card backdrop:bg-black/40`}
    >
      <h2 id={titleId} className="text-[1.15rem] font-semibold tracking-[-0.02em]">
        {title}
      </h2>
      {subtitle ? (
        <p className="mb-4 mt-1 text-[0.88rem] text-muted">{subtitle}</p>
      ) : (
        <div className="mb-3" />
      )}
      {children}
    </dialog>
  );
}

export function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mb-3 rounded-[10px] bg-error-bg px-3 py-2.5 text-[0.85rem] text-error"
    >
      {message}
    </p>
  );
}

export function TextField({
  label,
  name,
  defaultValue,
  placeholder,
  hint,
  required = true,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="mb-3.5">
      <label htmlFor={id} className={field.label}>
        {label} {required ? <span className="text-error">*</span> : null}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        autoComplete="off"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={field.input}
      />
      {hint ? <p className={field.hint}>{hint}</p> : null}
    </div>
  );
}

export function SelectField({
  label,
  name,
  defaultValue,
  required = true,
  hint,
  children,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="mb-3.5">
      <label htmlFor={id} className={field.label}>
        {label} {required ? <span className="text-error">*</span> : null}
      </label>
      <select id={id} name={name} defaultValue={defaultValue} className={field.input}>
        {children}
      </select>
      {hint ? <p className={field.hint}>{hint}</p> : null}
    </div>
  );
}

export type Column<T> = {
  label: string;
  cell: (row: T) => ReactNode;
};

// A table from tablet width up, and cards on phones.
export function DataList<T extends { id: string }>({
  rows,
  columns,
  actions,
  emptyTitle,
  emptyHint,
  actionsLabel,
}: {
  rows: T[];
  columns: Column<T>[];
  actions: (row: T) => ReactNode;
  emptyTitle: string;
  emptyHint: string;
  actionsLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-surface px-4 py-7 text-center text-[0.9rem] text-muted shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <strong className="mb-0.5 block text-[1rem] text-text">{emptyTitle}</strong>
        {emptyHint}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <table className="hidden w-full border-collapse md:table">
        <thead>
          <tr className="border-b border-divider bg-[#fafafb] text-left text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-muted">
            {columns.map((column) => (
              <th key={column.label} className="px-4 py-3">
                {column.label}
              </th>
            ))}
            <th className="px-4 py-3">
              <span className="sr-only">{actionsLabel}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-divider text-[0.88rem] last:border-b-0 hover:bg-[#fafafb]"
            >
              {columns.map((column) => (
                <td key={column.label} className="px-4 py-3 align-middle">
                  {column.cell(row)}
                </td>
              ))}
              <td className="px-4 py-3">{actions(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="md:hidden">
        {rows.map((row) => (
          <li
            key={row.id}
            className="border-b border-divider px-4 py-3 text-[0.88rem] last:border-b-0"
          >
            <div className="mb-2">{columns[0]?.cell(row)}</div>
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
              {columns.slice(1).map((column) => (
                <div key={column.label} className="contents">
                  <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-muted">
                    {column.label}
                  </dt>
                  <dd>{column.cell(row)}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-2.5">{actions(row)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
