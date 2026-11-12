"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { FormEvent, ReactNode } from "react";
import { ErrorLine, Modal, SelectField, TextField } from "@/components/ui/admin-parts";
import { button, field } from "@/components/ui/styles";
import {
  createRole,
  deleteRole,
  setRoleAccess,
  setRoleSwitch,
  updateRole,
} from "@/lib/roles/actions";
import type { RoleResult } from "@/lib/roles/schemas";
import {
  NO_ACCESS,
  type AccessFlags,
  type FeatureRow,
  type RoleAccessMap,
  type RoleRow,
  type RolesData,
} from "@/lib/roles/types";

// All visible text sits here so it can be translated later.
const text = {
  addRole: "Add Role",
  note: "The System Admin role is built in. It always has full access and cannot be renamed, deleted or reduced, so you can never lock yourself out. Only its two-factor switch can be changed. Every other role can be renamed, and deleted when no user has it.",
  hint: "Click a cell and tick View, Edit and Delete, or Select All. Edit and Delete need View, so ticking either ticks View. A feature offers only the actions that apply to it.",
  feature: "Feature",
  roleSettings: "Role Settings",
  roleActive: "Role Active",
  roleActiveHint: "A role that is not active cannot sign in.",
  twoFactor: "Require Two-Factor",
  twoFactorHint: "An authenticator code at each sign in.",
  signIn: "Sign In Method",
  signInHint: "Set when the role is created or edited.",
  email: "Email And Password",
  pin: "Username And PIN",
  locked: "Locked. Full access",
  user: "user",
  users: "users",
  edit: "Edit",
  none: "None",
  all: "All",
  allowed: "Allowed",
  view: "View",
  editAction: "Edit",
  deleteAction: "Delete",
  selectAll: "Select All",
  saved: "Saved",
  roleLabel: "Role",
  noUsers: "No users have this role.",
  // Dialogs
  addTitle: "Add Role",
  addSub: "A new role starts switched off. Switch it on when it is ready.",
  editTitle: "Edit Role",
  roleName: "Role Name",
  roleNamePlaceholder: "For example Stock Keeper",
  signInLabel: "Sign In Method",
  signInDialogHint: "Username And PIN is for counter staff who sign in at a billing counter.",
  copyFrom: "Copy Access From",
  copyNone: "Start With No Access",
  copyHint: "You can change every box afterwards.",
  cancel: "Cancel",
  save: "Save Role",
  saving: "Saving...",
  deleteRole: "Delete Role",
  deleting: "Deleting...",
  deleteOk:
    "No user has this role, so it can be deleted. If users had it, it could not be deleted until they were moved to another role.",
  deleteBlocked: (count: number) =>
    `This role cannot be deleted while ${count} ${count === 1 ? "user has" : "users have"} it. Move them to another role on the Users screen first.`,
} as const;

type Action = "view" | "edit" | "delete";
const ACTION_LABEL: Record<Action, string> = {
  view: text.view,
  edit: text.editAction,
  delete: text.deleteAction,
};

function offered(feature: FeatureRow): Action[] {
  const list: Action[] = [];
  if (feature.offersView) list.push("view");
  if (feature.offersEdit) list.push("edit");
  if (feature.offersDelete) list.push("delete");
  return list;
}

function chosenOf(flags: AccessFlags, actions: Action[]): Action[] {
  return actions.filter((action) => flags[action]);
}

// What the cell shows: None, All, or the ticked actions.
function summary(chosen: Action[], actions: Action[]): string {
  if (chosen.length === 0) return text.none;
  if (actions.length === 1) {
    return actions[0] === "edit" ? text.allowed : ACTION_LABEL[actions[0]];
  }
  if (chosen.length === actions.length) return text.all;
  return actions
    .filter((action) => chosen.includes(action))
    .map((action) => ACTION_LABEL[action])
    .join(", ");
}

// Edit and Delete need View. Ticking either ticks View. Unticking View clears them.
function nextFlags(current: AccessFlags, action: Action | "all", on: boolean, feature: FeatureRow): AccessFlags {
  const actions = offered(feature);
  const next: AccessFlags = { ...current };
  if (action === "all") {
    for (const a of actions) next[a] = on;
    return next;
  }
  next[action] = on;
  if (feature.offersView) {
    if (on && action !== "view") next.view = true;
    if (!on && action === "view") {
      next.edit = false;
      next.delete = false;
    }
  }
  return next;
}

