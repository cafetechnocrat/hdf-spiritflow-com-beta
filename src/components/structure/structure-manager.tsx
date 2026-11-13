"use client";

import { useId, useState, useTransition } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  DataList,
  ErrorLine,
  Modal,
  SelectField,
  TextField,
} from "@/components/ui/admin-parts";
import { badge, button, field } from "@/components/ui/styles";
import {
  deleteStructure,
  saveCounter,
  saveOutlet,
  saveStockPoint,
  setStructureStatus,
} from "@/lib/structure/actions";
import type { StructureResult } from "@/lib/structure/schemas";
import {
  canAllowPegs,
  OUTLET_TYPES,
  OUTLET_TYPE_LABELS,
  STOCK_POINT_TYPES,
  type StockPointType,
  STOCK_POINT_TYPE_LABELS,
  type CounterRow,
  type OutletRow,
  type RecordStatus,
  type StockPointRow,
  type StructureData,
  type StructureKind,
} from "@/lib/structure/types";

// All visible text sits here so it can be translated later.
const text = {
  tabsLabel: "Section",
  tabStockPoints: "Stock Points",
  tabOutlets: "Outlets",
  tabCounters: "Counters",
  addStockPoint: "Add Stock Point",
  addOutlet: "Add Outlet",
  addCounter: "Add Counter",
  hintStockPoints:
    "Stock moves between stock points. It never moves between outlets. A stock point can be deleted only when it is inactive and no outlet is linked to it.",
  hintOutlets:
    "An outlet has one stock point, or none. An outlet can be deleted only when it is inactive and has no counters.",
  hintCounters:
    "A counter belongs to one outlet. An outlet can have several counters. A counter can be deleted only when it is inactive.",
  colStockPoint: "Stock Point",
  colOutlet: "Outlet",
  colCounter: "Counter",
  colType: "Type",
  colOutlets: "Outlets Selling From It",
  colCounters: "Counters",
  colStatus: "Status",
  none: "None",
  noStockPoint: "Not Applicable",
  colPeg: "Peg Sale",
  pegAllowed: "Allowed",
  pegNotAllowed: "Not Allowed",
  pegLabel: "Peg Allowed",
  pegHint:
    "Tick if this stock point counts and sells liquor in pegs. Leave it off for a store that holds bottles only.",
  shared: "(shared)",
  active: "Active",
  inactive: "Inactive",
  edit: "Edit",
  activate: "Activate",
  deactivate: "Deactivate",
  delete: "Delete",
  emptyStockPoints: "No Stock Points Yet",
  emptyStockPointsHint: "Add the first stock point.",
  emptyOutlets: "No Outlets Yet",
  emptyOutletsHint: "Add the first outlet.",
  emptyCounters: "No Counters Yet",
  emptyCountersHint: "Add an outlet first, then its counters.",
  connectTitle: "How They Connect",
  connectNoOutlet: "No outlet sells from it. Stock is only transferred out.",
  connectNoStockPoint: "Not Applicable",
  connectStockPoint: "stock point",
  connectOutlet: "outlet",
  // Forms
  stockPointTitle: "Stock Point",
  stockPointSub: "A place where stock is kept.",
  outletTitle: "Outlet",
  outletSub: "A place that sells.",
  counterTitle: "Counter",
  counterSub: "A billing point inside an outlet.",
  name: "Name",
  code: "Code",
  codeHint: "Letters and numbers only.",
  type: "Type",
  selectType: "Select A Type",
  status: "Status",
  stockPointField: "Stock Point",
  stockPointHint:
    "Only one. Choose where this outlet's stock comes from. Several outlets may share a stock point and still keep their own selling rates. Choose Not Applicable for an outlet that sells nothing from stock.",
  outletField: "Outlet",
  selectOutlet: "Select An Outlet",
  counterName: "Counter Name",
  counterNamePlaceholder: "For example Counter 1",
  cancel: "Cancel",
  save: "Save",
  saving: "Saving...",
  // Delete
  deleteTitle: {
    stock_point: "Delete Stock Point?",
    outlet: "Delete Outlet?",
    counter: "Delete Counter?",
  },
  deleteBody:
    "will be deleted permanently. This cannot be undone. The audit log keeps a record of it.",
  typePrompt: "Type the name to confirm",
  deleting: "Deleting...",
  working: "Working...",
} as const;

