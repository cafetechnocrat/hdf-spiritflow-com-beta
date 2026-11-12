// Shared class names for the admin screens, so buttons, fields and badges look
// the same everywhere. Values come from the design tokens in globals.css.
const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] px-4 text-[0.88rem] sm:min-h-10 font-semibold tracking-[-0.01em] transition-[background-color,transform] active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none";

export const button = {
  primary: `${buttonBase} bg-accent text-white hover:bg-accent-hover active:bg-accent-press`,
  secondary: `${buttonBase} bg-track text-text hover:bg-[#dbe0ec]`,
  danger: `${buttonBase} bg-error-bg text-error hover:bg-[#ffe3e0]`,
  small: "!min-h-9 !rounded-lg !px-3 !text-[0.8rem] sm:!min-h-8",
} as const;

export const field = {
  label: "mb-1 ml-0.5 block text-[0.78rem] font-medium text-muted",
  input:
    "h-11 w-full rounded-[10px] border border-border-soft bg-surface px-3 text-[0.88rem] text-text transition-[border-color,box-shadow] sm:h-10 placeholder:text-muted/75 hover:border-border focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/30 read-only:bg-background read-only:text-muted disabled:bg-background disabled:text-muted",
  hint: "ml-0.5 mt-1.5 text-[0.78rem] text-muted",
} as const;

export const badge = {
  base: "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
  ok: "bg-success-bg text-success",
  off: "bg-track text-muted",
  role: "bg-accent-soft text-link",
  warn: "bg-warn-bg text-warn",
  bad: "bg-error-bg text-error",
} as const;
