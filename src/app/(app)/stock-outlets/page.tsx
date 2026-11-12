import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { StructureManager } from "@/components/structure/structure-manager";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit, canView } from "@/lib/auth/permissions";
import { loadStructure } from "@/lib/structure/queries";

export const metadata: Metadata = {
  title: "Spirit Flow",
  robots: { index: false, follow: false },
};

const text = {
  title: "Stock Points, Outlets And Counters",
  subtitle:
    "Stock points hold the stock. Outlets sell, at their own rates. Counters are the billing points of an outlet.",
} as const;

async function StructureContent() {
  const me = await getCurrentUser();
  if (!me || !canView(me, "structure")) notFound();

  const data = await loadStructure();

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[1.5rem] font-semibold leading-tight tracking-[-0.02em]">
          {text.title}
        </h1>
        <p className="mt-0.5 text-[0.88rem] text-muted">{text.subtitle}</p>
      </div>
      <StructureManager data={data} canEdit={canEdit(me, "structure")} />
    </div>
  );
}

export default function StockOutletsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <StructureContent />
    </Suspense>
  );
}
