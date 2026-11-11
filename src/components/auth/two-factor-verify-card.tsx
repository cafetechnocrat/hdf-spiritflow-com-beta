"use client";

import { useActionState } from "react";
import { signOut } from "@/lib/auth/actions";
import { verifyTwoFactor, type CodeState } from "@/lib/auth/two-factor-actions";
import {
  AuthCard,
  primaryButtonClass,
  secondaryButtonClass,
} from "./auth-card";
import { CodeBoxes } from "./code-boxes";

const text = {
  title: "Two-Factor Code",
  subtitle: "Enter the 6-digit code from your authenticator app.",
  codeLabel: "Six Digit Code",
  codeDigit: "Code Digit",
  verify: "Verify",
  verifying: "Verifying...",
  otherAccount: "Use A Different Account",
  help: "Lost your phone or changed it? Ask the System Admin to reset your two-factor.",
  errorTitle: "Could not verify.",
} as const;

export function TwoFactorVerifyCard() {
  const [state, action, pending] = useActionState<CodeState, FormData>(
    verifyTwoFactor,
    { error: null },
  );
  return (
    <AuthCard
      title={text.title}
      subtitle={text.subtitle}
      error={state.error}
      errorTitle={text.errorTitle}
    >
      <form action={action} noValidate>
        <CodeBoxes name="code" label={text.codeLabel} digitLabel={text.codeDigit} />
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? text.verifying : text.verify}
        </button>
      </form>
      <form action={signOut}>
        <button type="submit" className={secondaryButtonClass}>
          {text.otherAccount}
        </button>
      </form>
      <p className="mt-2 text-center text-[0.78rem] text-muted">{text.help}</p>
    </AuthCard>
  );
}
