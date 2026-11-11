import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser, ROLE_LABELS } from "@/lib/auth/current-user";

export const metadata: Metadata = {
  title: "Spirit Flow",
  robots: { index: false, follow: false },
};

const text = {
  welcome: "Welcome",
  signedInAs: "Signed in as",
  placeholder: "Your workspace is being set up. Screens will appear here soon.",
  noAccessTitle: "No Access",
  noAccess:
    "Your account is not active or has no role yet. Ask the System Admin for help.",
  signOut: "Sign Out",
  loading: "Loading...",
  logoAlt: "Spirit Flow",
} as const;

// Placeholder home page for signed in users. The real dashboard and shell
// come in later steps.
async function HomeContent() {
  const user = await getCurrentUser();

  return (
    <section className="w-full max-w-[420px] rounded-2xl bg-surface px-6 pb-5 pt-5 text-center shadow-card">
      <div className="mb-4 flex justify-center">
        <Image
          src="/brand/spiritflow-logo.png"
          alt={text.logoAlt}
          width={2172}
          height={724}
          className="-my-2.5 h-auto w-[150px]"
        />
      </div>
      {user ? (
        <>
          <h1 className="text-[1.25rem] font-semibold tracking-[-0.02em]">
            {text.welcome}, {user.fullName}
          </h1>
          <p className="mt-1 text-[0.85rem] text-muted">
            {text.signedInAs} {ROLE_LABELS[user.role]}
          </p>
          <p className="mt-4 text-[0.9rem]">{text.placeholder}</p>
        </>
      ) : (
        <>
          <h1 className="text-[1.25rem] font-semibold tracking-[-0.02em]">
            {text.noAccessTitle}
          </h1>
          <p className="mt-2 text-[0.9rem] text-muted">{text.noAccess}</p>
        </>
      )}
      <form action={signOut} className="mt-5">
        <button
          type="submit"
          className="h-11 w-full rounded-xl bg-accent text-[0.95rem] font-semibold text-white transition-colors hover:bg-accent-hover active:bg-accent-press"
        >
          {text.signOut}
        </button>
      </form>
    </section>
  );
}

export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <Suspense
        fallback={<p className="text-[0.9rem] text-muted">{text.loading}</p>}
      >
        <HomeContent />
      </Suspense>
    </main>
  );
}
