"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import type { ClipboardEvent, FormEvent, KeyboardEvent } from "react";

// All visible text sits here so it can be translated later.
const text = {
  title: "Sign In",
  subtitle: "Use your work account to continue.",
  tabsLabel: "Sign In Method",
  tabEmail: "Email And Password",
  tabPin: "Username And PIN",
  emailLabel: "Email Address",
  emailPlaceholder: "name@example.com",
  passwordLabel: "Password",
  passwordPlaceholder: "Enter your password",
  showPassword: "Show Password",
  hidePassword: "Hide Password",
  keepSignedIn: "Keep Me Signed In",
  forgotPassword: "Forgot Password?",
  usernameLabel: "Username",
  usernamePlaceholder: "Enter your username",
  pinLabel: "PIN",
  pinGroupLabel: "Six Digit PIN",
  pinDigit: "PIN Digit",
  pinHint: "Enter your 6 digit PIN.",
  pinHelp: "Forgot your PIN? Ask the System Admin to reset it.",
  submit: "Sign In",
  errorTitle: "Could not sign in.",
  errorNotConnected: "Sign in is not connected yet.",
  logoAlt: "Spirit Flow",
} as const;

const PIN_LENGTH = 6;

type TabId = "email" | "pin";

const inputClass =
  "h-11 w-full rounded-xl border border-border-soft bg-field px-3 text-[0.9rem] text-text transition-[border-color,box-shadow] placeholder:text-muted/75 hover:border-border focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/30";

const labelClass = "mb-[3px] ml-0.5 block text-[0.78rem] font-medium text-muted";

