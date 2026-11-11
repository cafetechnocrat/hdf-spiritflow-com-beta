"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/auth/actions";
import {
  beginTwoFactorSetup,
  confirmTwoFactorSetup,
  type CodeState,
  type SetupInfo,
} from "@/lib/auth/two-factor-actions";
import {
  AuthCard,
  primaryButtonClass,
  secondaryButtonClass,
} from "./auth-card";
import { CodeBoxes } from "./code-boxes";

const text = {
  title: "Set Up Two-Factor",
  subtitle: "Add an extra step to keep your account safe.",
  step1: "Open Google Authenticator or another authenticator app on your phone.",
  step2: "Choose Add Account, then scan this code.",
  step3: "Enter the 6-digit code the app shows.",
  qrAlt: "QR code for your authenticator app",
  cannotScan: "Cannot scan? Type this key into the app instead.",
  copy: "Copy",
  copied: "Copied",
  codeLabel: "Six Digit Code",
  codeDigit: "Code Digit",
  verify: "Verify And Continue",
  verifying: "Verifying...",
  signOut: "Sign Out",
  help: "The code changes every 30 seconds. Keep the app on your phone for every sign in.",
  preparing: "Preparing your setup...",
  errorTitle: "Could not verify.",
} as const;

function groupSecret(secret: string) {
  return secret.replace(/\s/g, "").replace(/(.{4})/g, "$1 ").trim();
}

export function TwoFactorSetupCard() {
  const [info, setInfo] = useState<SetupInfo | null>(null);
  const started = useRef(false);
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState<CodeState, FormData>(
    confirmTwoFactorSetup,
    { error: null },
  );

  useEffect(() => {
    // Start once only, so a second factor is not created by a remount.
    if (started.current) return;
    started.current = true;
    beginTwoFactorSetup().then(setInfo);
  }, []);

  async function copySecret() {
    if (!info?.ok) return;
    try {
      await navigator.clipboard.writeText(info.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // The key is also shown on screen to copy by hand.
    }
  }

  const failed = info && !info.ok ? info.error : null;

  return (
    <AuthCard
      title={text.title}
      subtitle={text.subtitle}
      error={failed ?? state.error}
      errorTitle={failed ? undefined : text.errorTitle}
    >
      {!info ? (
        <p className="py-6 text-center text-[0.85rem] text-muted">{text.preparing}</p>
      ) : info.ok ? (
        <>
          <ol className="mb-3 grid gap-2 text-[0.85rem]">
            <li>1. {text.step1}</li>
            <li>2. {text.step2}</li>
          </ol>
          <div className="mx-auto mb-3 grid w-fit place-items-center rounded-xl border border-border-soft bg-white p-2">
            <Image
              unoptimized
              src={info.qr}
              alt={text.qrAlt}
              width={160}
              height={160}
            />
          </div>
          <p className="mb-1.5 text-center text-[0.78rem] text-muted">{text.cannotScan}</p>
          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-track px-3 py-2">
            <span className="break-all font-mono text-[0.82rem]">
              {groupSecret(info.secret)}
            </span>
            <button
              type="button"
              onClick={copySecret}
              className="text-[0.82rem] font-semibold text-link hover:underline"
            >
              {copied ? text.copied : text.copy}
            </button>
          </div>
          <p className="mb-2 text-[0.85rem]">3. {text.step3}</p>
          <form action={action} noValidate>
            <input type="hidden" name="factorId" value={info.factorId} />
            <CodeBoxes name="code" label={text.codeLabel} digitLabel={text.codeDigit} />
            <button type="submit" disabled={pending} className={primaryButtonClass}>
              {pending ? text.verifying : text.verify}
            </button>
          </form>
          <p className="mt-2 text-center text-[0.78rem] text-muted">{text.help}</p>
        </>
      ) : null}
      <form action={signOut}>
        <button type="submit" className={secondaryButtonClass}>
          {text.signOut}
        </button>
      </form>
    </AuthCard>
  );
}