function Switch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="relative inline-block h-[26px] w-11">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer absolute inset-0 z-10 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span className="absolute inset-0 rounded-full bg-track transition-colors peer-checked:bg-accent peer-disabled:opacity-60" />
      <span className="absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform peer-checked:translate-x-[18px]" />
      <span className="sr-only">{label}</span>
    </label>
  );
}

type OpenMenu = { roleId: string; feature: FeatureRow; top: number; left: number };

function AccessButton({
  feature,
  flags,
  locked,
  label,
  onOpen,
}: {
  feature: FeatureRow;
  flags: AccessFlags;
  locked: boolean;
  label: string;
  onOpen: (rect: DOMRect) => void;
}) {
  const actions = offered(feature);
  const chosen = chosenOf(flags, actions);
  const tone =
    chosen.length === 0
      ? "text-muted"
      : chosen.length === actions.length
        ? "border-transparent bg-success-bg font-semibold text-success"
        : "border-transparent bg-accent-soft font-semibold text-link";
  return (
    <button
      type="button"
      disabled={locked}
      aria-haspopup="true"
      aria-label={label}
      onClick={(event) => onOpen(event.currentTarget.getBoundingClientRect())}
      className={`min-h-9 min-w-[104px] whitespace-nowrap rounded-[9px] border border-border-soft bg-surface px-2.5 pr-6 text-[0.82rem] disabled:cursor-not-allowed disabled:opacity-75 ${tone}`}
    >
      {locked ? text.all : summary(chosen, actions)}
    </button>
  );
}

