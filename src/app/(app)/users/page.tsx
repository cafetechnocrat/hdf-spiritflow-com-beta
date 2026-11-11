import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UsersTable } from "@/components/users/users-table";
import { button } from "@/components/ui/styles";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit, canView } from "@/lib/auth/permissions";
import { listUsers } from "@/lib/users/queries";

export const metadata: Metadata = {
  title: "Spirit Flow",
  robots: { index: false, follow: false },
};

const text = {
  title: "Users",
  subtitle:
    "Add staff, set their role, and deactivate leavers. Users are never deleted.",
  subtitleView: "Staff accounts and their roles.",
  add: "Add User",
} as const;

export default async function UsersPage() {
  const me = await getCurrentUser();
  if (!me || !canView("users", me.role)) notFound();

  const rows = await listUsers();
  const editable = canEdit("users", me.role);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-semibold leading-tight tracking-[-0.02em]">
            {text.title}
          </h1>
          <p className="mt-0.5 text-[0.88rem] text-muted">
            {editable ? text.subtitle : text.subtitleView}
          </p>
        </div>
        {editable ? (
          <Link href="/users/new" className={button.primary}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              className="h-[18px] w-[18px]"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {text.add}
          </Link>
        ) : null}
      </div>
      <UsersTable rows={rows} canEdit={editable} currentUserId={me.id} />
    </div>
  );
}
