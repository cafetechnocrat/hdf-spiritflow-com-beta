"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { button, field } from "@/components/ui/styles";
import { resetPassword } from "@/lib/users/actions";

const text = {
  title: "Reset Password?",
  body: "Set a temporary password for",
  body2:
    "Share it with them in person or by phone. They must choose a new password when they next sign in.",
  label: "Temporary Password",
  placeholder: "At least 10 characters",
  cancel: "Cancel",
  reset: "Reset Password",
  working: "Working...",
  done: "Password reset. Share the temporary password with the user.",
  close: "Close",
} as const;

export type ResetTarget = { id: string; name: string };

// Confirmation box for setting a temporary password.
export function ResetPasswordDialog({
  target,
  onClose,
}: {
  target: ResetTarget | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (target && !dialog.open) {
      setError(null);
      setDone(false);
      setPassword("");
      dialog.showModal();
    }
    if (!target && dialog.open) dialog.close();
  }, [target]);

  function confirm() {
    if (!target) return;
    startTransition(async () => {
      const data = new FormData();
      data.set("id", target.id);
      data.set("password", password);
      const result = await resetPassword({ error: null }, data);
      if (result.error) setError(result.error);
      else {
        setError(null);
        setDone(true);
      }
    });
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="reset-dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-[480px] rounded-[18px] bg-surface p-5 text-text shadow-card backdrop:bg-black/40"
    >
      <h2
        id="reset-dialog-title"
        className="text-[1.15rem] font-semibold tracking-[-0.02em]"
      >
        {text.title}
      </h2>
      <p className="mb-3 mt-1 text-[0.88rem] text-muted">
        {text.body}{" "}
        <strong className="font-semibold text-text">{target?.name}</strong>.{" "}
        {text.body2}
      </p>
      {done ? (
        <p className="mb-3 rounded-[10px] bg-success-bg px-3 py-2.5 text-[0.85rem] text-success">
          {text.done}
        </p>
      ) : (
        <div className="mb-3">
          <label htmlFor="reset-password" className={field.label}>
            {text.label}
          </label>
          <input
            id="reset-password"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={text.placeholder}
            className={field.input}
          />
        </div>
      )}
      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-[10px] bg-error-bg px-3 py-2.5 text-[0.85rem] text-error"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className={button.secondary}
        >
          {done ? text.close : text.cancel}
        </button>
        {done ? null : (
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className={button.primary}
          >
            {pending ? text.working : text.reset}
          </button>
        )}
      </div>
    </dialog>
  );
}
