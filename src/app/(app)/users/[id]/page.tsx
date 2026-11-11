import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserForm } from "@/components/users/user-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit } from "@/lib/auth/permissions";
import { getUser } from "@/lib/users/queries";

export const metadata: Metadata = {
  title: "Spirit Flow",
  robots: { index: false, follow: false },
};

const text = {
  back: "Users",
  title: "Edit User",
  subtitle: "Change the name, phone or role. The email address stays the same.",
} as const;

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await getCurrentUser();
  if (!me || !canEdit("users", me.role)) notFound();

  const { id } = await params;
  const user = await getUser(id);
  if (!user) notFound();

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
      <UserForm
        mode="edit"
        user={{
          id: user.id,
          fullName: user.fullName,
          phone: user.phone,
          role: user.role,
          email: user.signIn,
          status: user.status,
        }}
      />
    </div>
  );
}
