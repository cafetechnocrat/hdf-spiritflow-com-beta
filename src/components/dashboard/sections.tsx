import Link from "next/link";
import { Suspense } from "react";
import type { ReactNode } from "react";
import { canEdit, canView } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/auth/current-user";
import {
  formatAmountText,
  formatBalance,
  formatPaise,
  sumPaise,
} from "@/lib/format/money";
import { PALETTE, SERIES_COLORS } from "@/lib/dashboard/palette";
import {
  byMonth,
  loadBalanceTotals,
  loadBooksCheck,
  loadLatestVouchers,
  loadMonthly,
  loadPositions,
  loadRegisterMonthly,
  loadSystemSnapshot,
  monthLabel,
  totalOf,
  type BalanceGroup,
  type PositionRow,
} from "@/lib/dashboard/queries";
import { displayDate } from "@/lib/reports/dates";
import { MonthlyChart } from "./monthly-chart";
import {
  DeltaPill,
  Icon,
  KpiCard,
  LockedCard,
  Panel,
  PanelHeader,
  SectionError,
  SectionSkeleton,
} from "./ui";

const ZERO = BigInt(0);

// All visible text sits here so it can be translated later.
const text = {
  vsLastYear: "against the same period last year",
  sales: "Sales",
  purchases: "Purchases",
  grossProfit: "Gross Profit",
  grossLoss: "Gross Loss",
  cashBank: "Cash And Bank",
  accounts: (count: number) => `${count} ${count === 1 ? "account" : "accounts"}`,
  asOn: "as on",
  trendsFailed: "Monthly Trends",
  incomeExpenses: "Income And Expenses",
  incomeExpensesSub: "By month, in lakhs",
  salesPurchases: "Sales And Purchases",
  salesPurchasesSub: "By month, in lakhs",
  income: "Income",
  expenses: "Expenses",
  other: "Others",
  month: "Month",
  total: "Total",
  positionsFailed: "Positions",
  assets: "Assets",
  assetsSub: "Everything the hotel owns",
  liabilities: "Liabilities",
  liabilitiesSub: "Everything the hotel owes, capital left out",
  netValuation: "Net Valuation",
  netValuationSub: "Assets minus liabilities",
  surplus: "Assets are more than liabilities",
  shortfall: "Liabilities are more than assets",
  level: "Assets equal liabilities",
  cashBankSub: "Balance of each account today",
  receivables: "Receivables",
  receivablesSub: "Owed to the hotel by customers",
  payables: "Payables",
  payablesSub: "Owed by the hotel to vendors",
  openStatement: "Open the Ledger Statement",
  nothingYet: "Nothing here yet.",
  latest: "Latest Vouchers",
  latestSub: "The six most recent",
  viewAll: "View All",
  voucher: "Voucher",
  date: "Date",
  details: "Details",
  amount: "Amount",
  noVouchers: "No vouchers yet. Enter the first one from New Voucher.",
  books: "Books Check",
  booksSub: "Quick health of the accounts",
  tbMatches: "Trial Balance Matches",
  tbDiffers: "Trial Balance Does Not Match",
  tbDetail: (amount: string) => `Debit and credit differ by ${amount}`,
  enteredToday: (count: number) =>
    `${count} ${count === 1 ? "Voucher" : "Vouchers"} Entered Today`,
  latestAt: (time: string) => `Latest at ${time} IST`,
  noneToday: "Nothing entered yet today",
  voidMonth: (count: number) => `${count} Void ${count === 1 ? "Voucher" : "Vouchers"} This Month`,
  voidDetail: "Left out of every total",
  quick: "Quick Actions",
  quickSub: "Only what your access allows",
  newVoucher: "New Voucher",
  dayBook: "Day Book",
  trialBalance: "Trial Balance",
  profitLoss: "Profit And Loss",
  system: "System",
  systemSub: "Shown to the System Admin only",
  activeUsers: "Active Users",
  activeRoles: "Active Roles",
  customAccess: "Custom Access",
  soon: "Coming Soon",
  soonNote: "Lights up when each module is live",
  failedTitle: "Section Not Loaded",
} as const;

// What the dashboard asks of each section: the financial year range, the same
// range a year earlier for the comparison, and the months in between.
export type DashboardRange = {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  months: string[];
  today: string;
};

