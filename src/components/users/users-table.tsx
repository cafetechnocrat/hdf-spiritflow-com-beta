"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { badge, button, field } from "@/components/ui/styles";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/auth/roles";
import type { UserRow } from "@/lib/users/queries";
import { DeleteDialog, type DeleteTarget } from "./delete-dialog";
import { StatusDialog, type StatusTarget } from "./status-dialog";

const text = {
  searchLabel: "Search Users",
  searchPlaceholder: "Search By Name Or Email",
  roleLabel: "Role",
  allRoles: "All Roles",
  statusLabel: "Status",
  allStatuses: "All Statuses",
  active: "Active",
  inactive: "Inactive",
  name: "Name",
  role: "Role",
  signIn: "Sign In",
  outletAccess: "Outlet Access",
  allOutlets: "All Outlets",
  status: "Status",
  actions: "Actions",
  edit: "Edit",
  deactivate: "Deactivate",
  activate: "Activate",
  delete: "Delete",
  emailAndPassword: "Email And Password",
  usernameAndPin: "Username And PIN",
  noMatch: "No Users Found",
  noMatchHint: "Try a different search or clear the filters.",
  showing: (shown: number, total: number) =>
    `Showing ${shown} Of ${total} ${total === 1 ? "User" : "Users"}`,
} as const;

function StatusBadge({ status }: { status: UserRow["status"] }) {
  const active = status === "active";
  return (
    <span className={`${badge.base} ${active ? badge.ok : badge.off}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {active ? text.active : text.inactive}
    </span>
  );
}

export function UsersTable({
  rows,
  canEdit,
  currentUserId,
}: {
  rows: UserRow[];
  canEdit: boolean;
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"" | Role>("");
  const [status, setStatus] = useState<"" | UserRow["status"]>("");
  const [target, setTarget] = useState<StatusTarget | null>(null);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (!role || row.role === role) &&
        (!status || row.status === status) &&
        (!needle ||
          row.fullName.toLowerCase().includes(needle) ||
          row.signIn.toLowerCase().includes(needle)),
    );
  }, [rows, query, role, status]);

  function toggleTarget(row: UserRow): StatusTarget {
    return {
      id: row.id,
      name: row.fullName,
      next: row.status === "active" ? "inactive" : "active",
    };
  }

  function renderActions(row: UserRow) {
    if (!canEdit) return null;
    const active = row.status === "active";
    // A user cannot deactivate their own account.
    const isSelf = row.id === currentUserId;
    return (
      <div className="flex flex-wrap gap-1.5 md:justify-end">
        <Link
          href={`/users/${row.id}`}
          className={`${button.secondary} ${button.small}`}
        >
          {text.edit}
        </Link>
        {isSelf && active ? null : (
          <button
            type="button"
            onClick={() => setTarget(toggleTarget(row))}
            className={`${active ? button.danger : button.secondary} ${button.small}`}
          >
            {active ? text.deactivate : text.activate}
          </button>
        )}
        {!active && !isSelf ? (
          <button
            type="button"
            onClick={() => setDeleting({ id: row.id, name: row.fullName })}
            className={`${button.danger} ${button.small}`}
          >
            {text.delete}
          </button>
        ) : null}
      </div>
    );
  }

  const signInKind = (row: UserRow) =>
    row.role === "cashier" ? text.usernameAndPin : text.emailAndPassword;

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-[1_1_220px]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-3 h-[18px] w-[18px] text-muted"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <label htmlFor="user-search" className="sr-only">
            {text.searchLabel}
          </label>
          <input
            id="user-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={text.searchPlaceholder}
            className={`${field.input} pl-[38px]`}
          />
        </div>
        <div className="min-w-[150px] flex-[0_1_190px]">
          <label htmlFor="user-role" className="sr-only">
            {text.roleLabel}
          </label>
          <select
            id="user-role"
            value={role}
            onChange={(event) => setRole(event.target.value as "" | Role)}
            className={field.input}
          >
            <option value="">{text.allRoles}</option>
            {ROLES.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[130px] flex-[0_1_150px]">
          <label htmlFor="user-status" className="sr-only">
            {text.statusLabel}
          </label>
          <select
            id="user-status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "" | UserRow["status"])
            }
            className={field.input}
          >
            <option value="">{text.allStatuses}</option>
            <option value="active">{text.active}</option>
            <option value="inactive">{text.inactive}</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        {visible.length === 0 ? (
          <div className="px-4 py-7 text-center text-[0.9rem] text-muted">
            <strong className="mb-0.5 block text-[1rem] text-text">
              {text.noMatch}
            </strong>
            {text.noMatchHint}
          </div>
        ) : (
          <>
            {/* Table from tablet width up */}
            <table className="hidden w-full border-collapse md:table">
              <thead>
                <tr className="border-b border-divider bg-[#fafafb] text-left text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-muted">
                  <th className="px-4 py-3">{text.name}</th>
                  <th className="px-4 py-3">{text.role}</th>
                  <th className="px-4 py-3">{text.signIn}</th>
                  <th className="px-4 py-3">{text.outletAccess}</th>
                  <th className="px-4 py-3">{text.status}</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">{text.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-divider text-[0.88rem] last:border-b-0 hover:bg-[#fafafb]"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold">{row.fullName}</div>
                      <div className="text-[0.8rem] text-muted">
                        {signInKind(row)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`${badge.base} ${badge.role}`}>
                        {ROLE_LABELS[row.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row.signIn}</td>
                    <td className="px-4 py-3">{text.allOutlets}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      {renderActions(row)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Cards on phones */}
            <ul className="md:hidden">
              {visible.map((row) => (
                <li
                  key={row.id}
                  className="border-b border-divider px-4 py-3 text-[0.88rem] last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold">{row.fullName}</div>
                      <div className="text-[0.8rem] text-muted">
                        {signInKind(row)}
                      </div>
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-muted">
                      {text.role}
                    </dt>
                    <dd>{ROLE_LABELS[row.role]}</dd>
                    <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-muted">
                      {text.signIn}
                    </dt>
                    <dd className="break-all">{row.signIn}</dd>
                    <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-muted">
                      {text.outletAccess}
                    </dt>
                    <dd>{text.allOutlets}</dd>
                  </dl>
                  {canEdit ? (
                    <div className="mt-2.5">
                      {renderActions(row)}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-divider px-4 py-2.5 text-[0.82rem] text-muted">
          <span>{text.showing(visible.length, rows.length)}</span>
        </div>
      </div>

      <StatusDialog
        target={target}
        onClose={() => setTarget(null)}
        onDone={() => setTarget(null)}
      />
      <DeleteDialog
        target={deleting}
        onClose={() => setDeleting(null)}
        onDone={() => setDeleting(null)}
      />
    </>
  );
}
