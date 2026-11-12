import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { UserForm } from "@/components/users/user-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit } from "@/lib/auth/permissions";
import { UserAccessSection } from "@/components/users/user-access-section";
import { loadUserAccess } from "@/lib/users/access-queries";
import { getUser, listAssignableRoles } from "@/lib/users/queries";

export const metadata: Metadata = {
  title: "Spirit Flow",
  robots: { index: false, follow: false },
};

const text = {
  back: "Users",
  title: "Edit User",
  subtitle: "Change the name, phone or role. The email address stays the same.",
} as const;

async function EditUserContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await getCurrentUser();
  if (!me || !canEdit(me, "users")) notFound();

  const { id } = await params;
  const user = await getUser(id);
  if (!user) notFound();
  const [roles, access] = await Promise.all([
    listAssignableRoles(user.roleId),
    loadUserAccess(user.id),
  ]);

  return (
    <div>
      <Link href="/users" className="mb-1 inline-block text-[0.82rem] text-muted hover:underline">
        &larr; {text.back}
      </Link>
      <div className="mb-4">
        <h1 className="text-[1.3rem] font-semibold leading-tight tracking-[-0.02em]">
          {text.title}
        </h1>
        <p className="mt-0.5 text-[0.88rem] text-muted">{text.subtitle}</p>
      </div>
      <UserForm
        mode="edit"
        roles={roles}
        currentUserId={me.id}
        user={{
          id: user.id,
          fullName: user.fullName,
          phone: user.phone,
          roleId: user.roleId,
          requiresTwoFactor: user.requiresTwoFactor,
          signInMethod: user.signInMethod,
          email: user.signIn,
          status: user.status,
        }}
      />
      {access && !access.isSystem && me.id !== user.id ? <UserAccessSection data={access} /> : null}
    </div>
  );
}

export default function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<PageLoading />}>
      <EditUserContent params={params} />
    </Suspense>
  );
}
