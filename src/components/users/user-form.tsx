"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { badge, button, field } from "@/components/ui/styles";
import type { RoleOption } from "@/lib/users/queries";
import { createUser, updateUser } from "@/lib/users/actions";
import type { UserFormState } from "@/lib/users/schemas";
import { DeleteDialog, type DeleteTarget } from "./delete-dialog";
import { ResetPasswordDialog, type ResetTarget } from "./reset-password-dialog";
import {
  ResetTwoFactorDialog,
  type ResetTwoFactorTarget,
} from "./reset-two-factor-dialog";
import { StatusDialog, type StatusTarget } from "./status-dialog";

const text = {
  details: "Details",
  fullName: "Full Name",
  fullNamePlaceholder: "Enter full name",
  phone: "Phone Number",
  phonePlaceholder: "Optional",
  role: "Role",
  signIn: "Sign In",
  email: "Email Address",
  emailPlaceholder: "username@spiritflowhdf.com",
  emailHint: "Used to sign in. Use the format username@spiritflowhdf.com.",
  emailLocked: "The email address cannot be changed here.",
  password: "Temporary Password",
  passwordPlaceholder: "At least 10 characters",
  passwordHint:
    "Share it with the user in person or by phone. They should change it after they first sign in.",
  twoFactorNote:
    "This role signs in with an authenticator app as well. They set it up the first time they sign in.",
  outletAccess: "Outlet Access",
  allOutlets: "Can see all outlets.",
  outletHint:
    "Cashiers are the only role limited to one outlet and counter. They are added in a later release.",
  statusAndSecurity: "Status And Security",
  status: "Status",
  active: "Active",
  inactive: "Inactive",
  deactivate: "Deactivate User",
  activate: "Activate User",
  delete: "Delete User",
  resetPassword: "Reset Password",
  resetTwoFactor: "Reset Two-Factor",
  statusHint:
    "Deactivating signs the user out and blocks sign in. Records and history are kept. A deactivated user can be deleted permanently.",
  cancel: "Cancel",
  create: "Create User",
  save: "Save Changes",
  saving: "Saving...",
  errorTitle: "Could not save.",
  cashierNote:
    "This user is a Cashier. Cashier changes are added together with outlets and counters.",
} as const;

type Props =
  | { mode: "create"; roles: RoleOption[] }
  | {
      mode: "edit";
      roles: RoleOption[];
      currentUserId: string;
      user: {
        id: string;
        fullName: string;
        phone: string;
        roleId: string;
        requiresTwoFactor: boolean;
        signInMethod: "email" | "pin";
        email: string;
        status: "active" | "inactive";
      };
    };

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-divider px-[18px] pb-1.5 pt-[18px] last:border-b-0">
      <h2 className="mb-3 text-base font-semibold tracking-[-0.01em]">{title}</h2>
      {children}
    </div>
  );
}

