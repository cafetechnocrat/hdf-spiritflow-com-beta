"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { button, field } from "@/components/ui/styles";
import type { FeatureRow, RoleAccessMap, RoleRow } from "@/lib/roles/types";

// All visible text sits here so it can be translated later.
const text = {
  intro:
    "A lock hides the figures. People still see the report or card in its place, with a message that it is locked. The System Admin is always open and cannot be locked. Locking is by role here. To lock one person inside a role, use the Access section on that person's Edit User screen.",
  report: "Report Or Card",
  allRoles: "All Roles",
  open: "Open",
  locked: "Locked",
  lock: "Lock",
  lockAll: "Lock All",
  openAll: "Open All",
  lockOrOpenAll: "Lock Or Unlock All",
  roleLabel: "Role",
  adminOpen: "Always open",
  user: "user",
  users: "users",
} as const;

type SetLocks = (
  roleIds: string[],
  featureKeys: string[],
  open: boolean,
) => void;

function LockIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 118 0v3" />
    </svg>
  );
}

// One Lock or Open button. The button shows the current state and flips it.
function StateButton({
  open,
  disabled,
  label,
  onToggle,
}: {
  open: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={!open}
      aria-label={label}
      onClick={onToggle}
      className={`inline-flex min-h-9 min-w-[88px] items-center justify-center gap-1.5 rounded-[9px] border px-2.5 text-[0.82rem] disabled:cursor-not-allowed disabled:opacity-75 ${
        open
          ? "border-transparent bg-success-bg font-semibold text-success"
          : "border-border-soft bg-surface text-muted"
      }`}
    >
      {open ? null : <LockIcon />}
      {open ? text.open : text.locked}
    </button>
  );
}

function groupsOf(
  features: FeatureRow[],
): { label: string; features: FeatureRow[] }[] {
  const groups: { label: string; features: FeatureRow[] }[] = [];
  for (const feature of features) {
    const last = groups[groups.length - 1];
    if (last && last.label === feature.group) last.features.push(feature);
    else groups.push({ label: feature.group, features: [feature] });
  }
  return groups;
}

