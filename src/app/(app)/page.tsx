import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import {
  ActivitySection,
  ComingSoonSection,
  HeadlineSection,
  PositionsSection,
  TrendsSection,
  dashboardText,
  type DashboardRange,
} from "@/components/dashboard/sections";
import { SectionLabel, SectionSkeleton } from "@/components/dashboard/ui";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canView } from "@/lib/auth/permissions";
import { monthKeys, shiftYears } from "@/lib/dashboard/queries";
import { displayDate } from "@/lib/reports/dates";
import { loadPeriod } from "@/lib/period/queries";
import { financialYearLabel } from "@/lib/period/financial-year";
import { todayInIndia } from "@/lib/vouchers/transaction-date";

export const metadata: Metadata = {
  title: "Spirit Flow",
  robots: { index: false, follow: false },
};

// All visible text sits here so it can be translated later.
const text = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Good evening",
  intro: "Here is how the hotel is doing.",
  financialYear: "Financial Year",
  updated: "Updated",
  ist: "IST",
  trends: "Monthly Trends",
  positions: "Positions",
  activity: "Activity And Checks",
  soon: "Coming Soon",
  noAccess: "Your role has no access yet. Ask the System Admin to switch on what you need.",
} as const;

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(
      new Date(),
    ),
  );
  if (hour < 12) return text.morning;
  if (hour < 17) return text.afternoon;
  return text.evening;
}

function updatedAt(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

async function DashboardContent() {
  const user = await getCurrentUser();
  if (!user) return null;

  // The Dashboard is a feature the System Admin switches on for each role.
  if (!canView(user, "dashboard")) {
    return (
      <div>
        <h1 className="text-[1.3rem] font-semibold leading-tight tracking-[-0.02em]">
          {greeting()}, {user.fullName}
        </h1>
        <p className="mt-0.5 text-[0.88rem] text-muted">{user.roleName}</p>
        <p className="mt-4 text-[0.9rem]">{text.noAccess}</p>
      </div>
    );
  }

  // The financial year picked in the top bar, up to today when it is the current one.
  const period = await loadPeriod(user.id);
  const today = todayInIndia();
  const to = period.end < today ? period.end : today;
  const range: DashboardRange = {
    from: period.start,
    to,
    prevFrom: shiftYears(period.start, -1),
    prevTo: shiftYears(to, -1),
    months: monthKeys(period.start, to),
    today,
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2.5">
        <div>
          <h1 className="text-[1.35rem] font-semibold leading-[1.15] tracking-[-0.025em] sm:text-[1.6rem]">
            {greeting()}, {user.fullName}
          </h1>
          <p className="mt-[3px] text-[0.88rem] text-muted">{text.intro}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[0.8rem] text-muted">
          <span className="inline-flex items-center rounded-full bg-surface px-[11px] py-[5px] shadow-[0_0_0_1px_var(--color-divider)]">
            {text.financialYear}&nbsp;
            <strong className="font-semibold text-text">{financialYearLabel(period.selected)}</strong>
            ,&nbsp;{displayDate(range.from)} to {displayDate(range.to)}
          </span>
          <span className="inline-flex items-center rounded-full bg-surface px-[11px] py-[5px] shadow-[0_0_0_1px_var(--color-divider)]">
            {text.updated}&nbsp;
            <strong className="font-semibold text-text">
              {updatedAt()} {text.ist}
            </strong>
          </span>
          <RefreshButton />
        </div>
      </div>

      <HeadlineSection user={user} range={range} />

      <SectionLabel>{text.trends}</SectionLabel>
      <TrendsSection user={user} range={range} />

      <SectionLabel>{text.positions}</SectionLabel>
      <PositionsSection user={user} range={range} />

      <SectionLabel>{text.activity}</SectionLabel>
      <Suspense fallback={<SectionSkeleton height="h-64" />}>
        <ActivitySection user={user} range={range} />
      </Suspense>

      <SectionLabel note={dashboardText.soonNote}>{text.soon}</SectionLabel>
      <ComingSoonSection />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <DashboardContent />
    </Suspense>
  );
}
