"use client";

import { useId, useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";
import {
  DataList,
  ErrorLine,
  Modal,
  TextField,
} from "@/components/ui/admin-parts";
import { badge, button, field } from "@/components/ui/styles";
import {
  deleteLedgerItem,
  saveGroup,
  saveLedger,
  setLedgerStatus,
} from "@/lib/ledgers/actions";
import type { LedgerResult } from "@/lib/ledgers/schemas";
import {
  ACCOUNT_NATURE_LABELS,
  BALANCE_SIDES,
  BALANCE_SIDE_LABELS,
  hasOpeningBalance,
  type AccountNature,
  type LedgerData,
  type LedgerGroupRow,
  type LedgerKind,
  type LedgerRow,
  type RecordStatus,
} from "@/lib/ledgers/types";

// All visible text sits here so it can be translated later.
const text = {
  tabsLabel: "Section",
  tabGroups: "Ledger Groups",
  tabLedgers: "Ledgers",
  addGroup: "Add Group",
  addLedger: "Add Ledger",
  hintGroups:
    "Default groups cannot be deleted. A sub-group always has the same nature as its group. A custom group can be deleted only when it is inactive and holds no ledgers or sub-groups.",
  hintLedgers:
    "Names follow the prefix style, for example Sales - Liquor. An alias holds a name staff already use. A ledger that has entries cannot be deleted; make it inactive instead.",
  colGroup: "Group",
  colUnder: "Under",
  colNature: "Nature",
  colLedgers: "Active Ledgers",
  colKind: "Kind",
  colStatus: "Status",
  colLedger: "Ledger",
  colOpening: "Opening Balance",
  primary: "None (Primary)",
  kindDefault: "Default",
  kindCustom: "Custom",
  notApplicable: "Not Applicable",
  active: "Active",
  inactive: "Inactive",
  edit: "Edit",
  activate: "Activate",
  deactivate: "Deactivate",
  delete: "Delete",
  emptyGroups: "No Groups Found",
  emptyGroupsHint: "The default groups are added when the database is set up.",
  emptyLedgers: "No Ledgers Found",
  emptyLedgersHint: "Add the first ledger, or change the filters.",
  searchPlaceholder: "Search Name Or Alias",
  searchLabel: "Search",
  allGroups: "All Groups",
  filterStatusLabel: "Status",
  statusAll: "All",
  // Group form
  groupTitle: "Ledger Group",
  groupSub: "A heading that ledgers sit under.",
  defaultGroupTitle: "Default Group",
  defaultGroupSub:
    "This group came with the system. Its place and nature are fixed because reports depend on them.",
  groupName: "Group Name",
  groupNamePlaceholder: "For example Duties And Taxes - GST",
  under: "Under",
  selectGroup: "Select A Group",
  nature: "Nature",
  natureHint:
    "The nature (Assets, Liabilities, Income or Expenses) follows the group you choose.",
  statusBlocked:
    "This group has active ledgers or sub-groups, so it cannot be made inactive.",
  statusHint: "A group with active ledgers or active sub-groups cannot be made inactive.",
  // Ledger form
  ledgerTitle: "Ledger",
  ledgerSub: "An account that transactions are posted to.",
  ledgerName: "Ledger Name",
  ledgerNamePlaceholder: "For example Sales - Liquor",
  ledgerNameHint: "Prefix style: a plain hyphen with a space on each side, Title Case.",
  alias: "Alias",
  aliasPlaceholder: "A name staff already use",
  group: "Group",
  openingLabel: "Opening Balance",
  openingHint:
    "Shown only for ledgers under Assets and Liabilities groups. Leave empty for no opening balance.",
  openingDateLabel: "As On Date",
  openingDateHint: "Pick the date this balance is as on. Required when there is an amount.",
  asOn: "as on",
  drCr: "Debit or credit",
  note: "Note",
  notePlaceholder: "Optional",
  status: "Status",
  cancel: "Cancel",
  save: "Save",
  saving: "Saving...",
  // Delete
  deleteTitle: { group: "Delete Group?", ledger: "Delete Ledger?" },
  deleteBody:
    "will be deleted permanently. This cannot be undone. The audit log keeps a record of it.",
  typePrompt: "Type the name to confirm",
  deleting: "Deleting...",
} as const;

type TabId = "group" | "ledger";

type FormTarget =
  | { kind: "group"; record: LedgerGroupRow | null }
  | { kind: "ledger"; record: LedgerRow | null };

type DeleteTarget = { kind: LedgerKind; id: string; name: string };

const NATURE_BADGE: Record<AccountNature, string> = {
  assets: badge.role,
  liabilities: badge.warn,
  income: badge.ok,
  expenses: badge.bad,
};

// Indian number format, display only.
const amountFormat = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// YYYY-MM-DD to DD/MM/YYYY. Split as text so no timezone can shift the day.
function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function StatusBadge({ status }: { status: RecordStatus }) {
  const active = status === "active";
  return (
    <span className={`${badge.base} ${active ? badge.ok : badge.off}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {active ? text.active : text.inactive}
    </span>
  );
}

function NatureBadge({ nature }: { nature: AccountNature }) {
  return (
    <span className={`${badge.base} ${NATURE_BADGE[nature]}`}>
      {ACCOUNT_NATURE_LABELS[nature]}
    </span>
  );
}

function StatusSelect({
  defaultValue,
  hint,
}: {
  defaultValue: RecordStatus;
  hint?: string;
}) {
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
      {hint ? <p className={field.hint}>{hint}</p> : null}
    </div>
  );
}

// The group list as choices, with sub-groups indented under their group.
function GroupOptions({
  groups,
  hideIds,
  keepId,
}: {
  groups: LedgerGroupRow[];
  hideIds?: Set<string>;
  keepId?: string;
}) {
  return (
    <>
      <option value="">{text.selectGroup}</option>
      {groups
        .filter(
          (group) =>
            !hideIds?.has(group.id) && (group.status === "active" || group.id === keepId),
        )
        .map((group) => (
          <option key={group.id} value={group.id}>
            {"    ".repeat(group.depth)}
            {group.name}
          </option>
        ))}
    </>
  );
}

function GroupForm({
  record,
  data,
  onClose,
}: {
  record: LedgerGroupRow | null;
  data: LedgerData;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isDefault = record?.isDefault ?? false;
  const [parentId, setParentId] = useState(record?.parentId ?? "");
  const parentSelectId = useId();

  // A group cannot be moved under itself or under one of its own sub-groups.
  const hideIds = useMemo(() => {
    const hidden = new Set<string>();
    if (!record) return hidden;
    hidden.add(record.id);
    let grew = true;
    while (grew) {
      grew = false;
      for (const group of data.groups) {
        if (group.parentId && hidden.has(group.parentId) && !hidden.has(group.id)) {
          hidden.add(group.id);
          grew = true;
        }
      }
    }
    return hidden;
  }, [record, data.groups]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result: LedgerResult = await saveGroup({ error: null }, formData);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  const blocked = record ? record.activeLedgerCount + record.activeChildCount > 0 : false;

  return (
    <Modal
      title={isDefault ? text.defaultGroupTitle : text.groupTitle}
      subtitle={isDefault ? text.defaultGroupSub : text.groupSub}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} noValidate>
        {record ? <input type="hidden" name="id" value={record.id} /> : null}
        <TextField
          label={text.groupName}
          name="name"
          defaultValue={record?.name ?? ""}
          placeholder={text.groupNamePlaceholder}
        />
        {isDefault ? (
          <div className="grid gap-x-4 sm:grid-cols-2">
            <div className="mb-3.5">
              <label className={field.label}>{text.under}</label>
              <input
                type="text"
                disabled
                value={record?.parentName ?? text.primary}
                className={field.input}
              />
            </div>
            <div className="mb-3.5">
              <label className={field.label}>{text.nature}</label>
              <input
                type="text"
                disabled
                value={record ? ACCOUNT_NATURE_LABELS[record.nature] : ""}
                className={field.input}
              />
            </div>
          </div>
        ) : (
          <div className="mb-3.5">
            <label htmlFor={parentSelectId} className={field.label}>
              {text.under} <span className="text-error">*</span>
            </label>
            <select
              id={parentSelectId}
              name="parentId"
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
              className={field.input}
            >
              <GroupOptions
                groups={data.groups}
                hideIds={hideIds}
                keepId={record?.parentId ?? undefined}
              />
            </select>
            <p className={field.hint}>{text.natureHint}</p>
          </div>
        )}
        <StatusSelect
          defaultValue={record?.status ?? "active"}
          hint={blocked ? text.statusBlocked : text.statusHint}
        />
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

function LedgerForm({
  record,
  data,
  onClose,
}: {
  record: LedgerRow | null;
  data: LedgerData;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [groupId, setGroupId] = useState(record?.groupId ?? "");
  const groupSelectId = useId();
  const openingId = useId();
  const sideId = useId();
  const noteId = useId();
  const dateId = useId();

  const selected = data.groups.find((group) => group.id === groupId);
  const showOpening = selected ? hasOpeningBalance(selected.nature) : true;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result: LedgerResult = await saveLedger({ error: null }, formData);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <Modal title={text.ledgerTitle} subtitle={text.ledgerSub} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate>
        {record ? <input type="hidden" name="id" value={record.id} /> : null}
        <TextField
          label={text.ledgerName}
          name="name"
          defaultValue={record?.name ?? ""}
          placeholder={text.ledgerNamePlaceholder}
          hint={text.ledgerNameHint}
        />
        <TextField
          label={text.alias}
          name="alias"
          defaultValue={record?.alias ?? ""}
          placeholder={text.aliasPlaceholder}
          required={false}
        />
        <div className="mb-3.5">
          <label htmlFor={groupSelectId} className={field.label}>
            {text.group} <span className="text-error">*</span>
          </label>
          <select
            id={groupSelectId}
            name="groupId"
            value={groupId}
            onChange={(event) => setGroupId(event.target.value)}
            className={field.input}
          >
            <GroupOptions groups={data.groups} keepId={record?.groupId} />
          </select>
        </div>
        {showOpening ? (
          <div className="mb-3.5">
            <label htmlFor={openingId} className={field.label}>
              {text.openingLabel}
            </label>
            <div className="grid grid-cols-[1fr_100px] gap-2.5">
              <input
                id={openingId}
                name="openingAmount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                defaultValue={record ? record.openingAmount.toFixed(2) : ""}
                placeholder="0.00"
                className={field.input}
              />
              <select
                id={sideId}
                name="openingSide"
                aria-label={text.drCr}
                defaultValue={record?.openingSide ?? "dr"}
                className={field.input}
              >
                {BALANCE_SIDES.map((side) => (
                  <option key={side} value={side}>
                    {BALANCE_SIDE_LABELS[side]}
                  </option>
                ))}
              </select>
            </div>
            <p className={field.hint}>{text.openingHint}</p>
            <label htmlFor={dateId} className={`${field.label} mt-3`}>
              {text.openingDateLabel}
            </label>
            <input
              id={dateId}
              name="openingDate"
              type="date"
              defaultValue={record?.openingDate ?? ""}
              className={field.input}
            />
            <p className={field.hint}>{text.openingDateHint}</p>
          </div>
        ) : null}
        <StatusSelect defaultValue={record?.status ?? "active"} />
        <div className="mb-3.5">
          <label htmlFor={noteId} className={field.label}>
            {text.note}
          </label>
          <input
            id={noteId}
            name="note"
            type="text"
            autoComplete="off"
            defaultValue={record?.note ?? ""}
            placeholder={text.notePlaceholder}
            className={field.input}
          />
        </div>
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

  const matches = typed.trim() === target.name.trim();

  function confirm() {
    startTransition(async () => {
      const data = new FormData();
      data.set("kind", target.kind);
      data.set("id", target.id);
      data.set("confirmName", typed);
      const result = await deleteLedgerItem({ error: null }, data);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <Modal
      title={text.deleteTitle[target.kind]}
      subtitle={
        <>
          <strong className="font-semibold text-text">{target.name}</strong> {text.deleteBody}
        </>
      }
      onClose={onClose}
    >
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

export function LedgerManager({
  data,
  canEdit,
}: {
  data: LedgerData;
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<TabId>("group");
  const [form, setForm] = useState<FormTarget | null>(null);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [, startTransition] = useTransition();

  function changeStatus(kind: LedgerKind, id: string, next: RecordStatus) {
    setMessage(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("kind", kind);
      formData.set("id", id);
      formData.set("status", next);
      const result = await setLedgerStatus({ error: null }, formData);
      if (result.error) setMessage(result.error);
    });
  }

  // Edit, Activate or Deactivate, and Delete for an inactive record. A default
  // group is never deleted.
  function rowActions(
    kind: LedgerKind,
    row: { id: string; name: string; status: RecordStatus },
    onEdit: () => void,
    canDelete: boolean,
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
        {!active && canDelete ? (
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
    { id: "group", label: text.tabGroups },
    { id: "ledger", label: text.tabLedgers },
  ];

  const term = search.trim().toLowerCase();
  const visibleLedgers = data.ledgers.filter(
    (ledger) =>
      (statusFilter === "all" || ledger.status === statusFilter) &&
      (groupFilter === "" || ledger.groupId === groupFilter) &&
      (term === "" ||
        ledger.name.toLowerCase().includes(term) ||
        (ledger.alias ?? "").toLowerCase().includes(term)),
  );

  return (
    <>
      <div
        role="tablist"
        aria-label={text.tabsLabel}
        className="mb-3.5 flex max-w-[420px] gap-0.5 rounded-[10px] bg-track p-0.5"
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
        <p className="max-w-[640px] text-[0.8rem] text-muted">
          {tab === "group" ? text.hintGroups : text.hintLedgers}
        </p>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setForm({ kind: tab, record: null } as FormTarget)}
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
            {tab === "group" ? text.addGroup : text.addLedger}
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

      {tab === "group" ? (
        <DataList<LedgerGroupRow>
          rows={data.groups}
          emptyTitle={text.emptyGroups}
          emptyHint={text.emptyGroupsHint}
          actionsLabel={text.edit}
          columns={[
            {
              label: text.colGroup,
              cell: (row) => (
                <div
                  className="font-semibold"
                  style={{ paddingLeft: `${row.depth * 20}px` }}
                >
                  {row.depth > 0 ? (
                    <span className="mr-1.5 font-normal text-muted" aria-hidden="true">
                      {"└"}
                    </span>
                  ) : null}
                  {row.name}
                </div>
              ),
            },
            { label: text.colUnder, cell: (row) => row.parentName ?? text.primary },
            { label: text.colNature, cell: (row) => <NatureBadge nature={row.nature} /> },
            { label: text.colLedgers, cell: (row) => row.activeLedgerCount },
            {
              label: text.colKind,
              cell: (row) => (
                <span className={`${badge.base} ${row.isDefault ? badge.role : badge.off}`}>
                  {row.isDefault ? text.kindDefault : text.kindCustom}
                </span>
              ),
            },
            { label: text.colStatus, cell: (row) => <StatusBadge status={row.status} /> },
          ]}
          actions={(row) =>
            rowActions(
              "group",
              row,
              () => setForm({ kind: "group", record: row }),
              !row.isDefault,
            )
          }
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={text.searchPlaceholder}
              aria-label={text.searchLabel}
              className={`${field.input} sm:max-w-[240px]`}
            />
            <select
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
              aria-label={text.group}
              className={`${field.input} !w-auto min-w-[200px] max-w-full`}
            >
              <option value="">{text.allGroups}</option>
              {data.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {"    ".repeat(group.depth)}
                  {group.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "active" | "inactive" | "all")
              }
              aria-label={text.filterStatusLabel}
              className={`${field.input} sm:max-w-[160px]`}
            >
              <option value="active">{text.active}</option>
              <option value="inactive">{text.inactive}</option>
              <option value="all">{text.statusAll}</option>
            </select>
          </div>
          <DataList<LedgerRow>
            rows={visibleLedgers}
            emptyTitle={text.emptyLedgers}
            emptyHint={text.emptyLedgersHint}
            actionsLabel={text.edit}
            columns={[
              {
                label: text.colLedger,
                cell: (row) => (
                  <div>
                    <div className="font-semibold">{row.name}</div>
                    {row.alias ? (
                      <div className="text-[0.8rem] text-muted">{row.alias}</div>
                    ) : null}
                  </div>
                ),
              },
              { label: text.colGroup, cell: (row) => row.groupName },
              {
                label: text.colOpening,
                cell: (row) =>
                  hasOpeningBalance(row.groupNature) ? (
                    <span>
                      <span className="font-semibold tabular-nums">
                        {amountFormat.format(row.openingAmount)}
                      </span>{" "}
                      {BALANCE_SIDE_LABELS[row.openingSide]}
                      {row.openingDate ? (
                        <span className="block text-[0.8rem] text-muted">
                          {text.asOn} {formatDate(row.openingDate)}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-[0.8rem] text-muted">{text.notApplicable}</span>
                  ),
              },
              { label: text.colStatus, cell: (row) => <StatusBadge status={row.status} /> },
            ]}
            actions={(row) =>
              rowActions(
                "ledger",
                row,
                () => setForm({ kind: "ledger", record: row }),
                true,
              )
            }
          />
        </>
      )}

      {form?.kind === "group" ? (
        <GroupForm
          key={form.record?.id ?? "new-group"}
          record={form.record}
          data={data}
          onClose={() => setForm(null)}
        />
      ) : null}
      {form?.kind === "ledger" ? (
        <LedgerForm
          key={form.record?.id ?? "new-ledger"}
          record={form.record}
          data={data}
          onClose={() => setForm(null)}
        />
      ) : null}
      {deleting ? (
        <DeleteDialog key={deleting.id} target={deleting} onClose={() => setDeleting(null)} />
      ) : null}
    </>
  );
}
