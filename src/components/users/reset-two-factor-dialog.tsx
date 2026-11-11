"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { button } from "@/components/ui/styles";
import { resetTwoFactor } from "@/lib/users/actions";

const text = {
  title: "Reset Two-Factor?",
  body: "will be asked to set up their authenticator app again the next time they sign in. Use this when they lose or change their phone.",
  cancel: "Cancel",
  reset: "Reset Two-Factor",
  working: "Working...",
  done: "Two-factor reset. They will set it up again at next sign in.",
  close: "Close",
} as const;

export type ResetTwoFactorTarget = { id: string; name: string };

export function ResetTwoFactorDialog({
  target,
  onClose,
}: {
  target: ResetTwoFactorTarget | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (target && !dialog.open) {
      setError(null);
      setDone(false);
      dialog.showModal();
    }
    if (!target && dialog.open) dialog.close();
  }, [target]);

  function confirm() {
    if (!target) return;
    startTransition(async () => {
      const data = new FormData();
      data.set("id", target.id);
      const result = await resetTwoFactor({ error: null }, data);
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
      aria-labelledby="reset-mfa-dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-[480px] rounded-[18px] bg-surface p-5 text-text shadow-card backdrop:bg-black/40"
    >
      <h2
        id="reset-mfa-dialog-title"
        className="text-[1.15rem] font-semibold tracking-[-0.02em]"
      >
        {text.title}
      </h2>
      <p className="mb-4 mt-1 text-[0.88rem] text-muted">
        <strong className="font-semibold text-text">{target?.name}</strong> {text.body}
      </p>
      {done ? (
        <p className="mb-3 rounded-[10px] bg-success-bg px-3 py-2.5 text-[0.85rem] text-success">
          {text.done}
        </p>
      ) : null}
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
            className={button.danger}
          >
            {pending ? text.working : text.reset}
          </button>
        )}
      </div>
    </dialog>
  );
}