type TabId = "stock_point" | "outlet" | "counter";

// What the form dialog is showing. A null record means a new one.
type FormTarget =
  | { kind: "stock_point"; record: StockPointRow | null }
  | { kind: "outlet"; record: OutletRow | null }
  | { kind: "counter"; record: CounterRow | null };

type DeleteTarget = { kind: StructureKind; id: string; name: string };

function StatusBadge({ status }: { status: RecordStatus }) {
  const active = status === "active";
  return (
    <span className={`${badge.base} ${active ? badge.ok : badge.off}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {active ? text.active : text.inactive}
    </span>
  );
}

function Chip({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.78rem] font-semibold ${
        muted ? "bg-track font-medium text-muted" : "bg-accent-soft text-link"
      }`}
    >
      {children}
    </span>
  );
}

function StatusSelect({ defaultValue }: { defaultValue: RecordStatus }) {
  const id = useId();
  return (
    <div className="mb-3.5">
      <label htmlFor={id} className={field.label}>
        {text.status}
      </label>
      <select id={id} name="status" defaultValue={defaultValue} className={field.input}>
        <option value="active">{text.active}</option>
        <option value="inactive">{text.inactive}</option>
      </select>
    </div>
  );
}

// The form for creating or editing any of the three kinds.
function FormDialog({
  target,
  data,
  onClose,
}: {
  target: FormTarget;
  data: StructureData;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // The Peg Allowed box shows only for a Liquor stock point.
  const [spType, setSpType] = useState<string>(
    target.kind === "stock_point" ? (target.record?.type ?? "") : "",
  );
  const spTypeId = useId();
  const pegId = useId();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const save =
        target.kind === "stock_point"
          ? saveStockPoint
          : target.kind === "outlet"
            ? saveOutlet
            : saveCounter;
      const result: StructureResult = await save({ error: null }, formData);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  const title =
    target.kind === "stock_point"
      ? text.stockPointTitle
      : target.kind === "outlet"
        ? text.outletTitle
        : text.counterTitle;
  const subtitle =
    target.kind === "stock_point"
      ? text.stockPointSub
      : target.kind === "outlet"
        ? text.outletSub
        : text.counterSub;

  // Only active stock points can be chosen, plus the one already linked.
  const linkedId = target.kind === "outlet" ? (target.record?.stockPointId ?? "") : "";
  const stockPointChoices = data.stockPoints.filter(
    (sp) => sp.status === "active" || sp.id === linkedId,
  );

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate>
        {target.record ? <input type="hidden" name="id" value={target.record.id} /> : null}

        {target.kind === "stock_point" ? (
          <>
            <TextField
              label={text.name}
              name="name"
              defaultValue={target.record?.name ?? ""}
              placeholder="For example Liquor Store"
            />
            <div className="grid gap-x-4 sm:grid-cols-2">
              <TextField
                label={text.code}
                name="code"
                defaultValue={target.record?.code ?? ""}
                placeholder="LST"
                hint={text.codeHint}
              />
              <div className="mb-3.5">
                <label htmlFor={spTypeId} className={field.label}>
                  {text.type} <span className="text-error">*</span>
                </label>
                <select
                  id={spTypeId}
                  name="type"
                  value={spType}
                  onChange={(event) => setSpType(event.target.value)}
                  className={field.input}
                >
                  <option value="">{text.selectType}</option>
                  {STOCK_POINT_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {STOCK_POINT_TYPE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {STOCK_POINT_TYPES.includes(spType as StockPointType) &&
            canAllowPegs(spType as StockPointType) ? (
              <div className="mb-3.5">
                <label htmlFor={pegId} className="flex items-center gap-2 text-[0.88rem]">
                  <input
                    id={pegId}
                    name="pegAllowed"
                    type="checkbox"
                    defaultChecked={
                      target.kind === "stock_point" && (target.record?.pegAllowed ?? false)
                    }
                    className="h-4 w-4"
                  />
                  {text.pegLabel}
                </label>
                <p className={field.hint}>{text.pegHint}</p>
              </div>
            ) : null}
            <StatusSelect defaultValue={target.record?.status ?? "active"} />
          </>
        ) : null}

        {target.kind === "outlet" ? (
          <>
            <TextField
              label={text.name}
              name="name"
              defaultValue={target.record?.name ?? ""}
              placeholder="For example Spadikam"
            />
            <div className="grid gap-x-4 sm:grid-cols-2">
              <TextField
                label={text.code}
                name="code"
                defaultValue={target.record?.code ?? ""}
                placeholder="SPA"
                hint={text.codeHint}
              />
              <SelectField
                label={text.type}
                name="type"
                defaultValue={target.record?.type ?? ""}
              >
                <option value="">{text.selectType}</option>
                {OUTLET_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {OUTLET_TYPE_LABELS[value]}
                  </option>
                ))}
              </SelectField>
            </div>
            <SelectField
              label={text.stockPointField}
              name="stockPointId"
              defaultValue={linkedId}
              required={false}
              hint={text.stockPointHint}
            >
              <option value="">{text.noStockPoint}</option>
              {stockPointChoices.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </SelectField>
            <StatusSelect defaultValue={target.record?.status ?? "active"} />
          </>
        ) : null}

        {target.kind === "counter" ? (
          <>
            <TextField
              label={text.counterName}
              name="name"
              defaultValue={target.record?.name ?? ""}
              placeholder={text.counterNamePlaceholder}
            />
            <SelectField
              label={text.outletField}
              name="outletId"
              defaultValue={target.record?.outletId ?? ""}
            >
              <option value="">{text.selectOutlet}</option>
              {data.outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </SelectField>
            <StatusSelect defaultValue={target.record?.status ?? "active"} />
          </>
        ) : null}

        <ErrorLine message={error} />
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className={button.secondary}
          >
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

function DeleteDialog({
  target,
  onClose,
}: {
  target: DeleteTarget;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputId = useId();

  // Counters only need a confirm. Stock points and outlets need the name typed.
  const needsName = target.kind !== "counter";
  const matches = !needsName || typed.trim() === target.name.trim();

  function confirm() {
    startTransition(async () => {
      const data = new FormData();
      data.set("kind", target.kind);
      data.set("id", target.id);
      data.set("confirmName", typed);
      const result = await deleteStructure({ error: null }, data);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <Modal
      title={text.deleteTitle[target.kind]}
      subtitle={
        <>
          <strong className="font-semibold text-text">{target.name}</strong>{" "}
          {text.deleteBody}
        </>
      }
      onClose={onClose}
    >
      {needsName ? (
        <div className="mb-3">
          <label htmlFor={inputId} className={field.label}>
            {text.typePrompt}
          </label>
          <input
            id={inputId}
            type="text"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={target.name}
            className={field.input}
          />
        </div>
      ) : null}
      <ErrorLine message={error} />
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className={button.secondary}
        >
          {text.cancel}
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={pending || !matches}
          className={button.danger}
        >
          {pending ? text.deleting : text.delete}
        </button>
      </div>
    </Modal>
  );
}

function NameCell({ name, sub }: { name: string; sub?: string }) {
  return (
    <div>
      <div className="font-semibold">{name}</div>
      {sub ? <div className="text-[0.8rem] text-muted">{sub}</div> : null}
    </div>
  );
}

function ConnectionMap({ data }: { data: StructureData }) {
  const loose = data.outlets.filter((outlet) => outlet.stockPointId === null);
  return (
    <section
      aria-labelledby="connect-title"
      className="mt-4 rounded-2xl bg-surface px-4 pb-4 pt-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
    >
      <h2
        id="connect-title"
        className="mb-1 text-[0.78rem] font-semibold uppercase tracking-[0.04em] text-muted"
      >
        {text.connectTitle}
      </h2>
      <ul>
        {data.stockPoints.map((sp) => {
          const outlets = data.outlets.filter((o) => o.stockPointId === sp.id);
          return (
            <li key={sp.id} className="border-t border-divider py-2.5 first:border-t-0">
              <span className="font-semibold">{sp.name}</span>{" "}
              <span className="text-[0.8rem] text-muted">{text.connectStockPoint}</span>
              <ul className="ml-3.5 mt-1.5 grid gap-1 border-l-2 border-divider pl-3 text-[0.88rem]">
                {outlets.length === 0 ? (
                  <li className="text-[0.8rem] text-muted">{text.connectNoOutlet}</li>
                ) : (
                  outlets.map((o) => (
                    <li key={o.id}>
                      {o.name}{" "}
                      <span className="text-[0.8rem] text-muted">
                        {text.connectOutlet}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </li>
          );
        })}
        {loose.length > 0 ? (
          <li className="border-t border-divider py-2.5">
            <span className="font-semibold">{text.connectNoStockPoint}</span>
            <ul className="ml-3.5 mt-1.5 grid gap-1 border-l-2 border-divider pl-3 text-[0.88rem]">
              {loose.map((o) => (
                <li key={o.id}>
                  {o.name}{" "}
                  <span className="text-[0.8rem] text-muted">{text.connectOutlet}</span>
                </li>
              ))}
            </ul>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

export function StructureManager({
  data,
  canEdit,
}: {
  data: StructureData;
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<TabId>("stock_point");
  const [form, setForm] = useState<FormTarget | null>(null);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function changeStatus(kind: StructureKind, id: string, next: RecordStatus) {
    setMessage(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("kind", kind);
      formData.set("id", id);
      formData.set("status", next);
      const result = await setStructureStatus({ error: null }, formData);
      if (result.error) setMessage(result.error);
    });
  }

  // Edit, Activate or Deactivate, and Delete for an inactive record.
  function rowActions(
    kind: StructureKind,
    row: { id: string; name: string; status: RecordStatus },
    onEdit: () => void,
  ) {
    if (!canEdit) return null;
    const active = row.status === "active";
    return (
      <div className="flex flex-wrap gap-1.5 md:justify-end">
        <button
          type="button"
          onClick={onEdit}
          className={`${button.secondary} ${button.small}`}
        >
          {text.edit}
        </button>
        <button
          type="button"
          onClick={() => changeStatus(kind, row.id, active ? "inactive" : "active")}
          className={`${active ? button.danger : button.secondary} ${button.small}`}
        >
          {active ? text.deactivate : text.activate}
        </button>
        {!active ? (
          <button
            type="button"
            onClick={() => setDeleting({ kind, id: row.id, name: row.name })}
            className={`${button.danger} ${button.small}`}
          >
            {text.delete}
          </button>
        ) : null}
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "stock_point", label: text.tabStockPoints },
    { id: "outlet", label: text.tabOutlets },
    { id: "counter", label: text.tabCounters },
  ];

  const addLabel =
    tab === "stock_point"
      ? text.addStockPoint
      : tab === "outlet"
        ? text.addOutlet
        : text.addCounter;
  const hint =
    tab === "stock_point"
      ? text.hintStockPoints
      : tab === "outlet"
        ? text.hintOutlets
        : text.hintCounters;

  function openAdd() {
    setForm({ kind: tab, record: null } as FormTarget);
  }

  return (
    <>
      <div
        role="tablist"
        aria-label={text.tabsLabel}
        className="mb-3.5 flex max-w-[520px] gap-0.5 rounded-[10px] bg-track p-0.5"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`min-h-10 flex-1 whitespace-nowrap rounded-lg text-[0.86rem] transition-[background-color,color,box-shadow] ${
              tab === item.id
                ? "bg-surface font-semibold text-text shadow-[0_1px_3px_rgba(0,0,0,0.2),0_0_0_0.5px_rgba(0,0,0,0.04)]"
                : "font-medium text-muted hover:text-text"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-[640px] text-[0.8rem] text-muted">{hint}</p>
        {canEdit ? (
          <button type="button" onClick={openAdd} className={button.primary}>
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
            {addLabel}
          </button>
        ) : null}
      </div>

      {message ? (
        <p
          role="alert"
          className="mb-3 rounded-[10px] bg-error-bg px-3 py-2.5 text-[0.85rem] text-error"
        >
          {message}
        </p>
      ) : null}

      {tab === "stock_point" ? (
        <DataList<StockPointRow>
          rows={data.stockPoints}
          emptyTitle={text.emptyStockPoints}
          emptyHint={text.emptyStockPointsHint}
          actionsLabel={text.edit}
          columns={[
            {
              label: text.colStockPoint,
              cell: (row) => <NameCell name={row.name} sub={row.code} />,
            },
            { label: text.colType, cell: (row) => STOCK_POINT_TYPE_LABELS[row.type] },
            {
              label: text.colPeg,
              cell: (row) =>
                canAllowPegs(row.type) ? (
                  row.pegAllowed ? (
                    text.pegAllowed
                  ) : (
                    text.pegNotAllowed
                  )
                ) : (
                  <span className="text-muted">-</span>
                ),
            },
            {
              label: text.colOutlets,
              cell: (row) => (
                <div className="flex flex-wrap gap-1.5">
                  {row.outletNames.length === 0 ? (
                    <Chip muted>{text.none}</Chip>
                  ) : (
                    row.outletNames.map((name) => <Chip key={name}>{name}</Chip>)
                  )}
                </div>
              ),
            },
            { label: text.colStatus, cell: (row) => <StatusBadge status={row.status} /> },
          ]}
          actions={(row) =>
            rowActions("stock_point", row, () =>
              setForm({ kind: "stock_point", record: row }),
            )
          }
        />
      ) : null}

      {tab === "outlet" ? (
        <DataList<OutletRow>
          rows={data.outlets}
          emptyTitle={text.emptyOutlets}
          emptyHint={text.emptyOutletsHint}
          actionsLabel={text.edit}
          columns={[
            {
              label: text.colOutlet,
              cell: (row) => <NameCell name={row.name} sub={row.code} />,
            },
            { label: text.colType, cell: (row) => OUTLET_TYPE_LABELS[row.type] },
            {
              label: text.colStockPoint,
              cell: (row) =>
                row.stockPointName ? (
                  <>
                    {row.stockPointName}
                    {row.sharesStockPoint ? (
                      <span className="text-[0.8rem] text-muted"> {text.shared}</span>
                    ) : null}
                  </>
                ) : (
                  <Chip muted>{text.noStockPoint}</Chip>
                ),
            },
            {
              label: text.colCounters,
              cell: (row) =>
                row.counterCount === 0 ? (
                  <span className="text-muted">{text.none}</span>
                ) : (
                  row.counterCount
                ),
            },
            { label: text.colStatus, cell: (row) => <StatusBadge status={row.status} /> },
          ]}
          actions={(row) =>
            rowActions("outlet", row, () => setForm({ kind: "outlet", record: row }))
          }
        />
      ) : null}

      {tab === "counter" ? (
        <DataList<CounterRow>
          rows={data.counters}
          emptyTitle={text.emptyCounters}
          emptyHint={text.emptyCountersHint}
          actionsLabel={text.edit}
          columns={[
            {
              label: text.colCounter,
              cell: (row) => <NameCell name={row.name} />,
            },
            { label: text.colOutlet, cell: (row) => row.outletName },
            { label: text.colStatus, cell: (row) => <StatusBadge status={row.status} /> },
          ]}
          actions={(row) =>
            rowActions(
              "counter",
              { id: row.id, name: `${row.outletName}, ${row.name}`, status: row.status },
              () => setForm({ kind: "counter", record: row }),
            )
          }
        />
      ) : null}

      <ConnectionMap data={data} />

      {form ? (
        <FormDialog
          key={`${form.kind}-${form.record?.id ?? "new"}`}
          target={form}
          data={data}
          onClose={() => setForm(null)}
        />
      ) : null}
      {deleting ? (
        <DeleteDialog
          key={deleting.id}
          target={deleting}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}
