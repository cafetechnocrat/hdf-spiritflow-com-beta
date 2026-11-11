import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, primaryButtonClass } from "@/components/auth/auth-card";

export const metadata: Metadata = {
  title: "Spirit Flow",
};

const text = {
  title: "Forgot Password?",
  subtitle: "The System Admin can reset it for you.",
  info: "Password reset emails are not used. Your sign in address is not a real mailbox.",
  step1: "Tell the System Admin that you forgot your password. Cashiers: your PIN.",
  step2: "They give you a temporary password or PIN.",
  step3: "Sign in with it, then choose a new one.",
  back: "Back To Sign In",
} as const;

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12 sm:px-7">
      <AuthCard title={text.title} subtitle={text.subtitle}>
        <p className="mb-3 rounded-[10px] bg-accent-soft px-3 py-2.5 text-[0.85rem]">
          {text.info}
        </p>
        <ol className="mb-4 grid gap-2 text-[0.85rem]">
          <li>1. {text.step1}</li>
          <li>2. {text.step2}</li>
          <li>3. {text.step3}</li>
        </ol>
        <Link href="/login" className={`${primaryButtonClass} grid place-items-center`}>
          {text.back}
        </Link>
      </AuthCard>
    </main>
  );
}