export function LocksPanel({
  roles,
  features,
  access,
  onSet,
}: {
  roles: RoleRow[];
  features: FeatureRow[];
  access: RoleAccessMap;
  onSet: SetLocks;
}) {
  const [phoneRoleId, setPhoneRoleId] = useState(
    roles.find((role) => !role.isSystem)?.id ?? roles[0]?.id ?? "",
  );
  const selectId = useId();

  const groups = groupsOf(features);
  const keys = features.map((feature) => feature.key);
  const editable = roles.filter((role) => !role.isSystem);
  const isOpen = (role: RoleRow, key: string) =>
    role.isSystem || access[role.id]?.[key]?.view === true;
  const allOpen = (role: RoleRow) => keys.every((key) => isOpen(role, key));
  const phoneRole = roles.find((role) => role.id === phoneRoleId) ?? roles[0];
  const columns = roles.length + 2;
  const count = (role: RoleRow) =>
    `${role.userCount} ${role.userCount === 1 ? text.user : text.users}`;

  return (
    <>
      <p className="mb-3 rounded-xl bg-accent-soft px-3 py-2.5 text-[0.84rem] text-link">
        {text.intro}
      </p>

      {/* Wide screens: reports and cards down the side, roles across the top. */}
      <div className="hidden overflow-hidden rounded-2xl bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.05)] min-[900px]:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-separate border-spacing-0 text-[0.86rem]">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-[2] min-w-[230px] border-b border-divider bg-[#f8f9fc] px-3.5 py-2.5 text-left text-[0.74rem] font-semibold text-muted">
                  {text.report}
                </th>
                {roles.map((role) => (
                  <th
                    key={role.id}
                    className="sticky top-0 border-b border-divider bg-[#f8f9fc] px-2 py-2.5 align-top text-[0.78rem] font-semibold"
                  >
                    {role.name}
                    <div className="text-[0.72rem] font-normal text-muted">
                      {count(role)}
                    </div>
                    {role.isSystem ? (
                      <div className="text-[0.66rem] font-medium text-warn">
                        {text.adminOpen}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSet([role.id], keys, !allOpen(role))}
                        className="mt-0.5 text-[0.74rem] font-medium text-link"
                      >
                        {allOpen(role) ? text.lockAll : text.openAll}
                      </button>
                    )}
                  </th>
                ))}
                <th className="sticky top-0 border-b border-divider bg-[#f8f9fc] px-2 py-2.5 text-[0.78rem] font-semibold">
                  {text.allRoles}
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <GroupRows
                  key={group.label}
                  label={group.label}
                  columns={columns}
                >
                  {group.features.map((feature) => (
                    <tr key={feature.key}>
                      <td className="sticky left-0 z-[1] border-b border-divider bg-surface px-3.5 py-2 font-semibold">
                        {feature.label}
                      </td>
                      {roles.map((role) => (
                        <td
                          key={role.id}
                          className="border-b border-divider px-2 py-2 text-center"
                        >
                          <StateButton
                            open={isOpen(role, feature.key)}
                            disabled={role.isSystem}
                            label={`${feature.label}, ${role.name}`}
                            onToggle={() =>
                              onSet(
                                [role.id],
                                [feature.key],
                                !isOpen(role, feature.key),
                              )
                            }
                          />
                        </td>
                      ))}
                      <td className="border-b border-divider px-2 py-2 text-center">
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              onSet(
                                editable.map((r) => r.id),
                                [feature.key],
                                false,
                              )
                            }
                            className={`${button.secondary} ${button.small}`}
                          >
                            {text.lock}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onSet(
                                editable.map((r) => r.id),
                                [feature.key],
                                true,
                              )
                            }
                            className={`${button.secondary} ${button.small}`}
                          >
                            {text.open}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </GroupRows>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phones: one role at a time. */}
      <div className="min-[900px]:hidden">
        <div className="mb-3 max-w-[320px]">
          <label htmlFor={selectId} className={field.label}>
            {text.roleLabel}
          </label>
          <select
            id={selectId}
            value={phoneRole?.id ?? ""}
            onChange={(event) => setPhoneRoleId(event.target.value)}
            className={field.input}
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
        {phoneRole ? (
          <div className="overflow-hidden rounded-2xl bg-surface py-1 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-[0.88rem]">
              <strong className="font-semibold">{count(phoneRole)}</strong>
              {phoneRole.isSystem ? (
                <span className="text-[0.74rem] font-medium text-warn">
                  {text.adminOpen}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onSet([phoneRole.id], keys, !allOpen(phoneRole))
                  }
                  className={`${button.secondary} ${button.small}`}
                >
                  {text.lockOrOpenAll}
                </button>
              )}
            </div>
            {groups.map((group) => (
              <div key={group.label}>
                <div className="px-4 pb-1 pt-3 text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-muted">
                  {group.label}
                </div>
                {group.features.map((feature) => (
                  <div
                    key={feature.key}
                    className="flex items-center justify-between gap-3 border-t border-divider px-4 py-2.5 text-[0.88rem] first:border-t-0"
                  >
                    <strong className="font-semibold">{feature.label}</strong>
                    <StateButton
                      open={isOpen(phoneRole, feature.key)}
                      disabled={phoneRole.isSystem}
                      label={`${feature.label}, ${phoneRole.name}`}
                      onToggle={() =>
                        onSet(
                          [phoneRole.id],
                          [feature.key],
                          !isOpen(phoneRole, feature.key),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}

function GroupRows({
  label,
  columns,
  children,
}: {
  label: string;
  columns: number;
  children: ReactNode;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={columns}
          className="bg-[#eff1f7] px-3.5 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-muted"
        >
          {label}
        </td>
      </tr>
      {children}
    </>
  );
}
