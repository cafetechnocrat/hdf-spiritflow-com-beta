import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { UserForm } from "@/components/users/user-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit } from "@/lib/auth/permissions";
import { listAssignableRoles } from "@/lib/users/queries";

export const metadata: Metadata = {
  title: "Spirit Flow",
  robots: { index: false, follow: false },
};

const text = {
  back: "Users",
  title: "Add User",
  subtitle:
    "Set a temporary password and share it with the user. They should change it after they first sign in.",
} as const;

async function NewUserContent() {
  const me = await getCurrentUser();
  if (!me || !canEdit(me, "users")) notFound();

  const roles = await listAssignableRoles();

  return (
    <div>
      <Link href="/users" className="mb-1 inline-block text-[0.82rem] text-muted hover:underline">
        &larr; {text.back}
      </Link>
      <div className="mb-4">
        <h1 className="text-[1.5rem] font-semibold leading-tight tracking-[-0.02em]">
          {text.title}
        </h1>
        <p className="mt-0.5 text-[0.88rem] text-muted">{text.subtitle}</p>
      </div>
      <UserForm mode="create" roles={roles} />
    </div>
  );
}

export default function NewUserPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewUserContent />
    </Suspense>
  );
}
