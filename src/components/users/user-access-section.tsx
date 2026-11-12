"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ErrorLine } from "@/components/ui/admin-parts";
import { badge, button } from "@/components/ui/styles";
import type { AccessFlags, UserAccessData, UserAccessFeature } from "@/lib/users/access-types";
import { resetUserAccess, setUserAccess } from "@/lib/users/access-actions";

// All visible text sits here so it can be translated later.
const text = {
  title: "Access",
  custom: "Custom Access",
  note: "You can give this person less than their role, never more. Boxes the role does not allow are greyed out. Changes save as soon as you make them.",
  notInRole: "Not in role",
  none: "None",
  allRoleAllows: "All the role allows",
  allowed: "Allowed",
  view: "View",
  edit: "Edit",
  delete: "Delete",
  selectAll: "Select All The Role Allows",
  roleGives: "The role gives",
  reset: "Reset To Role Access",
  resetHint: "Removes every reduction and gives back everything the role allows.",
  nothingReduced: "This person has everything their role allows.",
  saved: "Saved",
} as const;

type Action = "view" | "edit" | "delete";
const LABEL: Record<Action, string> = { view: text.view, edit: text.edit, delete: text.delete };

function offered(feature: UserAccessFeature): Action[] {
  const list: Action[] = [];
  if (feature.offersView) list.push("view");
  if (feature.offersEdit) list.push("edit");
  if (feature.offersDelete) list.push("delete");
  return list;
}

// The actions the role allows on this feature.
function allowedOf(feature: UserAccessFeature): Action[] {
  return offered(feature).filter((action) => feature.role[action]);
}

function actionName(feature: UserAccessFeature, action: Action): string {
  return offered(feature).length === 1 && action === "edit" ? text.allowed : LABEL[action];
}

function summary(feature: UserAccessFeature, flags: AccessFlags): string {
  const allowed = allowedOf(feature);
  const chosen = allowed.filter((action) => flags[action]);
  if (chosen.length === 0) return text.none;
  if (allowed.length === 1) return actionName(feature, allowed[0]);
  if (chosen.length === allowed.length) return text.allRoleAllows;
  return chosen.map((action) => actionName(feature, action)).join(", ");
}

function reduced(feature: UserAccessFeature, flags: AccessFlags): boolean {
  return allowedOf(feature).some((action) => !flags[action]);
}

// Edit and Delete need View. Only what the role allows can be ticked.
function nextFlags(
  feature: UserAccessFeature,
  current: AccessFlags,
  action: Action | "all",
  on: boolean,
): AccessFlags {
  const allowed = allowedOf(feature);
  const next: AccessFlags = { ...current };
  if (action === "all") {
    for (const a of allowed) next[a] = on;
    return next;
  }
  if (!allowed.includes(action)) return current;
  next[action] = on;
  if (feature.offersView) {
    if (on && action !== "view" && allowed.includes("view")) next.view = true;
    if (!on && action === "view") {
      next.edit = false;
      next.delete = false;
    }
  }
  return next;
}

type OpenMenu = { feature: UserAccessFeature; top: number; left: number };

