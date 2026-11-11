"use client";

import { useRef, useState } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";

const LENGTH = 6;

// Six boxes for a one-time code. The joined value is sent as the field `name`.
export function CodeBoxes({
  name,
  label,
  digitLabel,
}: {
  name: string;
  label: string;
  digitLabel: string;
}) {
  const [digits, setDigits] = useState<string[]>(() => Array(LENGTH).fill(""));
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function setDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits((current) => current.map((d, i) => (i === index ? digit : d)));
    if (digit && index < LENGTH - 1) refs.current[index + 1]?.focus();
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, LENGTH);
    if (!pasted) return;
    event.preventDefault();
    setDigits(Array.from({ length: LENGTH }, (_, i) => pasted[i] ?? ""));
    refs.current[Math.min(pasted.length, LENGTH - 1)]?.focus();
  }

  return (
    <div className="mb-3">
      <span id={`${name}-label`} className="mb-[3px] ml-0.5 block text-[0.78rem] font-medium text-muted">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={`${name}-label`}
        className="grid grid-cols-6 gap-1.5"
      >
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            autoComplete={index === 0 ? "one-time-code" : "off"}
            value={digit}
            aria-label={`${digitLabel} ${index + 1}`}
            onChange={(event) => setDigit(index, event.target.value)}
            onKeyDown={(event) => onKeyDown(index, event)}
            onPaste={onPaste}
            className="h-11 w-full rounded-xl border border-border-soft bg-field px-0 text-center text-[1.15rem] font-semibold text-text transition-[border-color,box-shadow] hover:border-border focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/30"
          />
        ))}
      </div>
      <input type="hidden" name={name} value={digits.join("")} />
    </div>
  );
}
