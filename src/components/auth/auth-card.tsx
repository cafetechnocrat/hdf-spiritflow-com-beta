import Image from "next/image";
import type { ReactNode } from "react";

// The compact centred card used by the auth screens after sign in.
export function AuthCard({
  title,
  subtitle,
  error,
  errorTitle,
  children,
}: {
  title: string;
  subtitle: string;
  error?: string | null;
  errorTitle?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby="auth-card-title"
      className="relative overflow-hidden w-full max-w-[340px] rounded-2xl bg-surface px-4 pb-4 pt-4 shadow-card sm:rounded-[18px] sm:px-[22px] sm:pt-5"
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-accent via-accent to-brand" />
      <div className="mb-5 mt-1 flex justify-center">
        <Image
          src="/brand/spiritflow-logo-horizontal.png"
          alt="Spirit Flow"
          width={1400}
          height={385}
          sizes="200px"
          priority
          className="h-auto w-[200px]"
        />
      </div>
      <h1
        id="auth-card-title"
        className="text-center text-[1.25rem] font-semibold leading-tight tracking-[-0.02em]"
      >
        {title}
      </h1>
      <p className="mb-3 mt-px text-center text-[0.85rem] text-muted">{subtitle}</p>
      {error ? (
        <div
          role="alert"
          className="mb-3 rounded-[10px] bg-error-bg px-3 py-2.5 text-[0.85rem] text-error"
        >
          {errorTitle ? (
            <strong className="font-semibold text-text">{errorTitle}</strong>
          ) : null}{" "}
          <span>{error}</span>
        </div>
      ) : null}
      {children}
    </section>
  );
}

export const primaryButtonClass =
  "h-11 w-full rounded-xl bg-accent text-[0.95rem] font-semibold tracking-[-0.01em] text-white transition-[background-color,transform] hover:bg-accent-hover active:scale-[0.99] active:bg-accent-press disabled:opacity-70";

export const secondaryButtonClass =
  "mt-2 grid h-11 w-full place-items-center rounded-xl bg-track text-[0.95rem] font-semibold text-text hover:bg-[#dbe0ec]";
