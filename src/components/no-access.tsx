import Image from "next/image";
import { signOut } from "@/lib/auth/actions";

const text = {
  title: "No Access",
  body: "Your account is not active or has no role yet. Ask the System Admin for help.",
  signOut: "Sign Out",
  logoAlt: "Spirit Flow",
} as const;

// Shown to a signed in account that has no active profile.
export function NoAccess() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8">
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
        <h1 className="text-[1.25rem] font-semibold tracking-[-0.02em]">
          {text.title}
        </h1>
        <p className="mt-2 text-[0.9rem] text-muted">{text.body}</p>
        <form action={signOut} className="mt-5">
          <button
            type="submit"
            className="h-11 w-full rounded-xl bg-accent text-[0.95rem] font-semibold text-white transition-colors hover:bg-accent-hover active:bg-accent-press"
          >
            {text.signOut}
          </button>
        </form>
      </section>
    </div>
  );
}