export function LoginCard() {
  const baseId = useId();
  const [tab, setTab] = useState<TabId>("email");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState<string[]>(() => Array(PIN_LENGTH).fill(""));
  const pinRefs = useRef<Array<HTMLInputElement | null>>([]);
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    email: null,
    pin: null,
  });

  const emailTabId = `${baseId}-tab-email`;
  const pinTabId = `${baseId}-tab-pin`;
  const emailPanelId = `${baseId}-panel-email`;
  const pinPanelId = `${baseId}-panel-pin`;

  function selectTab(next: TabId) {
    setTab(next);
    setError(null);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next: TabId = tab === "email" ? "pin" : "email";
    selectTab(next);
    tabRefs.current[next]?.focus();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Sign in is wired up in a later step, when accounts are connected.
    setError(text.errorNotConnected);
  }

  function setPinDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setPin((current) => current.map((d, i) => (i === index ? digit : d)));
    if (digit && index < PIN_LENGTH - 1) pinRefs.current[index + 1]?.focus();
  }

  function onPinKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !pin[index] && index > 0) {
      pinRefs.current[index - 1]?.focus();
    }
  }

  function onPinPaste(event: ClipboardEvent<HTMLInputElement>) {
    const digits = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, PIN_LENGTH);
    if (!digits) return;
    event.preventDefault();
    setPin(Array.from({ length: PIN_LENGTH }, (_, i) => digits[i] ?? ""));
    pinRefs.current[Math.min(digits.length, PIN_LENGTH - 1)]?.focus();
  }

  const tabClass = (id: TabId) =>
    `min-h-11 whitespace-nowrap rounded-lg px-1 text-[0.82rem] tracking-[-0.005em] transition-[background-color,color,box-shadow] ${
      tab === id
        ? "bg-surface font-semibold text-text shadow-[0_1px_3px_rgba(0,0,0,0.2),0_0_0_0.5px_rgba(0,0,0,0.04)]"
        : "font-medium text-muted hover:text-text"
    }`;

  return (
    <section
      aria-labelledby={`${baseId}-title`}
      className="w-full max-w-[340px] rounded-2xl bg-surface px-4 pb-3 pt-4 shadow-card sm:rounded-[18px] sm:px-[22px] sm:pb-4 sm:pt-5"
    >
      <div className="mb-6 flex justify-center">
        <Image
          src="/brand/spiritflow-logo.png"
          alt={text.logoAlt}
          width={2172}
          height={724}
          priority
          className="-my-2.5 h-auto w-[150px]"
        />
      </div>
      <h1
        id={`${baseId}-title`}
        className="text-center text-[1.25rem] font-semibold leading-tight tracking-[-0.02em]"
      >
        {text.title}
      </h1>
      <p className="mb-3 mt-px text-center text-[0.85rem] text-muted">
        {text.subtitle}
      </p>

      <div
        role="tablist"
        aria-label={text.tabsLabel}
        className="mb-3 grid grid-cols-2 gap-0.5 rounded-[10px] bg-track p-0.5"
      >
        <button
          ref={(el) => {
            tabRefs.current.email = el;
          }}
          type="button"
          role="tab"
          id={emailTabId}
          aria-selected={tab === "email"}
          aria-controls={emailPanelId}
          tabIndex={tab === "email" ? 0 : -1}
          onClick={() => selectTab("email")}
          onKeyDown={onTabKeyDown}
          className={tabClass("email")}
        >
          {text.tabEmail}
        </button>
        <button
          ref={(el) => {
            tabRefs.current.pin = el;
          }}
          type="button"
          role="tab"
          id={pinTabId}
          aria-selected={tab === "pin"}
          aria-controls={pinPanelId}
          tabIndex={tab === "pin" ? 0 : -1}
          onClick={() => selectTab("pin")}
          onKeyDown={onTabKeyDown}
          className={tabClass("pin")}
        >
          {text.tabPin}
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-3 flex items-start gap-2 rounded-[10px] bg-error-bg px-3 py-2.5 text-[0.85rem] text-error"
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
            <span>{error}</span>
          </div>
        </div>
      ) : null}

      {tab === "email" ? (
        <form
          id={emailPanelId}
          role="tabpanel"
          aria-labelledby={emailTabId}
          onSubmit={onSubmit}
          noValidate
        >
          <div className="mb-2">
            <label htmlFor={`${baseId}-email`} className={labelClass}>
              {text.emailLabel}
            </label>
            <input
              id={`${baseId}-email`}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder={text.emailPlaceholder}
              className={inputClass}
            />
          </div>
          <div className="mb-2">
            <label htmlFor={`${baseId}-password`} className={labelClass}>
              {text.passwordLabel}
            </label>
            <div className="relative">
              <input
                id={`${baseId}-password`}
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder={text.passwordPlaceholder}
                className={`${inputClass} pr-[46px]`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? text.hidePassword : text.showPassword}
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
                  {showPassword ? (
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
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[0.875rem]">
              <input
                type="checkbox"
                name="keep"
                className="m-0 h-[18px] w-[18px] accent-accent"
              />
              {text.keepSignedIn}
            </label>
            <a
              href="#"
              className="inline-flex min-h-11 items-center text-[0.875rem] text-link hover:underline hover:underline-offset-[3px]"
            >
              {text.forgotPassword}
            </a>
          </div>
          <SubmitButton />
        </form>
      ) : (
        <form
          id={pinPanelId}
          role="tabpanel"
          aria-labelledby={pinTabId}
          onSubmit={onSubmit}
          noValidate
        >
          <div className="mb-2">
            <label htmlFor={`${baseId}-username`} className={labelClass}>
              {text.usernameLabel}
            </label>
            <input
              id={`${baseId}-username`}
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={text.usernamePlaceholder}
              className={inputClass}
            />
          </div>
          <div className="mb-2">
            <span id={`${baseId}-pin-label`} className={labelClass}>
              {text.pinLabel}
            </span>
            <div
              role="group"
              aria-labelledby={`${baseId}-pin-label`}
              className="grid grid-cols-6 gap-1.5"
            >
              {pin.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    pinRefs.current[index] = el;
                  }}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  autoComplete="off"
                  value={digit}
                  aria-label={`${text.pinDigit} ${index + 1}`}
                  onChange={(event) => setPinDigit(index, event.target.value)}
                  onKeyDown={(event) => onPinKeyDown(index, event)}
                  onPaste={onPinPaste}
                  className={`${inputClass} !px-0 text-center text-[1.15rem] font-semibold`}
                />
              ))}
            </div>
            <p className="ml-0.5 mt-1.5 text-[0.78rem] text-muted">
              {text.pinHint}
            </p>
          </div>
          <div className="h-2" />
          <SubmitButton />
          <p className="mt-2 text-center text-[0.8rem] text-muted">
            {text.pinHelp}
          </p>
        </form>
      )}
    </section>
  );
}

function SubmitButton() {
  return (
    <button
      type="submit"
      className="mt-1 h-11 w-full rounded-xl bg-accent text-[0.95rem] font-semibold tracking-[-0.01em] text-white transition-[background-color,transform] hover:bg-accent-hover active:scale-[0.99] active:bg-accent-press"
    >
      {text.submit}
    </button>
  );
}