function AddRoleDialog({ roles, onClose }: { roles: RoleRow[]; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result: RoleResult = await createRole({ error: null }, formData);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <Modal title={text.addTitle} subtitle={text.addSub} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate>
        <TextField
          label={text.roleName}
          name="name"
          defaultValue=""
          placeholder={text.roleNamePlaceholder}
        />
        <SelectField
          label={text.signInLabel}
          name="signInMethod"
          defaultValue="email"
          required={false}
          hint={text.signInDialogHint}
        >
          <option value="email">{text.email}</option>
          <option value="pin">{text.pin}</option>
        </SelectField>
        <SelectField
          label={text.copyFrom}
          name="copyFromId"
          defaultValue=""
          required={false}
          hint={text.copyHint}
        >
          <option value="">{text.copyNone}</option>
          {roles
            .filter((role) => !role.isSystem)
            .map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
        </SelectField>
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

function EditRoleDialog({ role, onClose }: { role: RoleRow; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result: RoleResult = await updateRole({ error: null }, formData);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  function remove() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", role.id);
      const result = await deleteRole({ error: null }, formData);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  const inUse = role.userCount > 0;
  return (
    <Modal
      title={text.editTitle}
      subtitle={`${role.name}. ${
        inUse
          ? `${role.userCount} ${role.userCount === 1 ? text.user : text.users}`
          : text.noUsers
      }`}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} noValidate>
        <input type="hidden" name="id" value={role.id} />
        <TextField label={text.roleName} name="name" defaultValue={role.name} />
        <SelectField
          label={text.signInLabel}
          name="signInMethod"
          defaultValue={role.signInMethod}
          required={false}
        >
          <option value="email">{text.email}</option>
          <option value="pin">{text.pin}</option>
        </SelectField>
        <p
          className={`mb-3 rounded-xl px-3 py-2.5 text-[0.84rem] ${
            inUse ? "bg-warn-bg text-warn" : "bg-success-bg text-success"
          }`}
        >
          {inUse ? text.deleteBlocked(role.userCount) : text.deleteOk}
        </p>
        <ErrorLine message={error} />
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!inUse ? (
            confirming ? (
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className={`${button.danger} mr-auto`}
              >
                {pending ? text.deleting : `${text.deleteRole}?`}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className={`${button.danger} mr-auto`}
              >
                {text.deleteRole}
              </button>
            )
          ) : null}
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

export function RolesManager({ data }: { data: RolesData }) {
  const [roles, setRoles] = useState<RoleRow[]>(data.roles);
  const [access, setAccess] = useState<RoleAccessMap>(data.access);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [phoneRoleId, setPhoneRoleId] = useState(
    data.roles.find((role) => !role.isSystem)?.id ?? data.roles[0]?.id ?? "",
  );
  const [, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const roleSelectId = useId();

  // When the server sends fresh data, show it.
  const fingerprint = JSON.stringify([data.roles, data.access]);
  const [seen, setSeen] = useState(fingerprint);
  if (seen !== fingerprint) {
    setSeen(fingerprint);
    setRoles(data.roles);
    setAccess(data.access);
  }

  // Close the checkbox panel on an outside click, Escape or scroll.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (!target.closest("[aria-haspopup='true']")) close();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  function flash() {
    setNotice(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNotice(false), 1400);
  }

  function flagsFor(roleId: string, key: string): AccessFlags {
    return access[roleId]?.[key] ?? NO_ACCESS;
  }

  function changeAccess(roleId: string, feature: FeatureRow, action: Action | "all", on: boolean) {
    const next = nextFlags(flagsFor(roleId, feature.key), action, on, feature);
    const before = access;
    setAccess({ ...access, [roleId]: { ...access[roleId], [feature.key]: next } });
    setMessage(null);
    startTransition(async () => {
      const result = await setRoleAccess({
        roleId,
        featureKey: feature.key,
        view: next.view,
        edit: next.edit,
        delete: next.delete,
      });
      if (result.error) {
        setAccess(before);
        setMessage(result.error);
      } else {
        flash();
      }
    });
  }

  function changeSwitch(role: RoleRow, kind: "active" | "two_factor", value: boolean) {
    const before = roles;
    setRoles(
      roles.map((r) =>
        r.id === role.id
          ? { ...r, ...(kind === "active" ? { isActive: value } : { requiresTwoFactor: value }) }
          : r,
      ),
    );
    setMessage(null);
    startTransition(async () => {
      const result = await setRoleSwitch({ id: role.id, kind, value });
      if (result.error) {
        setRoles(before);
        setMessage(result.error);
      } else {
        flash();
      }
    });
  }

  function openMenu(roleId: string, feature: FeatureRow, rect: DOMRect) {
    if (menu && menu.roleId === roleId && menu.feature.key === feature.key) {
      setMenu(null);
      return;
    }
    // The panel sits under the button and stays on the screen.
    const height = 44 * (offered(feature).length + (offered(feature).length > 1 ? 1 : 0)) + 16;
    setMenu({
      roleId,
      feature,
      top: Math.min(rect.bottom + 4, window.innerHeight - height - 8),
      left: Math.min(rect.left, window.innerWidth - 184),
    });
  }

  const groups: { label: string; features: FeatureRow[] }[] = [];
  for (const feature of data.features) {
    const last = groups[groups.length - 1];
    if (last && last.label === feature.group) last.features.push(feature);
    else groups.push({ label: feature.group, features: [feature] });
  }

  const phoneRole = roles.find((role) => role.id === phoneRoleId) ?? roles[0];
  const columns = roles.length + 1;

  const roleCount = (role: RoleRow) =>
    `${role.userCount} ${role.userCount === 1 ? text.user : text.users}`;

  const signInLabel = (role: RoleRow) => (role.signInMethod === "pin" ? text.pin : text.email);

  function renderAccessCell(role: RoleRow, feature: FeatureRow): ReactNode {
    const flags = role.isSystem
      ? { view: true, edit: true, delete: true }
      : flagsFor(role.id, feature.key);
    return (
      <AccessButton
        feature={feature}
        flags={flags}
        locked={role.isSystem}
        label={`${feature.label}, ${role.name}`}
        onOpen={(rect) => openMenu(role.id, feature, rect)}
      />
    );
  }

  const menuFlags = menu ? flagsFor(menu.roleId, menu.feature.key) : NO_ACCESS;
  const menuActions = menu ? offered(menu.feature) : [];

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button type="button" onClick={() => setAdding(true)} className={button.primary}>
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
          {text.addRole}
        </button>
      </div>

      <p className="mb-3 rounded-xl bg-accent-soft px-3 py-2.5 text-[0.84rem] text-link">{text.note}</p>

      {message ? <ErrorLine message={message} /> : null}

      {/* Wide screens: one grid for every role. */}
      <div className="hidden overflow-hidden rounded-2xl bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.05)] min-[900px]:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-separate border-spacing-0 text-[0.86rem]">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-[2] min-w-[230px] border-b border-divider bg-[#fafafb] px-3.5 py-2.5 text-left text-[0.74rem] font-semibold text-muted">
                  {text.feature}
                </th>
                {roles.map((role) => (
                  <th
                    key={role.id}
                    className="sticky top-0 border-b border-divider bg-[#fafafb] px-2 py-2.5 align-top text-[0.78rem] font-semibold"
                  >
                    {role.name}
                    {role.isSystem ? (
                      <div className="text-[0.66rem] font-medium text-warn">{text.locked}</div>
                    ) : null}
                    <div className="text-[0.72rem] font-normal text-muted">{roleCount(role)}</div>
                    {!role.isSystem ? (
                      <button
                        type="button"
                        onClick={() => setEditing(role)}
                        className="mt-0.5 text-[0.74rem] font-medium text-link"
                      >
                        {text.edit}
                      </button>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={columns}
                  className="bg-[#f3f3f6] px-3.5 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-muted"
                >
                  {text.roleSettings}
                </td>
              </tr>
              <tr>
                <td className="sticky left-0 z-[1] border-b border-divider bg-surface px-3.5 py-2 font-semibold">
                  {text.roleActive}
                  <div className="text-[0.74rem] font-normal text-muted">{text.roleActiveHint}</div>
                </td>
                {roles.map((role) => (
                  <td key={role.id} className="border-b border-divider px-2 py-2 text-center">
                    <Switch
                      checked={role.isActive}
                      disabled={role.isSystem}
                      label={`${text.roleActive}, ${role.name}`}
                      onChange={(value) => changeSwitch(role, "active", value)}
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="sticky left-0 z-[1] border-b border-divider bg-surface px-3.5 py-2 font-semibold">
                  {text.twoFactor}
                  <div className="text-[0.74rem] font-normal text-muted">{text.twoFactorHint}</div>
                </td>
                {roles.map((role) => (
                  <td key={role.id} className="border-b border-divider px-2 py-2 text-center">
                    <Switch
                      checked={role.requiresTwoFactor}
                      label={`${text.twoFactor}, ${role.name}`}
                      onChange={(value) => changeSwitch(role, "two_factor", value)}
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="sticky left-0 z-[1] border-b border-divider bg-surface px-3.5 py-2 font-semibold">
                  {text.signIn}
                  <div className="text-[0.74rem] font-normal text-muted">{text.signInHint}</div>
                </td>
                {roles.map((role) => (
                  <td
                    key={role.id}
                    className="border-b border-divider px-2 py-2 text-center text-[0.78rem] text-muted"
                  >
                    {signInLabel(role)}
                  </td>
                ))}
              </tr>
              {groups.map((group) => (
                <FeatureGroup
                  key={group.label}
                  label={group.label}
                  columns={columns}
                  features={group.features}
                  roles={roles}
                  render={renderAccessCell}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-2 hidden text-[0.8rem] text-muted min-[900px]:block">{text.hint}</p>

      {/* Phones: one role at a time. */}
      <div className="min-[900px]:hidden">
        <div className="mb-3 max-w-[320px]">
          <label htmlFor={roleSelectId} className={field.label}>
            {text.roleLabel}
          </label>
          <select
            id={roleSelectId}
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
            <PhoneRow>
              <div>
                <strong className="font-semibold">{roleCount(phoneRole)}</strong>
              </div>
              {!phoneRole.isSystem ? (
                <button
                  type="button"
                  onClick={() => setEditing(phoneRole)}
                  className={`${button.secondary} ${button.small}`}
                >
                  {text.edit} {text.roleLabel}
                </button>
              ) : (
                <span className="text-[0.74rem] font-medium text-warn">{text.locked}</span>
              )}
            </PhoneRow>
            <PhoneRow>
              <div>
                <strong className="font-semibold">{text.roleActive}</strong>
                <div className="text-[0.74rem] text-muted">{text.roleActiveHint}</div>
              </div>
              <Switch
                checked={phoneRole.isActive}
                disabled={phoneRole.isSystem}
                label={text.roleActive}
                onChange={(value) => changeSwitch(phoneRole, "active", value)}
              />
            </PhoneRow>
            <PhoneRow>
              <div>
                <strong className="font-semibold">{text.twoFactor}</strong>
                <div className="text-[0.74rem] text-muted">{text.twoFactorHint}</div>
              </div>
              <Switch
                checked={phoneRole.requiresTwoFactor}
                label={text.twoFactor}
                onChange={(value) => changeSwitch(phoneRole, "two_factor", value)}
              />
            </PhoneRow>
            <PhoneRow>
              <strong className="font-semibold">{text.signIn}</strong>
              <span className="text-[0.78rem] text-muted">{signInLabel(phoneRole)}</span>
            </PhoneRow>
            {groups.map((group) => (
              <div key={group.label}>
                <div className="px-4 pb-1 pt-3 text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-muted">
                  {group.label}
                </div>
                {group.features.map((feature) => (
                  <PhoneRow key={feature.key}>
                    <strong className="font-semibold">{feature.label}</strong>
                    {renderAccessCell(phoneRole, feature)}
                  </PhoneRow>
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {menu ? (
        <div
          ref={menuRef}
          role="group"
          aria-label={menu.feature.label}
          style={{ top: menu.top, left: menu.left }}
          className="fixed z-[70] min-w-[168px] rounded-xl bg-surface p-1.5 text-left shadow-card"
        >
          {menuActions.length > 1 ? (
            <label className="mb-0.5 flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border-b border-divider px-2.5 text-[0.88rem] font-semibold hover:bg-background">
              <input
                type="checkbox"
                checked={menuActions.every((action) => menuFlags[action])}
                onChange={(event) =>
                  changeAccess(menu.roleId, menu.feature, "all", event.target.checked)
                }
                className="h-[18px] w-[18px]"
              />
              {text.selectAll}
            </label>
          ) : null}
          {menuActions.map((action) => (
            <label
              key={action}
              className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[0.88rem] hover:bg-background"
            >
              <input
                type="checkbox"
                checked={menuFlags[action]}
                onChange={(event) =>
                  changeAccess(menu.roleId, menu.feature, action, event.target.checked)
                }
                className="h-[18px] w-[18px]"
              />
              {menuActions.length === 1 && action === "edit" ? text.allowed : ACTION_LABEL[action]}
            </label>
          ))}
        </div>
      ) : null}

      <div
        role="status"
        className={`pointer-events-none fixed bottom-4 right-4 z-[60] rounded-xl bg-[#1D1D1F] px-3.5 py-2 text-[0.84rem] text-white transition-opacity ${
          notice ? "opacity-100" : "opacity-0"
        }`}
      >
        {notice ? text.saved : ""}
      </div>

      {adding ? <AddRoleDialog roles={roles} onClose={() => setAdding(false)} /> : null}
      {editing ? (
        <EditRoleDialog key={editing.id} role={editing} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}

function PhoneRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-divider px-4 py-2.5 text-[0.88rem] first:border-t-0">
      {children}
    </div>
  );
}

function FeatureGroup({
  label,
  columns,
  features,
  roles,
  render,
}: {
  label: string;
  columns: number;
  features: FeatureRow[];
  roles: RoleRow[];
  render: (role: RoleRow, feature: FeatureRow) => ReactNode;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={columns}
          className="bg-[#f3f3f6] px-3.5 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-muted"
        >
          {label}
        </td>
      </tr>
      {features.map((feature) => (
        <tr key={feature.key}>
          <td className="sticky left-0 z-[1] border-b border-divider bg-surface px-3.5 py-2 font-semibold">
            {feature.label}
          </td>
          {roles.map((role) => (
            <td key={role.id} className="border-b border-divider px-2 py-2 text-center">
              {render(role, feature)}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
