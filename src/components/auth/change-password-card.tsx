"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { changePassword, signOut, type ChangePasswordState } from "@/lib/auth/actions";

const text = {
  forcedTitle: "Set A New Password",
  forcedSub: "Your temporary password must be replaced before you continue.",
  title: "Change Password",
  sub: "Enter your current password, then choose a new one.",
  currentForced: "Temporary Password",
  currentForcedPlaceholder: "Enter the password you were given",
  current: "Current Password",
  currentPlaceholder: "Enter your current password",
  next: "New Password",
  nextPlaceholder: "At least 10 characters",
  confirm: "Confirm New Password",
  confirmPlaceholder: "Type the new password again",
  rulesLabel: "Password Rules",
  rule1: "At least 10 characters",
  rule2: "Different from the current password",
  rule3: "Both new passwords match",
  show: "Show Password",
  hide: "Hide Password",
  save: "Save Password",
  saving: "Saving...",
  signOut: "Sign Out",
  cancel: "Cancel",
  errorTitle: "Could not save.",
  logoAlt: "Spirit Flow",
} as const;

const inputClass =
  "h-11 w-full rounded-xl border border-border-soft bg-field px-3 pr-[46px] text-[0.9rem] text-text transition-[border-color,box-shadow] placeholder:text-muted/75 hover:border-border focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/30";
const labelClass = "mb-[3px] ml-0.5 block text-[0.78rem] font-medium text-muted";

function PasswordField({
  id,
  name,
  label,
  placeholder,
  autoComplete,
  value,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="mb-2">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? text.hide : text.show}
          className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-[10px] text-muted hover:text-text"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-[22px] w-[22px]"
          >
            {shown ? (
              <>
                <path d="M17.9 17.9A10.7 10.7 0 0 1 12 19c-7 0-11-7-11-7a19.8 19.8 0 0 1 5.1-5.9M9.9 5.2A10 10 0 0 1 12 5c7 0 11 7 11 7a19.9 19.9 0 0 1-3.2 4.2M1 1l22 22" />
                <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
              </>
            ) : (
              <>
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>
    </div>
  );
}

function Rule({ ok, children }: { ok: boolean; children: string }) {
  return (
    <li
      className={`flex items-center gap-2 text-[0.8rem] ${ok ? "text-success" : "text-muted"}`}
    >
      <span
        aria-hidden="true"
        className={`grid h-4 w-4 place-items-center rounded-full text-[0.65rem] text-white ${ok ? "bg-success" : "bg-track"}`}
      >
        {ok ? "✓" : ""}
      </span>
      {children}
    </li>
  );
}

// Used for the forced change after a temporary password, and as the normal
// Change Password screen later (forced = false).
export function ChangePasswordCard({ forced }: { forced: boolean }) {
  const baseId = useId();
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(
    changePassword,
    { error: null },
  );
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  return (
    <section
      aria-labelledby={`${baseId}-title`}
      className="relative overflow-hidden w-full max-w-[340px] rounded-2xl bg-surface px-4 pb-4 pt-4 shadow-card sm:rounded-[18px] sm:px-[22px] sm:pt-5"
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-accent via-accent to-brand" />
      <div className="mb-5 mt-1 flex justify-center">
        <Image
          src="/brand/spiritflow-logo-horizontal.png"
          alt={text.logoAlt}
          width={1400}
          height={385}
          sizes="200px"
          priority
          className="h-auto w-[200px]"
        />
      </div>
      <h1
        id={`${baseId}-title`}
        className="text-center text-[1.25rem] font-semibold leading-tight tracking-[-0.02em]"
      >
        {forced ? text.forcedTitle : text.title}
      </h1>
      <p className="mb-3 mt-px text-center text-[0.85rem] text-muted">
        {forced ? text.forcedSub : text.sub}
      </p>

      {state.error ? (
        <div
          role="alert"
          className="mb-3 rounded-[10px] bg-error-bg px-3 py-2.5 text-[0.85rem] text-error"
        >
          <strong className="font-semibold text-text">{text.errorTitle}</strong>{" "}
          <span>{state.error}</span>
        </div>
      ) : null}

      <form action={action} noValidate>
        <PasswordField
          id={`${baseId}-current`}
          name="current"
          label={forced ? text.currentForced : text.current}
          placeholder={forced ? text.currentForcedPlaceholder : text.currentPlaceholder}
          autoComplete="current-password"
          value={current}
          onChange={setCurrent}
        />
        <PasswordField
          id={`${baseId}-next`}
          name="next"
          label={text.next}
          placeholder={text.nextPlaceholder}
          autoComplete="new-password"
          value={next}
          onChange={setNext}
        />
        <PasswordField
          id={`${baseId}-confirm`}
          name="confirm"
          label={text.confirm}
          placeholder={text.confirmPlaceholder}
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
        />
        <ul aria-label={text.rulesLabel} className="mb-3 mt-1 grid gap-1">
          <Rule ok={next.length >= 10}>{text.rule1}</Rule>
          <Rule ok={next.length > 0 && next !== current}>{text.rule2}</Rule>
          <Rule ok={next.length > 0 && next === confirm}>{text.rule3}</Rule>
        </ul>
        <button
          type="submit"
          disabled={pending}
          className="h-11 w-full rounded-xl bg-accent text-[0.95rem] font-semibold tracking-[-0.01em] text-white transition-[background-color,transform] hover:bg-accent-hover active:scale-[0.99] active:bg-accent-press disabled:opacity-70"
        >
          {pending ? text.saving : text.save}
        </button>
      </form>
      {forced ? (
        <form action={signOut}>
          <button
            type="submit"
            className="mt-2 h-11 w-full rounded-xl bg-track text-[0.95rem] font-semibold text-text hover:bg-[#dbe0ec]"
          >
            {text.signOut}
          </button>
        </form>
      ) : (
        <Link
          href="/"
          className="mt-2 grid h-11 w-full place-items-center rounded-xl bg-track text-[0.95rem] font-semibold text-text hover:bg-[#dbe0ec]"
        >
          {text.cancel}
        </Link>
      )}
    </section>
  );
}
