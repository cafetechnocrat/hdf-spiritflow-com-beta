"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { button, field } from "@/components/ui/styles";
import { deleteUser } from "@/lib/users/actions";

const text = {
  title: "Delete User Permanently?",
  body: "This removes the account for good and cannot be undone. The audit log keeps a record of who they were and who deleted them. If you may need them again, keep them deactivated instead.",
  typePrompt: "Type the full name to confirm",
  cancel: "Cancel",
  delete: "Delete Permanently",
  working: "Deleting...",
} as const;

export type DeleteTarget = { id: string; name: string };

// Confirmation box for permanently deleting an inactive user.
export function DeleteDialog({
  target,
  onClose,
  onDone,
}: {
  target: DeleteTarget | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (target && !dialog.open) {
      setTyped("");
      setError(null);
      dialog.showModal();
    }
    if (!target && dialog.open) dialog.close();
  }, [target]);

  const matches = target !== null && typed.trim() === target.name.trim();

  function confirm() {
    if (!target || !matches) return;
    startTransition(async () => {
      const data = new FormData();
      data.set("id", target.id);
      data.set("confirmName", typed);
      const result = await deleteUser({ error: null }, data);
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="delete-dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-[480px] rounded-[18px] bg-surface p-5 text-text shadow-card backdrop:bg-black/40"
    >
      <h2
        id="delete-dialog-title"
        className="text-[1.15rem] font-semibold tracking-[-0.02em]"
      >
        {text.title}
      </h2>
      <p className="mb-4 mt-1 text-[0.88rem] text-muted">{text.body}</p>
      <div className="mb-3">
        <label htmlFor="delete-confirm" className={field.label}>
          {text.typePrompt}:{" "}
          <strong className="font-semibold text-text">{target?.name}</strong>
        </label>
        <input
          id="delete-confirm"
          type="text"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          className={field.input}
        />
      </div>
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
          disabled={pending || !matches}
          className={button.danger}
        >
          {pending ? text.working : text.delete}
        </button>
      </div>
    </dialog>
  );
}
