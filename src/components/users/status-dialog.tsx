"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { setUserStatus } from "@/lib/users/actions";
import { button } from "@/components/ui/styles";

const text = {
  deactivateTitle: "Deactivate User?",
  activateTitle: "Activate User?",
  deactivateBody:
    "will be signed out and will not be able to sign in. Their history stays in the records. You can activate them again later.",
  activateBody: "will be able to sign in again with their current password.",
  cancel: "Cancel",
  deactivate: "Deactivate",
  activate: "Activate",
  working: "Working...",
} as const;

export type StatusTarget = {
  id: string;
  name: string;
  // The status the user will have after the change.
  next: "active" | "inactive";
};

// Confirmation box for deactivating or activating a user.
export function StatusDialog({
  target,
  onClose,
  onDone,
}: {
  target: StatusTarget | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (target && !dialog.open) {
      setError(null);
      dialog.showModal();
    }
    if (!target && dialog.open) dialog.close();
  }, [target]);

  function confirm() {
    if (!target) return;
    startTransition(async () => {
      const data = new FormData();
      data.set("id", target.id);
      data.set("status", target.next);
      const result = await setUserStatus({ error: null }, data);
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  const deactivating = target?.next === "inactive";

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="status-dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-[480px] rounded-[18px] bg-surface p-5 text-text shadow-card backdrop:bg-black/40"
    >
      <h2
        id="status-dialog-title"
        className="text-[1.15rem] font-semibold tracking-[-0.02em]"
      >
        {deactivating ? text.deactivateTitle : text.activateTitle}
      </h2>
      <p className="mb-4 mt-1 text-[0.88rem] text-muted">
        <strong className="font-semibold text-text">{target?.name}</strong>{" "}
        {deactivating ? text.deactivateBody : text.activateBody}
      </p>
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
          {text.cancel}
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className={deactivating ? button.danger : button.primary}
        >
          {pending
            ? text.working
            : deactivating
              ? text.deactivate
              : text.activate}
        </button>
      </div>
    </dialog>
  );
}