export function UserForm(props: Props) {
  const router = useRouter();
  const editing = props.mode === "edit";
  const user = props.mode === "edit" ? props.user : null;
  const currentUserId = props.mode === "edit" ? props.currentUserId : "";

  const initial: UserFormState = {
    error: null,
    values: {
      fullName: user?.fullName ?? "",
      phone: user?.phone ?? "",
      role: user?.roleId ?? props.roles[0]?.id ?? "",
      email: user?.email ?? "",
    },
  };
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(
    editing ? updateUser : createUser,
    initial,
  );
  const [role, setRole] = useState<string>(initial.values.role);
  const [target, setTarget] = useState<StatusTarget | null>(null);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const [resetting, setResetting] = useState<ResetTarget | null>(null);
  const [resettingMfa, setResettingMfa] = useState<ResetTwoFactorTarget | null>(null);

  // A role that signs in with a PIN is added with the cashier login.
  const isCashier = user?.signInMethod === "pin";
  const roleOptions = props.roles;
  const chosenRole = roleOptions.find((option) => option.id === role);

  return (
    <>
      <form
        action={formAction}
        noValidate
        className="max-w-[720px] overflow-hidden rounded-2xl bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
      >
        {user ? <input type="hidden" name="id" value={user.id} /> : null}

        {state.error ? (
          <div
            role="alert"
            className="m-[18px] mb-0 flex items-start gap-2 rounded-[10px] bg-error-bg px-3 py-2.5 text-[0.85rem] text-error"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="mt-px h-5 w-5 flex-none"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v5M12 16h.01" />
            </svg>
            <div>
              <strong className="font-semibold text-text">{text.errorTitle}</strong>{" "}
              <span>{state.error}</span>
            </div>
          </div>
        ) : null}

        <Section title={text.details}>
          {isCashier ? (
            <p className="mb-3.5 rounded-xl bg-warn-bg px-3.5 py-3 text-[0.85rem]">
              {text.cashierNote}
            </p>
          ) : null}
          <div className="grid gap-x-4 sm:grid-cols-2">
            <div className="mb-3.5">
              <label htmlFor="fullName" className={field.label}>
                {text.fullName} <span className="text-error">*</span>
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="off"
                defaultValue={state.values.fullName}
                placeholder={text.fullNamePlaceholder}
                className={field.input}
              />
            </div>
            <div className="mb-3.5">
              <label htmlFor="phone" className={field.label}>
                {text.phone}
              </label>
              <input
                id="phone"
                name="phone"
                type="text"
                inputMode="tel"
                autoComplete="off"
                defaultValue={state.values.phone}
                placeholder={text.phonePlaceholder}
                className={field.input}
              />
            </div>
          </div>
          <div className="mb-3.5">
            <label htmlFor="role" className={field.label}>
              {text.role} <span className="text-error">*</span>
            </label>
            <select
              id="role"
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              disabled={isCashier}
              className={`${field.input} appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='12'%20height='8'%20viewBox='0%200%2012%208'%20fill='none'%20stroke='%236E6E73'%20stroke-width='1.8'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpath%20d='M1%201.5l5%205%205-5'/%3E%3C/svg%3E")] bg-[length:12px_8px] bg-[position:right_12px_center] bg-no-repeat pr-[34px]`}
            >
              {roleOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            {isCashier ? <input type="hidden" name="role" value={role} /> : null}
          </div>
        </Section>

        <Section title={text.signIn}>
          <div className="mb-3.5">
            <label htmlFor="email" className={field.label}>
              {text.email} <span className="text-error">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              readOnly={editing}
              defaultValue={state.values.email}
              placeholder={text.emailPlaceholder}
              className={field.input}
            />
            <p className={field.hint}>{editing ? text.emailLocked : text.emailHint}</p>
          </div>
          {!editing ? (
            <div className="mb-3.5">
              <label htmlFor="password" className={field.label}>
                {text.password} <span className="text-error">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="text"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={text.passwordPlaceholder}
                className={field.input}
              />
              <p className={field.hint}>{text.passwordHint}</p>
            </div>
          ) : null}
          {chosenRole?.requiresTwoFactor ? (
            <p className="mb-3.5 rounded-xl bg-accent-soft px-3.5 py-3 text-[0.85rem]">
              {text.twoFactorNote}
            </p>
          ) : null}
        </Section>

        <Section title={text.outletAccess}>
          <div className="mb-3.5">
            <p className="text-[0.9rem]">{text.allOutlets}</p>
            <p className={field.hint}>{text.outletHint}</p>
          </div>
        </Section>

        {user ? (
          <Section title={text.statusAndSecurity}>
            <div className="mb-3.5">
              <span className={field.label}>{text.status}</span>
              <span
                className={`${badge.base} ${user.status === "active" ? badge.ok : badge.off}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                {user.status === "active" ? text.active : text.inactive}
              </span>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {user.status === "active" && user.id !== currentUserId ? (
                <button
                  type="button"
                  onClick={() => setResetting({ id: user.id, name: user.fullName })}
                  className={`${button.secondary} ${button.small}`}
                >
                  {text.resetPassword}
                </button>
              ) : null}
              {user.status === "active" &&
              user.id !== currentUserId &&
              user.requiresTwoFactor ? (
                <button
                  type="button"
                  onClick={() => setResettingMfa({ id: user.id, name: user.fullName })}
                  className={`${button.secondary} ${button.small}`}
                >
                  {text.resetTwoFactor}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  setTarget({
                    id: user.id,
                    name: user.fullName,
                    next: user.status === "active" ? "inactive" : "active",
                  })
                }
                className={`${user.status === "active" ? button.danger : button.secondary} ${button.small}`}
              >
                {user.status === "active" ? text.deactivate : text.activate}
              </button>
              {user.status === "inactive" ? (
                <button
                  type="button"
                  onClick={() => setDeleting({ id: user.id, name: user.fullName })}
                  className={`${button.danger} ${button.small}`}
                >
                  {text.delete}
                </button>
              ) : null}
            </div>
            <p className={`${field.hint} mb-3.5`}>{text.statusHint}</p>
          </Section>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 border-t border-divider bg-[#fafafb] px-[18px] py-4">
          <Link href="/users" className={button.secondary}>
            {text.cancel}
          </Link>
          <button type="submit" disabled={pending} className={button.primary}>
            {pending ? text.saving : editing ? text.save : text.create}
          </button>
        </div>
      </form>

      <ResetPasswordDialog
        target={resetting}
        onClose={() => setResetting(null)}
      />
      <ResetTwoFactorDialog
        target={resettingMfa}
        onClose={() => setResettingMfa(null)}
      />
      <StatusDialog
        target={target}
        onClose={() => setTarget(null)}
        onDone={() => router.push("/users")}
      />
      <DeleteDialog
        target={deleting}
        onClose={() => setDeleting(null)}
        onDone={() => router.push("/users")}
      />
    </>
  );
}