const rupees = (paise: bigint) => Number(paise) / 100;
const lakhs = (paise: bigint) => Number(paise) / 10_000_000;

function Amount({ paise, side }: { paise: bigint; side?: string }) {
  return (
    <>
      <span className="mr-0.5 text-[0.95rem] font-medium text-muted">&#8377;</span>
      {formatPaise(paise)}
      {side ? <small className="ml-1 text-[0.9rem] font-medium text-muted">{side}</small> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Headline cards. Each card has its own lock and loads on its own.

type CardProps = { user: CurrentUser; range: DashboardRange };

async function SalesCard({ user, range }: CardProps) {
  if (!canView(user, "dash_sales")) return <LockedCard name={text.sales} />;
  const loaded = await Promise.all([
    loadRegisterMonthly("dash_sales", "sales", range.from, range.to),
    loadRegisterMonthly("dash_sales", "sales", range.prevFrom, range.prevTo),
  ]).catch(() => null);
  if (!loaded) return <SectionError title={text.sales} />;
  const [now, prev] = loaded;
  return (
    <KpiCard
      name={text.sales}
      icon="M3 17l6-6 4 4 8-9M15 6h6v6"
      iconBackground="#E9EDF8"
      iconColor={PALETTE.blue}
      value={<Amount paise={totalOf(now)} />}
      footer={
        <DeltaPill
          current={totalOf(now)}
          previous={totalOf(prev)}
          goodWhen="up"
          label={text.vsLastYear}
        />
      }
      spark={byMonth(now, range.months).map(rupees)}
      sparkColor={PALETTE.blue}
    />
  );
}

async function PurchasesCard({ user, range }: CardProps) {
  if (!canView(user, "dash_purchases")) return <LockedCard name={text.purchases} />;
  const loaded = await Promise.all([
    loadRegisterMonthly("dash_purchases", "purchase", range.from, range.to),
    loadRegisterMonthly("dash_purchases", "purchase", range.prevFrom, range.prevTo),
  ]).catch(() => null);
  if (!loaded) return <SectionError title={text.purchases} />;
  const [now, prev] = loaded;
  return (
    <KpiCard
      name={text.purchases}
      icon="M3 4h2l2 11h11l2-8H6M9 20h.01M17 20h.01"
      iconBackground="#FDF1D9"
      iconColor="#A46A00"
      value={<Amount paise={totalOf(now)} />}
      footer={
        <DeltaPill
          current={totalOf(now)}
          previous={totalOf(prev)}
          goodWhen="down"
          label={text.vsLastYear}
        />
      }
      spark={byMonth(now, range.months).map(rupees)}
      sparkColor={PALETTE.orange}
    />
  );
}

// Gross profit is trading income minus trading expenses, the same figure as on
// the Profit And Loss report.
async function GrossProfitCard({ user, range }: CardProps) {
  if (!canView(user, "dash_gross_profit")) return <LockedCard name={text.grossProfit} />;
  const loaded = await Promise.all([
    loadMonthly("dash_gross_profit", range.from, range.to, true),
    loadMonthly("dash_gross_profit", range.prevFrom, range.prevTo, true),
  ]).catch(() => null);
  if (!loaded) return <SectionError title={text.grossProfit} />;
  const [now, prev] = loaded;

  const profit = (rows: typeof now) =>
    sumPaise(rows.map((r) => r.income)) - sumPaise(rows.map((r) => r.expense));
  const grossNow = profit(now);
  const monthlyProfit = range.months.map((month) => {
    const row = now.find((r) => r.month === month);
    return row ? rupees(row.income - row.expense) : 0;
  });

  return (
    <KpiCard
      name={grossNow < ZERO ? text.grossLoss : text.grossProfit}
      icon="M7 5h10M7 10h10M7 5c5 0 7 2 7 5s-2 5-7 5H7l8 5"
      iconBackground="#E3F4EE"
      iconColor={PALETTE.green}
      value={<Amount paise={grossNow < ZERO ? -grossNow : grossNow} />}
      footer={
        <DeltaPill
          current={grossNow}
          previous={profit(prev)}
          goodWhen="up"
          label={text.vsLastYear}
        />
      }
      spark={monthlyProfit}
      sparkColor={PALETTE.green}
    />
  );
}

async function CashBankCard({ user, range }: CardProps) {
  if (!canView(user, "dash_cash_bank")) return <LockedCard name={text.cashBank} />;
  const cash = await loadPositions("dash_cash_bank", "cash_bank", range.to).catch(() => null);
  if (!cash) return <SectionError title={text.cashBank} />;
  const cashNet = sumPaise(cash.map((p) => p.net));
  const cashSide = cashNet > ZERO ? "Dr" : cashNet < ZERO ? "Cr" : "";
  return (
    <KpiCard
      name={text.cashBank}
      icon="M3 9a3 3 0 013-3h12a3 3 0 013 3v6a3 3 0 01-3 3H6a3 3 0 01-3-3zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"
      iconBackground="#EAF0F8"
      iconColor="#102A6B"
      value={<Amount paise={cashNet < ZERO ? -cashNet : cashNet} side={cashSide} />}
      footer={
        <>
          <span className="rounded-full bg-track px-2 py-0.5 text-[0.74rem] font-semibold">
            {text.accounts(cash.length)}
          </span>
          {text.asOn} {displayDate(range.to)}
        </>
      }
      sparkColor={PALETTE.sky}
    />
  );
}

export function HeadlineSection({ user, range }: CardProps) {
  const fallback = <SectionSkeleton height="h-44" />;
  return (
    <div className="grid grid-cols-2 gap-3.5 min-[1100px]:grid-cols-4">
      <Suspense fallback={fallback}>
        <SalesCard user={user} range={range} />
      </Suspense>
      <Suspense fallback={fallback}>
        <PurchasesCard user={user} range={range} />
      </Suspense>
      <Suspense fallback={fallback}>
        <GrossProfitCard user={user} range={range} />
      </Suspense>
      <Suspense fallback={fallback}>
        <CashBankCard user={user} range={range} />
      </Suspense>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Monthly trends. The two charts have their own locks.

async function IncomeExpensesChart({ user, range }: CardProps) {
  if (!canView(user, "dash_income_expenses")) {
    return <LockedCard name={text.incomeExpenses} subtitle={text.incomeExpensesSub} />;
  }
  const monthly = await loadMonthly("dash_income_expenses", range.from, range.to, false).catch(
    () => null,
  );
  if (!monthly) return <SectionError title={text.incomeExpenses} />;
  const labels = range.months.map(monthLabel);
  const incomeBy = range.months.map((m) => monthly.find((r) => r.month === m)?.income ?? ZERO);
  const expenseBy = range.months.map((m) => monthly.find((r) => r.month === m)?.expense ?? ZERO);
  const period = `${monthLabel(range.months[0])} to ${monthLabel(range.months[range.months.length - 1])}`;
  return (
    <MonthlyChart
      title={text.incomeExpenses}
      subtitle={`${text.incomeExpensesSub}. ${period}`}
      months={labels}
      stacked={false}
      kind="lines"
      series={[
        { name: text.income, color: PALETTE.blue, values: incomeBy.map(lakhs) },
        { name: text.expenses, color: PALETTE.orange, values: expenseBy.map(lakhs) },
      ]}
      tableHead={[text.month, text.income, text.expenses]}
      tableRows={labels.map((label, i) => [label, formatPaise(incomeBy[i]), formatPaise(expenseBy[i])])}
      describe={`${text.incomeExpenses}, ${period}. The table view lists the exact amounts.`}
    />
  );
}

async function SalesPurchasesChart({ user, range }: CardProps) {
  if (!canView(user, "dash_sales_by_month")) {
    return <LockedCard name={text.salesPurchases} subtitle={text.salesPurchasesSub} />;
  }
  const loaded = await Promise.all([
    loadRegisterMonthly("dash_sales_by_month", "sales", range.from, range.to),
    loadRegisterMonthly("dash_sales_by_month", "purchase", range.from, range.to),
  ]).catch(() => null);
  if (!loaded) return <SectionError title={text.salesPurchases} />;
  const [sales, purchases] = loaded;
  const labels = range.months.map(monthLabel);
  const salesBy = byMonth(sales, range.months);
  const purchasesBy = byMonth(purchases, range.months);
  const period = `${monthLabel(range.months[0])} to ${monthLabel(range.months[range.months.length - 1])}`;
  return (
    <MonthlyChart
      title={text.salesPurchases}
      subtitle={`${text.salesPurchasesSub}. ${period}`}
      months={labels}
      stacked={false}
      kind="lines"
      series={[
        { name: text.sales, color: PALETTE.blue, values: salesBy.map(lakhs) },
        { name: text.purchases, color: PALETTE.orange, values: purchasesBy.map(lakhs) },
      ]}
      tableHead={[text.month, text.sales, text.purchases]}
      tableRows={labels.map((label, i) => [label, formatPaise(salesBy[i]), formatPaise(purchasesBy[i])])}
      describe={`${text.salesPurchases}, ${period}. The table view lists the exact amounts.`}
    />
  );
}

export function TrendsSection({ user, range }: CardProps) {
  const fallback = <SectionSkeleton height="h-80" />;
  return (
    <div className="grid gap-3.5 min-[1100px]:grid-cols-2">
      <Suspense fallback={fallback}>
        <IncomeExpensesChart user={user} range={range} />
      </Suspense>
      <Suspense fallback={fallback}>
        <SalesPurchasesChart user={user} range={range} />
      </Suspense>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Positions

function BalanceBar({
  name,
  net,
  share,
  color,
}: {
  name: string;
  net: bigint;
  share: number;
  color: string;
}) {
  return (
    <div className="grid gap-[5px]">
      <div className="flex justify-between gap-2 text-[0.88rem]">
        <span className="min-w-0 truncate">{name}</span>
        <span className="font-semibold tabular-nums">&#8377;{formatBalance(net)}</span>
      </div>
      <div className="h-[7px] overflow-hidden rounded-full bg-track" role="presentation">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, share)}%`, background: color }} />
      </div>
    </div>
  );
}

// The few largest balances, with the rest added together.
function topBalances(rows: PositionRow[], keep: number): { name: string; net: bigint }[] {
  const sorted = [...rows].sort((a, b) => {
    const left = a.net < ZERO ? -a.net : a.net;
    const right = b.net < ZERO ? -b.net : b.net;
    return right > left ? 1 : -1;
  });
  const head = sorted.slice(0, keep).map((r) => ({ name: r.name, net: r.net }));
  const tail = sorted.slice(keep);
  if (tail.length > 0) head.push({ name: text.other, net: sumPaise(tail.map((r) => r.net)) });
  return head;
}

function shareOf(net: bigint, total: bigint): number {
  const absolute = net < ZERO ? -net : net;
  const whole = total < ZERO ? -total : total;
  return whole === ZERO ? 0 : Number((absolute * BigInt(100)) / whole);
}

const absSum = (rows: PositionRow[]) => sumPaise(rows.map((r) => (r.net < ZERO ? -r.net : r.net)));
const totalNet = (rows: PositionRow[]) => sumPaise(rows.map((r) => r.net));

function PositionSummary({ rows, color }: { rows: PositionRow[]; color: string }) {
  const sum = totalNet(rows);
  const base = absSum(rows);
  return (
    <>
      <div className="mb-3 mt-1 text-[1.5rem] font-bold tracking-[-0.025em] tabular-nums">
        <span className="mr-0.5 text-[1rem] font-medium text-muted">&#8377;</span>
        {formatBalance(sum)}
      </div>
      <div className="grid gap-3">
        {topBalances(rows, 3).map((row) => (
          <BalanceBar key={row.name} name={row.name} net={row.net} share={shareOf(row.net, base)} color={color} />
        ))}
      </div>
    </>
  );
}

const emptyPosition = <p className="text-[0.86rem] text-muted">{text.nothingYet}</p>;

async function CashBankPanel({ user, range }: CardProps) {
  if (!canView(user, "dash_cash_bank_balances")) {
    return <LockedCard name={text.cashBank} subtitle={text.cashBankSub} />;
  }
  const cash = await loadPositions("dash_cash_bank_balances", "cash_bank", range.to).catch(() => null);
  if (!cash) return <SectionError title={text.cashBank} />;
  return (
    <Panel label={text.cashBank}>
      <PanelHeader title={text.cashBank} subtitle={text.cashBankSub} />
      {cash.length === 0 ? (
        emptyPosition
      ) : (
        <div className="grid gap-3">
          {cash.map((row, index) => (
            <BalanceBar
              key={row.ledgerId}
              name={row.name}
              net={row.net}
              share={shareOf(row.net, absSum(cash))}
              color={SERIES_COLORS[index % SERIES_COLORS.length]}
            />
          ))}
        </div>
      )}
      {canView(user, "report_ledger_statement") ? (
        <div className="mt-3 text-[0.8rem]">
          <Link href="/reports/ledger-statement" className="text-link hover:underline">
            {text.openStatement}
          </Link>
        </div>
      ) : null}
    </Panel>
  );
}

async function ReceivablesPanel({ user, range }: CardProps) {
  if (!canView(user, "dash_receivables")) {
    return <LockedCard name={text.receivables} subtitle={text.receivablesSub} />;
  }
  const rows = await loadPositions("dash_receivables", "receivable", range.to).catch(() => null);
  if (!rows) return <SectionError title={text.receivables} />;
  return (
    <Panel label={text.receivables}>
      <PanelHeader title={text.receivables} subtitle={text.receivablesSub} />
      {rows.length === 0 ? emptyPosition : <PositionSummary rows={rows} color={PALETTE.green} />}
    </Panel>
  );
}

async function PayablesPanel({ user, range }: CardProps) {
  if (!canView(user, "dash_payables")) {
    return <LockedCard name={text.payables} subtitle={text.payablesSub} />;
  }
  const rows = await loadPositions("dash_payables", "payable", range.to).catch(() => null);
  if (!rows) return <SectionError title={text.payables} />;
  return (
    <Panel label={text.payables}>
      <PanelHeader title={text.payables} subtitle={text.payablesSub} />
      {rows.length === 0 ? emptyPosition : <PositionSummary rows={rows} color={PALETTE.vermilion} />}
    </Panel>
  );
}

// The groups behind a total, largest first. Small ones are added together.
function GroupBars({ groups, color }: { groups: BalanceGroup[]; color: string }) {
  const sorted = [...groups].sort((a, b) => {
    const left = a.net < ZERO ? -a.net : a.net;
    const right = b.net < ZERO ? -b.net : b.net;
    return right > left ? 1 : -1;
  });
  const head = sorted.slice(0, 3);
  const tail = sorted.slice(3);
  if (tail.length > 0) head.push({ name: text.other, net: sumPaise(tail.map((g) => g.net)) });
  const base = sumPaise(sorted.map((g) => (g.net < ZERO ? -g.net : g.net)));
  return (
    <div className="grid gap-3">
      {head.map((group) => (
        <BalanceBar
          key={group.name}
          name={group.name}
          net={group.net}
          share={shareOf(group.net, base)}
          color={color}
        />
      ))}
    </div>
  );
}

async function AssetsPanel({ user, range }: CardProps) {
  if (!canView(user, "dash_assets")) {
    return <LockedCard name={text.assets} subtitle={text.assetsSub} />;
  }
  const groups = await loadBalanceTotals("dash_assets", "assets", range.to).catch(() => null);
  if (!groups) return <SectionError title={text.assets} />;
  const total = sumPaise(groups.map((g) => g.net));
  return (
    <Panel label={text.assets}>
      <PanelHeader title={text.assets} subtitle={text.assetsSub} />
      {groups.length === 0 ? (
        emptyPosition
      ) : (
        <>
          <div className="mb-3 mt-1 text-[1.5rem] font-bold tracking-[-0.025em] tabular-nums">
            <span className="mr-0.5 text-[1rem] font-medium text-muted">&#8377;</span>
            {formatBalance(total)}
          </div>
          <GroupBars groups={groups} color={PALETTE.blue} />
        </>
      )}
    </Panel>
  );
}

async function LiabilitiesPanel({ user, range }: CardProps) {
  if (!canView(user, "dash_liabilities")) {
    return <LockedCard name={text.liabilities} subtitle={text.liabilitiesSub} />;
  }
  const groups = await loadBalanceTotals("dash_liabilities", "liabilities", range.to).catch(
    () => null,
  );
  if (!groups) return <SectionError title={text.liabilities} />;
  const total = sumPaise(groups.map((g) => g.net));
  return (
    <Panel label={text.liabilities}>
      <PanelHeader title={text.liabilities} subtitle={text.liabilitiesSub} />
      {groups.length === 0 ? (
        emptyPosition
      ) : (
        <>
          <div className="mb-3 mt-1 text-[1.5rem] font-bold tracking-[-0.025em] tabular-nums">
            <span className="mr-0.5 text-[1rem] font-medium text-muted">&#8377;</span>
            {formatBalance(total)}
          </div>
          <GroupBars groups={groups} color={PALETTE.orange} />
        </>
      )}
    </Panel>
  );
}

// Assets minus liabilities. Green when assets are more, red when liabilities are.
async function NetValuationPanel({ user, range }: CardProps) {
  if (!canView(user, "dash_net_valuation")) {
    return <LockedCard name={text.netValuation} subtitle={text.netValuationSub} />;
  }
  const loaded = await Promise.all([
    loadBalanceTotals("dash_net_valuation", "assets", range.to),
    loadBalanceTotals("dash_net_valuation", "liabilities", range.to),
  ]).catch(() => null);
  if (!loaded) return <SectionError title={text.netValuation} />;
  const assets = sumPaise(loaded[0].map((g) => g.net));
  const liabilities = sumPaise(loaded[1].map((g) => g.net));
  const net = assets - liabilities;
  const tone =
    net > ZERO
      ? { box: "bg-success-bg", figure: "text-success", note: text.surplus }
      : net < ZERO
        ? { box: "bg-error-bg", figure: "text-error", note: text.shortfall }
        : { box: "bg-track", figure: "text-muted", note: text.level };
  return (
    <Panel label={text.netValuation}>
      <PanelHeader title={text.netValuation} subtitle={text.netValuationSub} />
      <div className={`rounded-[14px] px-3.5 py-3 ${tone.box}`}>
        <div className={`text-[1.5rem] font-bold tracking-[-0.025em] tabular-nums ${tone.figure}`}>
          <span className="mr-0.5 text-[1rem] font-medium">&#8377;</span>
          {net < ZERO ? "-" : ""}
          {formatPaise(net < ZERO ? -net : net)}
        </div>
        <div className={`mt-0.5 text-[0.8rem] font-medium ${tone.figure}`}>{tone.note}</div>
      </div>
      <div className="mt-3 grid gap-1.5 text-[0.86rem]">
        <div className="flex justify-between gap-2">
          <span>{text.assets}</span>
          <span className="font-semibold tabular-nums">&#8377;{formatPaise(assets)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>{text.liabilities}</span>
          <span className="font-semibold tabular-nums">&#8377;{formatPaise(liabilities)}</span>
        </div>
      </div>
    </Panel>
  );
}

export function PositionsSection({ user, range }: CardProps) {
  const fallback = <SectionSkeleton height="h-56" />;
  return (
    <div className="grid gap-3.5 min-[900px]:grid-cols-3">
      <Suspense fallback={fallback}>
        <CashBankPanel user={user} range={range} />
      </Suspense>
      <Suspense fallback={fallback}>
        <ReceivablesPanel user={user} range={range} />
      </Suspense>
      <Suspense fallback={fallback}>
        <PayablesPanel user={user} range={range} />
      </Suspense>
      <Suspense fallback={fallback}>
        <AssetsPanel user={user} range={range} />
      </Suspense>
      <Suspense fallback={fallback}>
        <LiabilitiesPanel user={user} range={range} />
      </Suspense>
      <Suspense fallback={fallback}>
        <NetValuationPanel user={user} range={range} />
      </Suspense>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity and checks

function Check({
  tone,
  icon,
  title,
  detail,
}: {
  tone: "ok" | "info" | "warn";
  icon: string;
  title: string;
  detail: string;
}) {
  const tones = {
    ok: "bg-success-bg text-success",
    info: "bg-accent-soft text-link",
    warn: "bg-warn-bg text-warn",
  } as const;
  return (
    <div className="flex items-start gap-[11px] rounded-[13px] bg-background px-3 py-[11px]">
      <span className={`grid h-7 w-7 flex-none place-items-center rounded-full ${tones[tone]}`}>
        <Icon d={icon} className="h-[15px] w-[15px]" />
      </span>
      <div>
        <strong className="block text-[0.88rem] font-semibold">{title}</strong>
        <span className="text-[0.78rem] text-muted">{detail}</span>
      </div>
    </div>
  );
}

function QuickLink({ href, icon, children }: { href: string; icon: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-[52px] items-center gap-2.5 rounded-[14px] bg-background px-3 py-2.5 text-[0.86rem] font-semibold text-text hover:bg-accent-soft hover:text-link"
    >
      <Icon d={icon} className="h-5 w-5 flex-none text-accent" />
      {children}
    </Link>
  );
}

export async function ActivitySection({ user, range }: { user: CurrentUser; range: DashboardRange }) {
  const latest = async (): Promise<ReactNode> => {
    if (!canView(user, "dash_latest_vouchers")) {
      return (
        <LockedCard
          name={text.latest}
          subtitle={text.latestSub}
          className="min-[1100px]:col-span-2"
        />
      );
    }
    const loaded = await loadLatestVouchers().catch(() => null);
    if (!loaded) return <SectionError title={text.latest} />;
    const rows = loaded;
    return (
      <Panel className="min-[1100px]:col-span-2" label={text.latest}>
        <PanelHeader
          title={text.latest}
          subtitle={text.latestSub}
          action={
            <Link
              href="/transactions"
              className="inline-flex min-h-[34px] items-center rounded-full bg-surface px-3 text-[0.8rem] font-medium shadow-[0_0_0_1px_var(--color-divider)] hover:bg-background"
            >
              {text.viewAll}
            </Link>
          }
        />
        {rows.length === 0 ? (
          <p className="text-[0.86rem] text-muted">{text.noVouchers}</p>
        ) : (
          <ul>
            {rows.map((row) => (
              <li
                key={row.id}
                className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 border-b border-divider py-2.5 text-[0.86rem] last:border-b-0 sm:grid-cols-[1.2fr_0.7fr_2fr_auto]"
              >
                <div>
                  <strong className="font-semibold">{row.typeName}</strong>
                  <div className="text-[0.78rem] text-muted">{row.referenceNo}</div>
                </div>
                <div className="order-3 text-muted sm:order-none">{displayDate(row.date)}</div>
                <div className="order-4 col-span-2 sm:order-none sm:col-span-1">{row.details}</div>
                <div className="text-right font-semibold tabular-nums">
                  &#8377;{formatAmountText(row.totalText)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    );
  };

  const books = async (): Promise<ReactNode> => {
    if (!canView(user, "dash_books_check")) {
      return <LockedCard name={text.books} subtitle={text.booksSub} />;
    }
    const loaded = await loadBooksCheck(range.today).catch(() => null);
    if (!loaded) return <SectionError title={text.books} />;
    const check = loaded;
    return (
      <Panel label={text.books}>
        <PanelHeader title={text.books} subtitle={text.booksSub} />
        <div className="grid gap-2.5">
          {check.difference === ZERO ? (
            <Check
              tone="ok"
              icon="M5 12l4 4 10-10"
              title={text.tbMatches}
              detail={text.tbDetail(`\u20B9${formatPaise(check.difference)}`)}
            />
          ) : (
            <Check
              tone="warn"
              icon="M12 8v5M12 17h.01"
              title={text.tbDiffers}
              detail={text.tbDetail(`\u20B9${formatPaise(check.difference)}`)}
            />
          )}
          <Check
            tone="info"
            icon="M12 8v5M12 17h.01"
            title={text.enteredToday(check.enteredToday)}
            detail={check.latestTime ? text.latestAt(check.latestTime) : text.noneToday}
          />
          <Check
            tone={check.voidThisMonth > 0 ? "warn" : "ok"}
            icon={check.voidThisMonth > 0 ? "M12 8v5M12 17h.01" : "M5 12l4 4 10-10"}
            title={text.voidMonth(check.voidThisMonth)}
            detail={text.voidDetail}
          />
        </div>
      </Panel>
    );
  };

  const system = async (): Promise<ReactNode> => {
    if (!user.isSystemAdmin) return null;
    const loaded = await loadSystemSnapshot().catch(() => null);
    if (!loaded) return <SectionError title={text.system} />;
    const snapshot = loaded;
    return (
      <Panel className="min-[1100px]:col-span-2" label={text.system}>
        <PanelHeader title={text.system} subtitle={text.systemSub} />
        <div className="grid grid-cols-3 gap-2.5">
          {[
            [snapshot.activeUsers, text.activeUsers],
            [snapshot.activeRoles, text.activeRoles],
            [snapshot.customAccess, text.customAccess],
          ].map(([count, label]) => (
            <div key={label} className="rounded-[13px] bg-background p-3 text-center">
              <b className="block text-[1.35rem] font-bold tracking-[-0.02em]">{count}</b>
              <span className="text-[0.72rem] text-muted">{label}</span>
            </div>
          ))}
        </div>
      </Panel>
    );
  };

  const [latestNode, booksNode, systemNode] = await Promise.all([latest(), books(), system()]);

  const links: { href: string; icon: string; label: string }[] = [];
  if (canEdit(user, "transactions")) {
    links.push({ href: "/transactions", icon: "M12 5v14M5 12h14", label: text.newVoucher });
  }
  // Each report link shows only when that report is open for the person.
  if (canView(user, "report_day_book")) {
    links.push({
      href: "/reports/day-book",
      icon: "M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4zM5 17a3 3 0 013-3h11",
      label: text.dayBook,
    });
  }
  if (canView(user, "report_trial_balance")) {
    links.push({
      href: "/reports/trial-balance",
      icon: "M4 20V10M10 20V4M16 20v-7M22 20H2",
      label: text.trialBalance,
    });
  }
  if (canView(user, "report_profit_loss")) {
    links.push({ href: "/reports/profit-loss", icon: "M3 17l6-6 4 4 8-9", label: text.profitLoss });
  }

  return (
    <div className="grid gap-3.5 min-[900px]:grid-cols-2 min-[1100px]:grid-cols-3">
      {latestNode}
      {booksNode}
      {links.length > 0 ? (
        <Panel label={text.quick}>
          <PanelHeader title={text.quick} subtitle={text.quickSub} />
          <div className="grid grid-cols-2 gap-2.5">
            {links.map((link) => (
              <QuickLink key={link.href + link.label} href={link.href} icon={link.icon}>
                {link.label}
              </QuickLink>
            ))}
          </div>
        </Panel>
      ) : null}
      {systemNode}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coming soon

// The modules that are planned. Each card is switched to live data when its
// module is built.
const PLANNED: { name: string; note: string; needs: string; bars: number[] }[] = [
  { name: "Bar Sales Today", note: "Live bar sales by outlet.", needs: "Needs the Bar POS.", bars: [40, 65, 50, 80, 60, 90] },
  { name: "Stock Value", note: "Stock at cost by category and stock point.", needs: "Needs the stock reports.", bars: [70, 55, 85, 45, 65, 75] },
  { name: "Low Stock Items", note: "Items below their reorder level.", needs: "Needs stock operations.", bars: [30, 50, 35, 60, 40, 55] },
  { name: "Outlet-Wise Sales", note: "Each outlet's sales this month.", needs: "Needs outlets and the POS.", bars: [85, 60, 45, 70, 35, 50] },
  { name: "Room Occupancy", note: "Rooms in use today.", needs: "Needs Guest Flow.", bars: [55, 75, 65, 85, 70, 60] },
  { name: "Staff Attendance", note: "Who is on duty today.", needs: "Needs HR Flow.", bars: [80, 80, 70, 90, 75, 85] },
];

export function ComingSoonSection() {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2 min-[1100px]:grid-cols-3">
      {PLANNED.map((card) => (
        <section
          key={card.name}
          aria-label={`${card.name} (${text.soon})`}
          className="min-w-0 rounded-[18px] border-[1.5px] border-dashed border-border-soft p-3.5 sm:px-[18px] sm:py-4"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[0.78rem] font-semibold uppercase tracking-[0.05em] text-muted">
              {card.name}
            </span>
            <span className="rounded-full bg-track px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.05em] text-muted">
              {text.soon}
            </span>
          </div>
          <div className="mt-2.5 text-[1.5rem] font-bold tracking-[0.05em] text-[#A8AFC0]" aria-hidden="true">
            &#8212; &#8212; &#8212;
          </div>
          <div className="mt-1.5 text-[0.78rem] text-muted">
            {card.note} {card.needs}
          </div>
          <div className="mt-2.5 flex h-[38px] items-end gap-[5px]" aria-hidden="true">
            {card.bars.map((height, index) => (
              <i key={index} className="flex-1 rounded-t bg-track" style={{ height: `${height}%` }} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export const dashboardText = { soon: text.soon, soonNote: text.soonNote };