export function UserAccessSection({ data }: { data: UserAccessData }) {
  const [flags, setFlags] = useState<Record<string, AccessFlags>>(
    Object.fromEntries(data.features.map((f) => [f.key, f.user])),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const [, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);

  // When the server sends fresh data, show it.
  const fingerprint = JSON.stringify(data.features.map((f) => [f.key, f.role, f.user]));
  const [seen, setSeen] = useState(fingerprint);
  if (seen !== fingerprint) {
    setSeen(fingerprint);
    setFlags(Object.fromEntries(data.features.map((f) => [f.key, f.user])));
  }

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (menuRef.current?.contains(target)) return;
      if (!target.closest("[aria-haspopup='true']")) close();
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

  function change(feature: UserAccessFeature, action: Action | "all", on: boolean) {
    const before = flags;
    const next = nextFlags(feature, flags[feature.key] ?? feature.user, action, on);
    setFlags({ ...flags, [feature.key]: next });
    setMessage(null);
    startTransition(async () => {
      const result = await setUserAccess({
        userId: data.userId,
        featureKey: feature.key,
        view: next.view,
        edit: next.edit,
        delete: next.delete,
      });
      if (result.error) {
        setFlags(before);
        setMessage(result.error);
      } else {
        flash();
      }
    });
  }

  function reset() {
    const before = flags;
    setFlags(Object.fromEntries(data.features.map((f) => [f.key, f.role])));
    setMessage(null);
    startTransition(async () => {
      const result = await resetUserAccess(data.userId);
      if (result.error) {
        setFlags(before);
        setMessage(result.error);
      } else {
        flash();
      }
    });
  }

  function openMenu(feature: UserAccessFeature, rect: DOMRect) {
    if (menu?.feature.key === feature.key) {
      setMenu(null);
      return;
    }
    const rows = offered(feature).length + (allowedOf(feature).length > 1 ? 1 : 0);
    setMenu({
      feature,
      top: Math.min(rect.bottom + 4, window.innerHeight - 44 * rows - 24),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 224)),
    });
  }

  const anyReduced = data.features.some((f) => reduced(f, flags[f.key] ?? f.user));

  const groups: { label: string; features: UserAccessFeature[] }[] = [];
  for (const feature of data.features) {
    const last = groups[groups.length - 1];
    if (last && last.label === feature.group) last.features.push(feature);
    else groups.push({ label: feature.group, features: [feature] });
  }

  const menuFlags = menu ? (flags[menu.feature.key] ?? menu.feature.user) : null;
  const menuAllowed = menu ? allowedOf(menu.feature) : [];

  return (
    <section
      aria-labelledby="user-access-title"
      className="mt-4 max-w-[720px] overflow-hidden rounded-2xl bg-surface px-[18px] pb-4 pt-[18px] shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
    >
      <h2 id="user-access-title" className="mb-1 text-base font-semibold tracking-[-0.01em]">
        {text.title}{" "}
        {anyReduced ? <span className={`${badge.base} ${badge.warn}`}>{text.custom}</span> : null}
      </h2>
      <p className="mb-3 text-[0.84rem] text-muted">{data.roleName}</p>
      <p className="mb-3 rounded-xl bg-accent-soft px-3 py-2.5 text-[0.84rem] text-link">
        {text.note}
      </p>
      {message ? <ErrorLine message={message} /> : null}

      {groups.map((group) => (
        <div key={group.label}>
          <div className="pb-1 pt-3 text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-muted">
            {group.label}
          </div>
          {group.features.map((feature) => {
            const own = flags[feature.key] ?? feature.user;
            const allowed = allowedOf(feature);
            const isReduced = reduced(feature, own);
            return (
              <div
                key={feature.key}
                className="flex items-center justify-between gap-3 border-t border-divider py-2.5 text-[0.9rem]"
              >
                <div>
                  <strong className="font-semibold">{feature.label}</strong>
                  {allowed.length > 0 && isReduced ? (
                    <div className="text-[0.76rem] text-muted">
                      {text.roleGives}:{" "}
                      {allowed.map((action) => actionName(feature, action)).join(", ")}
                    </div>
                  ) : null}
                </div>
                {allowed.length === 0 ? (
                  <span className="text-[0.8rem] text-muted">{text.notInRole}</span>
                ) : (
                  <button
                    type="button"
                    aria-haspopup="true"
                    aria-label={feature.label}
                    onClick={(event) => openMenu(feature, event.currentTarget.getBoundingClientRect())}
                    className={`min-h-[38px] min-w-[112px] flex-none whitespace-nowrap rounded-[9px] border px-2.5 text-[0.84rem] ${
                      summary(feature, own) === text.none
                        ? "border-border-soft bg-surface text-muted"
                        : isReduced
                          ? "border-transparent bg-accent-soft font-semibold text-link"
                          : "border-transparent bg-success-bg font-semibold text-success"
                    }`}
                  >
                    {summary(feature, own)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2 pt-3">
        <button
          type="button"
          onClick={reset}
          disabled={!anyReduced}
          className={button.secondary}
        >
          {text.reset}
        </button>
        <span className="text-[0.8rem] text-muted">
          {anyReduced ? text.resetHint : text.nothingReduced}
        </span>
      </div>

      {menu && menuFlags ? (
        <div
          ref={menuRef}
          role="group"
          aria-label={menu.feature.label}
          style={{ top: menu.top, left: menu.left }}
          className="fixed z-[70] min-w-[196px] rounded-xl bg-surface p-1.5 text-left shadow-card"
        >
          {menuAllowed.length > 1 ? (
            <label className="mb-0.5 flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border-b border-divider px-2.5 text-[0.88rem] font-semibold hover:bg-background">
              <input
                type="checkbox"
                checked={menuAllowed.every((action) => menuFlags[action])}
                onChange={(event) => change(menu.feature, "all", event.target.checked)}
                className="h-[18px] w-[18px]"
              />
              {text.selectAll}
            </label>
          ) : null}
          {offered(menu.feature).map((action) => {
            const ok = menuAllowed.includes(action);
            return (
              <label
                key={action}
                className={`flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-[0.88rem] ${
                  ok ? "cursor-pointer hover:bg-background" : "cursor-not-allowed text-muted"
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!ok}
                  checked={ok && menuFlags[action]}
                  onChange={(event) => change(menu.feature, action, event.target.checked)}
                  className="h-[18px] w-[18px]"
                />
                {actionName(menu.feature, action)}
                {ok ? null : <span className="ml-auto text-[0.7rem]">{text.notInRole}</span>}
              </label>
            );
          })}
        </div>
      ) : null}

      <div
        role="status"
        className={`pointer-events-none fixed bottom-4 right-4 z-[60] rounded-xl bg-[#0F1B3D] px-3.5 py-2 text-[0.84rem] text-white transition-opacity ${
          notice ? "opacity-100" : "opacity-0"
        }`}
      >
        {notice ? text.saved : ""}
      </div>
    </section>
  );
}
