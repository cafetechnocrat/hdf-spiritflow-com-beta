"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { DataList, ErrorLine, Modal, TextField } from "@/components/ui/admin-parts";
import { badge, button, field } from "@/components/ui/styles";
import { saveLookup } from "@/lib/liquor/actions";
import type { LiquorLookups, LookupRow } from "@/lib/liquor/types";

// All visible text sits here so it can be translated later.
const text = {
  hint: "Categories and types are kept in tables, not fixed in the code. A category that has items is made Inactive, never deleted.",
  addCategory: "Add Category",
  addType: "Add Type",
  typesHeading: "Types",
  colCategory: "Category",
  colType: "Type",
  colMeaning: "Meaning",
  colItems: "Items",
  colActive: "Active Items",
  colOrder: "Order",
  colStatus: "Status",
  actions: "Actions",
  edit: "Edit",
  active: "Active",
  inactive: "Inactive",
  emptyTitle: "Nothing Here Yet",
  emptyHint: "Add the first one.",
  categoryTitle: "Category",
  categorySub: "A group of liquor items, such as Gin.",
  typeTitle: "Type",
  typeSub: "How the liquor is made, such as IMFL.",
  name: "Name",
  namePlaceholderCategory: "For example Gin",
  namePlaceholderType: "For example IMFL",
  meaning: "Meaning",
  order: "Order On Screens",
  status: "Status",
  cancel: "Cancel",
  save: "Save",
  saving: "Saving...",
} as const;

const NUMBER = new Intl.NumberFormat("en-IN");

function LookupForm({
  kind,
  record,
  onClose,
}: {
  kind: "category" | "type";
  record: LookupRow | null;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const statusId = useId();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveLookup(kind, formData);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <Modal
      title={kind === "category" ? text.categoryTitle : text.typeTitle}
      subtitle={kind === "category" ? text.categorySub : text.typeSub}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} noValidate>
        {record ? <input type="hidden" name="id" value={record.id} /> : null}
        <TextField
          label={text.name}
          name="name"
          defaultValue={record?.name ?? ""}
          placeholder={kind === "category" ? text.namePlaceholderCategory : text.namePlaceholderType}
        />
        {kind === "type" ? (
          <TextField
            label={text.meaning}
            name="description"
            defaultValue={record?.description ?? ""}
            required={false}
          />
        ) : (
          <TextField
            label={text.order}
            name="sortOrder"
            defaultValue={record ? String(record.sortOrder) : ""}
            required={false}
          />
        )}
        <div className="mb-3.5">
          <label htmlFor={statusId} className={field.label}>
            {text.status}
          </label>
          <select
            id={statusId}
            name="status"
            defaultValue={record?.status ?? "active"}
            className={field.input}
          >
            <option value="active">{text.active}</option>
            <option value="inactive">{text.inactive}</option>
          </select>
        </div>
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

function StatusBadge({ status }: { status: "active" | "inactive" }) {
  return (
    <span className={`${badge.base} ${status === "active" ? badge.ok : badge.off}`}>
      {status === "active" ? text.active : text.inactive}
    </span>
  );
}

export function LookupsPanel({
  lookups,
  canEdit,
}: {
  lookups: LiquorLookups;
  canEdit: boolean;
}) {
  const [form, setForm] = useState<{ kind: "category" | "type"; record: LookupRow | null } | null>(
    null,
  );

  const renderEdit = (kind: "category" | "type", row: LookupRow) =>
    canEdit ? (
      <button
        type="button"
        className={`${button.secondary} ${button.small}`}
        onClick={() => setForm({ kind, record: row })}
      >
        {text.edit}
      </button>
    ) : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 max-w-[60ch] text-[0.8rem] text-muted">{text.hint}</p>
        {canEdit ? (
          <div className="flex gap-2">
            <button
              type="button"
              className={button.primary}
              onClick={() => setForm({ kind: "category", record: null })}
            >
              {text.addCategory}
            </button>
            <button
              type="button"
              className={button.secondary}
              onClick={() => setForm({ kind: "type", record: null })}
            >
              {text.addType}
            </button>
          </div>
        ) : null}
      </div>

      <DataList
        rows={lookups.categories}
        emptyTitle={text.emptyTitle}
        emptyHint={text.emptyHint}
        actionsLabel={text.actions}
        columns={[
          { label: text.colCategory, cell: (r) => <span className="font-semibold">{r.name}</span> },
          { label: text.colItems, cell: (r) => <span className="tabular-nums">{NUMBER.format(r.items)}</span> },
          { label: text.colActive, cell: (r) => <span className="tabular-nums">{NUMBER.format(r.activeItems)}</span> },
          { label: text.colOrder, cell: (r) => <span className="tabular-nums">{r.sortOrder}</span> },
          { label: text.colStatus, cell: (r) => <StatusBadge status={r.status} /> },
        ]}
        actions={(row) => renderEdit("category", row)}
      />

      <h3 className="mb-2 mt-6 text-[0.78rem] font-semibold uppercase tracking-[0.05em] text-muted">
        {text.typesHeading}
      </h3>
      <DataList
        rows={lookups.types}
        emptyTitle={text.emptyTitle}
        emptyHint={text.emptyHint}
        actionsLabel={text.actions}
        columns={[
          { label: text.colType, cell: (r) => <span className="font-semibold">{r.name}</span> },
          { label: text.colMeaning, cell: (r) => r.description ?? "" },
          { label: text.colItems, cell: (r) => <span className="tabular-nums">{NUMBER.format(r.items)}</span> },
          { label: text.colStatus, cell: (r) => <StatusBadge status={r.status} /> },
        ]}
        actions={(row) => renderEdit("type", row)}
      />

      {form ? (
        <LookupForm
          key={`${form.kind}-${form.record?.id ?? "new"}`}
          kind={form.kind}
          record={form.record}
          onClose={() => setForm(null)}
        />
      ) : null}
    </div>
  );
}
