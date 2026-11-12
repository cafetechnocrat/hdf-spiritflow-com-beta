import "server-only";
import {
  formatBalance,
  formatPaise,
  parseAmountToPaise,
  parseSignedPaise,
  sumPaise,
} from "@/lib/format/money";
import { REPORT_FEATURES, type ReportFeature } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { addDays, displayDate } from "./dates";
import type { ReportParams } from "./params";
import {
  REPORT_TITLES,
  type Cell,
  type DayBookBlock,
  type DocKpi,
  type DocRow,
  type DocTable,
  type FilterOption,
  type ReportDocument,
  type ReportKey,
  type RowStyle,
} from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const ZERO = BigInt(0);
// The most voucher rows a Day Book shows. Narrow the dates to see fewer.
const DAY_BOOK_LIMIT = 5000;

export type ReportContext = {
  hotelName: string;
  generatedBy: string;
  generatedAt: string;
};

type Nature = "assets" | "liabilities" | "income" | "expenses";

type GroupRec = {
  id: string;
  name: string;
  parent_id: string | null;
  nature: Nature;
  sort_order: number;
  pl_section: "trading" | "profit_loss" | null;
  register_kind: "sales" | "purchase" | null;
};

type LedgerRec = { id: string; name: string; group_id: string };

type Chart = {
  groups: GroupRec[];
  ledgers: LedgerRec[];
  childrenOf: Map<string | null, GroupRec[]>;
  ledgersOf: Map<string, LedgerRec[]>;
  groupById: Map<string, GroupRec>;
};

// ---------------------------------------------------------------------------
// Small helpers

const blank: Cell = { text: "" };

function text(value: string): Cell {
  return { text: value };
}

// An amount from paise. The plain number is only for Excel cells.
function amount(paise: bigint): Cell {
  return { text: formatPaise(paise), value: Number(paise) / 100 };
}

function row(style: RowStyle, ...cells: Cell[]): DocRow {
  return { style, cells };
}

function kpi(label: string, value: string, sub?: string): DocKpi {
  return { label, value, sub };
}

// A card that shows an amount. The screen puts the rupee symbol in front of it.
function kpiMoney(label: string, value: string, sub?: string): DocKpi {
  return { label, value, sub, money: true };
}

export function generatedAtNow(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  return `${parts.replace(", ", " at ")} IST`;
}

function range(from: string, to: string): string {
  return from === to ? displayDate(from) : `${displayDate(from)} to ${displayDate(to)}`;
}

function baseDocument(
  key: ReportKey,
  ctx: ReportContext,
  period: string,
  filters: string,
): ReportDocument {
  return {
    key,
    title: REPORT_TITLES[key],
    hotelName: ctx.hotelName,
    period,
    filters,
    generatedBy: ctx.generatedBy,
    generatedAt: ctx.generatedAt,
    kpis: [],
    tables: [],
    notes: [],
    empty: false,
    emptyTitle: "Nothing To Show",
    emptyHint: "Change the dates or the filters.",
  };
}

// ---------------------------------------------------------------------------
// Data from the database

// Reads go through functions that check the lock of the report that asks, so a
// locked person gets nothing back even if they call the database directly.
async function loadChart(supabase: Supabase, feature: ReportFeature): Promise<Chart> {
  const [groupsResult, ledgersResult] = await Promise.all([
    supabase.rpc("report_chart_groups", { p_feature: feature }),
    supabase.rpc("report_chart_ledgers", { p_feature: feature }),
  ]);
  if (groupsResult.error || ledgersResult.error) throw new Error("chart");

  const groups = (groupsResult.data ?? []) as GroupRec[];
  const ledgers = (ledgersResult.data ?? []) as LedgerRec[];

  const childrenOf = new Map<string | null, GroupRec[]>();
  for (const group of groups) {
    const list = childrenOf.get(group.parent_id) ?? [];
    list.push(group);
    childrenOf.set(group.parent_id, list);
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }
  const ledgersOf = new Map<string, LedgerRec[]>();
  for (const ledger of ledgers) {
    const list = ledgersOf.get(ledger.group_id) ?? [];
    list.push(ledger);
    ledgersOf.set(ledger.group_id, list);
  }
  return {
    groups,
    ledgers,
    childrenOf,
    ledgersOf,
    groupById: new Map(groups.map((g) => [g.id, g])),
  };
}

// Debit minus credit per ledger, in paise. Positive is debit.
async function loadNets(
  supabase: Supabase,
  feature: ReportFeature,
  from: string | null,
  to: string | null,
  withOpening: boolean,
): Promise<Map<string, bigint>> {
  const { data, error } = await supabase.rpc("report_ledger_nets", {
    p_feature: feature,
    p_from: from,
    p_to: to,
    p_with_opening: withOpening,
  });
  if (error) throw new Error("nets");
  const nets = new Map<string, bigint>();
  for (const item of (data ?? []) as { ledger_id: string; net_text: string }[]) {
    nets.set(item.ledger_id, parseSignedPaise(item.net_text));
  }
  return nets;
}

export async function loadReportContext(generatedBy: string): Promise<ReportContext> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "hotel_name")
    .maybeSingle();
  return {
    hotelName: (data?.value as string | undefined) ?? "",
    generatedBy,
    generatedAt: generatedAtNow(),
  };
}

// The lists the filter bars need, all from the database.
export async function loadFilterOptions(feature: ReportFeature): Promise<{
  ledgers: FilterOption[];
  types: FilterOption[];
}> {
  const supabase = await createClient();
  const [ledgersResult, typesResult] = await Promise.all([
    supabase.rpc("report_chart_ledgers", { p_feature: feature }),
    supabase.rpc("report_voucher_types", { p_feature: feature }),
  ]);
  if (ledgersResult.error) throw new Error("ledgers");
  return {
    ledgers: ((ledgersResult.data ?? []) as LedgerRec[]).map((l) => ({
      value: l.id,
      label: l.name,
    })),
    types: ((typesResult.data ?? []) as { id: string; name: string }[]).map((t) => ({
      value: t.id,
      label: t.name,
    })),
  };
}

// ---------------------------------------------------------------------------
// Day Book

type DayBookRecord = {
  voucher_id: string;
  voucher_date: string;
  type_name: string;
  reference_no: string;
  reference: string | null;
  narration: string | null;
  status: "posted" | "void";
  debit_name: string;
  credit_name: string;
  amount_text: string;
};

async function buildDayBook(
  supabase: Supabase,
  params: ReportParams,
  ctx: ReportContext,
  names: { ledger: string; type: string },
): Promise<ReportDocument> {
  const { data, error } = await supabase.rpc("report_day_book", {
    p_from: params.from,
    p_to: params.to,
    p_type: params.typeId || null,
    p_ledger: params.ledgerId || null,
    p_show_void: params.showVoid,
    p_limit: DAY_BOOK_LIMIT + 1,
  });
  if (error) throw new Error("day book");

  const all = (data ?? []) as DayBookRecord[];
  const truncated = all.length > DAY_BOOK_LIMIT;
  const records = all.slice(0, DAY_BOOK_LIMIT);

  // Void vouchers are left out of every total. Count the ones left out.
  let voidLeftOut = 0;
  if (params.showVoid) {
    voidLeftOut = new Set(records.filter((r) => r.status === "void").map((r) => r.voucher_id)).size;
  } else {
    const { data: count } = await supabase.rpc("report_day_book_void_count", {
      p_from: params.from,
      p_to: params.to,
      p_type: params.typeId || null,
    });
    voidLeftOut = typeof count === "number" ? count : 0;
  }

  const posted = records.filter((r) => r.status === "posted");
  const total = sumPaise(posted.map((r) => parseAmountToPaise(r.amount_text) ?? ZERO));
  const voucherCount = new Set(posted.map((r) => r.voucher_id)).size;
  const dayCount = new Set(posted.map((r) => r.voucher_date)).size;

  const rows: DocRow[] = records.map((r) =>
    row(
      r.status === "void" ? "void" : "normal",
      text(displayDate(r.voucher_date)),
      text(`${r.type_name} ${r.reference_no}`),
      text(r.debit_name),
      text(r.credit_name),
      amount(parseAmountToPaise(r.amount_text) ?? ZERO),
    ),
  );
  if (rows.length > 0) rows.push(row("total", text("Total"), blank, blank, blank, amount(total)));

  const blocks: DayBookBlock[] = [];
  const byVoucher = new Map<string, DayBookBlock>();
  for (const r of records) {
    let block = byVoucher.get(r.voucher_id);
    if (!block) {
      block = {
        voucherId: r.voucher_id,
        title: r.type_name,
        referenceNo: r.reference_no,
        date: displayDate(r.voucher_date),
        void: r.status === "void",
        lines: [],
        note: [r.narration, r.reference].filter(Boolean).join(". "),
      };
      byVoucher.set(r.voucher_id, block);
      blocks.push(block);
    }
    const formatted = formatPaise(parseAmountToPaise(r.amount_text) ?? ZERO);
    block.lines.push({ side: "Dr", name: r.debit_name, amount: formatted });
    block.lines.push({ side: "Cr", name: r.credit_name, amount: formatted });
  }

  const doc = baseDocument(
    "day-book",
    ctx,
    range(params.from, params.to),
    `Type: ${names.type || "All"}. Ledger: ${names.ledger || "All"}. Void: ${params.showVoid ? "shown" : "not shown"}.`,
  );
  doc.kpis = [
    kpi("Vouchers", String(voucherCount), "Posted"),
    kpiMoney("Total Amount", formatPaise(total), "Debit equals credit"),
    kpi("Void Left Out", String(voidLeftOut), "Not counted"),
    kpi("Days", String(dayCount), "With entries"),
  ];
  doc.tables = [
    {
      paged: true,
      columns: [
        { label: "Date", align: "left" },
        { label: "Voucher", align: "left" },
        { label: "Debit", align: "left" },
        { label: "Credit", align: "left" },
        { label: "Amount", align: "right" },
      ],
      rows,
    },
  ];
  doc.blocks = blocks;
  doc.notes = [
    `Covers ${range(params.from, params.to)}. Void vouchers are left out of the total.`,
    "Total amount is the sum of every row. Each row is one debit and one credit of the same amount.",
  ];
  if (truncated) {
    doc.notes.push(`Only the newest ${DAY_BOOK_LIMIT} rows are shown. Narrow the dates to see the rest.`);
  }
  doc.empty = records.length === 0;
  doc.emptyTitle = "No Vouchers In This Range";
  return doc;
}

// ---------------------------------------------------------------------------
// Ledger Statement

type StatementRecord = {
  voucher_date: string;
  type_name: string;
  reference_no: string;
  other_name: string;
  debit_text: string | null;
  credit_text: string | null;
};

async function buildLedgerStatement(
  supabase: Supabase,
  chart: Chart,
  params: ReportParams,
  ctx: ReportContext,
): Promise<ReportDocument> {
  const ledger = chart.ledgers.find((l) => l.id === params.ledgerId);
  const doc = baseDocument(
    "ledger-statement",
    ctx,
    range(params.from, params.to),
    `Ledger: ${ledger?.name ?? "none chosen"}.`,
  );
  doc.tables = [{ columns: [], rows: [] }];

  if (!ledger) {
    doc.empty = true;
    doc.emptyTitle = "Choose A Ledger";
    doc.emptyHint = "Pick a ledger above to see its statement.";
    return doc;
  }

  const [openingNets, statement] = await Promise.all([
    loadNets(supabase, "report_ledger_statement", null, addDays(params.from, -1), true),
    supabase.rpc("report_ledger_statement", {
      p_ledger: ledger.id,
      p_from: params.from,
      p_to: params.to,
    }),
  ]);
  if (statement.error) throw new Error("statement");

  const opening = openingNets.get(ledger.id) ?? ZERO;
  const records = (statement.data ?? []) as StatementRecord[];

  let running = opening;
  let debitTotal = ZERO;
  let creditTotal = ZERO;
  // Worked out oldest first so the running balance is right, then listed newest
  // first. The opening balance is the oldest line, so it comes last.
  const entries: DocRow[] = [];
  for (const r of records) {
    const debit = r.debit_text ? (parseAmountToPaise(r.debit_text) ?? ZERO) : ZERO;
    const credit = r.credit_text ? (parseAmountToPaise(r.credit_text) ?? ZERO) : ZERO;
    debitTotal += debit;
    creditTotal += credit;
    running += debit - credit;
    entries.push(
      row(
        "normal",
        text(displayDate(r.voucher_date)),
        text(r.other_name),
        text(`${r.type_name} ${r.reference_no}`),
        debit > ZERO ? amount(debit) : blank,
        credit > ZERO ? amount(credit) : blank,
        text(formatBalance(running)),
      ),
    );
  }
  const rows: DocRow[] = [
    ...entries.reverse(),
    row("normal", blank, text("Opening Balance"), blank, blank, blank, text(formatBalance(opening))),
  ];
  rows.push(
    row("total", blank, text("Total"), blank, amount(debitTotal), amount(creditTotal), blank),
  );
  rows.push(row("total", blank, text("Closing Balance"), blank, blank, blank, text(formatBalance(running))));

  doc.kpis = [
    kpiMoney("Opening", formatBalance(opening), `On ${displayDate(params.from)}`),
    kpiMoney("Debit", formatPaise(debitTotal)),
    kpiMoney("Credit", formatPaise(creditTotal)),
    kpiMoney("Closing", formatBalance(running), `On ${displayDate(params.to)}`),
  ];
  doc.tables = [
    {
      paged: true,
      columns: [
        { label: "Date", align: "left" },
        { label: "Particulars", align: "left" },
        { label: "Voucher", align: "left" },
        { label: "Debit", align: "right" },
        { label: "Credit", align: "right" },
        { label: "Balance", align: "right" },
      ],
      rows,
    },
  ];
  doc.notes = [
    `Covers ${range(params.from, params.to)}. Opening balance is the ledger's opening balance plus every entry before ${displayDate(params.from)}.`,
    "Particulars shows the other ledger of each row. A balance that has gone the other way shows on the opposite side, with no minus sign.",
  ];
  doc.empty = false;
  return doc;
}

// ---------------------------------------------------------------------------
// Sales Register and Purchase Register

type RegisterLeg = {
  voucher_id: string;
  voucher_date: string;
  type_name: string;
  reference_no: string;
  ledger_id: string;
  ledger_name: string;
  net_text: string;
};

function monthName(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

async function buildRegister(
  supabase: Supabase,
  chart: Chart,
  kind: "sales" | "purchase",
  params: ReportParams,
  ctx: ReportContext,
): Promise<ReportDocument> {
  const key: ReportKey = kind === "sales" ? "sales-register" : "purchase-register";
  const { data, error } = await supabase.rpc("report_register", {
    p_kind: kind,
    p_from: params.from,
    p_to: params.to,
  });
  if (error) throw new Error("register");
  const legs = (data ?? []) as RegisterLeg[];

  // The groups that feed this register, with everything under them.
  const scope = new Set<string>();
  const queue = chart.groups.filter((g) => g.register_kind === kind).map((g) => g.id);
  while (queue.length > 0) {
    const id = queue.pop() as string;
    if (scope.has(id)) continue;
    scope.add(id);
    for (const child of chart.childrenOf.get(id) ?? []) queue.push(child.id);
  }
  const ledgerGroup = new Map(chart.ledgers.map((l) => [l.id, l.group_id]));

  // Columns follow the order of the group tree, then the ledger name.
  const groupOrder = new Map<string, number>();
  let counter = 0;
  const walk = (parent: string | null) => {
    for (const group of chart.childrenOf.get(parent) ?? []) {
      groupOrder.set(group.id, counter);
      counter += 1;
      walk(group.id);
    }
  };
  walk(null);

  type Voucher = {
    id: string;
    date: string;
    title: string;
    legs: { ledgerId: string; name: string; net: bigint }[];
  };
  const vouchers = new Map<string, Voucher>();
  for (const leg of legs) {
    let voucher = vouchers.get(leg.voucher_id);
    if (!voucher) {
      voucher = {
        id: leg.voucher_id,
        date: leg.voucher_date,
        title: `${leg.type_name} ${leg.reference_no}`,
        legs: [],
      };
      vouchers.set(leg.voucher_id, voucher);
    }
    voucher.legs.push({
      ledgerId: leg.ledger_id,
      name: leg.ledger_name,
      net: parseSignedPaise(leg.net_text),
    });
  }

  // Keep the vouchers that touch the chosen ledger, if one was chosen.
  const chosen = [...vouchers.values()].filter(
    (v) => !params.ledgerId || v.legs.some((l) => l.ledgerId === params.ledgerId),
  );

  // For each voucher the register ledgers decide the direction. A normal sale
  // or purchase has the register side positive. A return is the other way.
  type Line = { voucher: Voucher; columns: Map<string, bigint>; particulars: string };
  const columnLedgers = new Map<string, { name: string; order: number }>();
  const lines: Line[] = chosen.map((voucher) => {
    let registerNet = ZERO;
    for (const leg of voucher.legs) {
      const group = ledgerGroup.get(leg.ledgerId);
      if (group && scope.has(group)) registerNet += leg.net;
    }
    const normal = registerNet >= ZERO;
    const columns = new Map<string, bigint>();
    const party: string[] = [];
    for (const leg of voucher.legs) {
      const onColumnSide = normal ? leg.net > ZERO : leg.net < ZERO;
      if (onColumnSide) {
        columns.set(leg.ledgerId, (columns.get(leg.ledgerId) ?? ZERO) + leg.net);
        if (!columnLedgers.has(leg.ledgerId)) {
          const group = ledgerGroup.get(leg.ledgerId);
          columnLedgers.set(leg.ledgerId, {
            name: leg.name,
            order: group ? (groupOrder.get(group) ?? 0) : 0,
          });
        }
      } else {
        party.push(leg.name);
      }
    }
    return { voucher, columns, particulars: party.join(", ") };
  });

  const columnList = [...columnLedgers.entries()]
    .sort((a, b) => a[1].order - b[1].order || a[1].name.localeCompare(b[1].name))
    .map(([id, info]) => ({ id, name: info.name }));

  const rowTotal = (line: Line) => sumPaise([...line.columns.values()]);
  const columnTotals = columnList.map((column) =>
    sumPaise(lines.map((line) => line.columns.get(column.id) ?? ZERO)),
  );
  const grand = sumPaise(lines.map(rowTotal));

  const listRows: DocRow[] = [...lines].reverse().map((line) =>
    row(
      "normal",
      text(displayDate(line.voucher.date)),
      text(line.voucher.title),
      text(line.particulars),
      ...columnList.map((column) => {
        const value = line.columns.get(column.id);
        return value === undefined ? blank : amount(value);
      }),
      amount(rowTotal(line)),
    ),
  );
  if (listRows.length > 0) {
    listRows.push(
      row("total", text("Total"), blank, blank, ...columnTotals.map(amount), amount(grand)),
    );
  }

  // Month by month with the same columns.
  const months = new Map<string, Line[]>();
  for (const line of lines) {
    const monthKey = line.voucher.date.slice(0, 7);
    months.set(monthKey, [...(months.get(monthKey) ?? []), line]);
  }
  const monthRows: DocRow[] = [...months.entries()].reverse().map(([monthKey, monthLines]) =>
    row(
      "normal",
      text(monthName(monthKey)),
      text(String(monthLines.length)),
      ...columnList.map((column) =>
        amount(sumPaise(monthLines.map((line) => line.columns.get(column.id) ?? ZERO))),
      ),
      amount(sumPaise(monthLines.map(rowTotal))),
    ),
  );
  if (monthRows.length > 0) {
    monthRows.push(
      row("total", text("Total"), text(String(lines.length)), ...columnTotals.map(amount), amount(grand)),
    );
  }

  let highest = ZERO;
  let highestTitle = "";
  for (const line of lines) {
    const total = rowTotal(line);
    if (total > highest || highestTitle === "") {
      highest = total;
      highestTitle = line.voucher.title;
    }
  }
  const days = new Set(lines.map((line) => line.voucher.date)).size;

  const side = kind === "sales" ? "credited" : "debited";
  const otherSide = kind === "sales" ? "debited" : "credited";
  const doc = baseDocument(
    key,
    ctx,
    range(params.from, params.to),
    `Ledger: ${chart.ledgers.find((l) => l.id === params.ledgerId)?.name ?? "all"}.`,
  );
  doc.kpis = [
    kpi("Vouchers", String(lines.length), "Posted"),
    kpiMoney("Gross Total", formatPaise(grand), "All columns"),
    kpiMoney("Highest Voucher", formatPaise(highest), highestTitle),
    kpi("Days", String(days), "With entries"),
  ];
  doc.tables = [
    {
      heading: "Monthly Summary",
      columns: [
        { label: "Month", align: "left" },
        { label: "Vouchers", align: "right" },
        ...columnList.map((c) => ({ label: c.name, align: "right" as const })),
        { label: "Total", align: "right" },
      ],
      rows: monthRows,
    },
    {
      heading: "Vouchers",
      paged: true,
      columns: [
        { label: "Date", align: "left" },
        { label: "Voucher", align: "left" },
        { label: "Particulars", align: "left" },
        ...columnList.map((c) => ({ label: c.name, align: "right" as const })),
        { label: "Total", align: "right" },
      ],
      rows: listRows,
    },
  ];
  doc.notes = [
    `Covers ${range(params.from, params.to)}. A voucher is included when any of its rows touches a ledger under the ${kind} group. Void vouchers are left out.`,
    `Each column is a ledger ${side} on the voucher. Particulars shows the ledgers ${otherSide}, such as cash, bank or the party. Total is the sum of the columns.`,
    `A ${kind} return shows as a negative amount in its column. Liquor excise and GST ledgers stay in their own columns and are never added into one.`,
    `Which groups count as ${kind} comes from the ledger groups.`,
  ];
  doc.empty = lines.length === 0;
  doc.emptyTitle = "No Vouchers In This Range";
  doc.emptyHint = "Change the dates or the ledger.";
  return doc;
}

// ---------------------------------------------------------------------------
// Trial Balance

async function buildTrialBalance(
  supabase: Supabase,
  chart: Chart,
  params: ReportParams,
  ctx: ReportContext,
): Promise<ReportDocument> {
  const nets = await loadNets(supabase, "report_trial_balance", null, params.asOn, true);

  type Visit = { net: bigint; rows: DocRow[]; ledgers: number };

  // The net of a group and everything under it, with its rows. A group shows
  // only when something under it has a balance to show.
  function visit(group: GroupRec, depth: number): Visit {
    const own: DocRow[] = [];
    let net = ZERO;
    let ledgers = 0;

    for (const ledger of chart.ledgersOf.get(group.id) ?? []) {
      const value = nets.get(ledger.id) ?? ZERO;
      net += value;
      if (value === ZERO && !params.showZero) continue;
      ledgers += 1;
      own.push(
        row(
          "ledger",
          text(ledger.name),
          value > ZERO ? amount(value) : blank,
          value < ZERO ? amount(-value) : blank,
        ),
      );
    }

    const below: DocRow[] = [];
    for (const child of chart.childrenOf.get(group.id) ?? []) {
      const result = visit(child, depth + 1);
      net += result.net;
      ledgers += result.ledgers;
      below.push(...result.rows);
    }

    if (ledgers === 0) return { net, rows: [], ledgers };
    return {
      net,
      ledgers,
      rows: [
        row(
          depth === 0 ? "group" : "sub",
          text(group.name),
          net > ZERO ? amount(net) : blank,
          net < ZERO ? amount(-net) : blank,
        ),
        ...own,
        ...below,
      ],
    };
  }

  const rows: DocRow[] = [];
  let ledgerCount = 0;
  for (const primary of chart.childrenOf.get(null) ?? []) {
    const result = visit(primary, 0);
    rows.push(...result.rows);
    ledgerCount += result.ledgers;
  }

  let debitTotal = ZERO;
  let creditTotal = ZERO;
  for (const value of nets.values()) {
    if (value > ZERO) debitTotal += value;
    else if (value < ZERO) creditTotal += -value;
  }
  const difference = debitTotal > creditTotal ? debitTotal - creditTotal : creditTotal - debitTotal;
  if (rows.length > 0) {
    rows.push(row("total", text("Grand Total"), amount(debitTotal), amount(creditTotal)));
  }

  const doc = baseDocument(
    "trial-balance",
    ctx,
    `As on ${displayDate(params.asOn)}`,
    `Ledgers with zero balance: ${params.showZero ? "shown" : "not shown"}.`,
  );
  doc.kpis = [
    kpiMoney("Total Debit", formatPaise(debitTotal)),
    kpiMoney("Total Credit", formatPaise(creditTotal)),
    kpiMoney("Difference", formatPaise(difference), difference === ZERO ? "Matches" : "Does not match"),
    kpi("Ledgers", String(ledgerCount), params.showZero ? "Shown" : "With a balance"),
  ];
  doc.tables = [
    {
      columns: [
        { label: "Particulars", align: "left" },
        { label: "Debit", align: "right" },
        { label: "Credit", align: "right" },
      ],
      rows,
    },
  ];
  doc.notes = [
    `As on ${displayDate(params.asOn)}. Each ledger shows its opening balance plus posted debits and credits up to that date. Group rows are subtotals of what sits under them.`,
    "A balance that has gone the other way shows on the opposite side, with no minus sign. Void vouchers are left out.",
    "Group order and headings come from the ledger groups.",
  ];
  if (difference !== ZERO) {
    doc.notes.push(
      `Debit and credit differ by ${formatPaise(difference)}. A common cause is opening balances that were not entered through the Capital - Opening Adjustment ledger.`,
    );
  }
  doc.empty = rows.length === 0;
  doc.emptyTitle = "No Balances Yet";
  doc.emptyHint = "No ledger has a balance on this date.";
  return doc;
}

// ---------------------------------------------------------------------------
// Profit And Loss

async function buildProfitLoss(
  supabase: Supabase,
  chart: Chart,
  params: ReportParams,
  ctx: ReportContext,
): Promise<ReportDocument> {
  const nets = await loadNets(supabase, "report_profit_loss", params.from, params.to, false);

  const rows: DocRow[] = [];
  let anyLedger = false;

  type Visit = { total: bigint; rows: DocRow[] };

  // The amount of a group on its own side: income is credit, expenses debit.
  // A top group always shows, even at zero. Lower groups show only with a
  // balance under them.
  function visit(group: GroupRec, keepZero: boolean): Visit {
    const sign = group.nature === "income" ? BigInt(-1) : BigInt(1);
    const own: DocRow[] = [];
    let total = ZERO;

    for (const ledger of chart.ledgersOf.get(group.id) ?? []) {
      const value = (nets.get(ledger.id) ?? ZERO) * sign;
      total += value;
      if (value === ZERO) continue;
      anyLedger = true;
      own.push(row("ledger", text(ledger.name), amount(value)));
    }

    const below: DocRow[] = [];
    for (const child of chart.childrenOf.get(group.id) ?? []) {
      const result = visit(child, false);
      total += result.total;
      below.push(...result.rows);
    }

    if (!keepZero && own.length === 0 && below.length === 0) return { total, rows: [] };
    return { total, rows: [row("sub", text(group.name), amount(total)), ...own, ...below] };
  }

  function section(name: string, key: "trading" | "profit_loss") {
    rows.push(row("group", text(name), blank));
    let income = ZERO;
    let expense = ZERO;
    for (const primary of chart.childrenOf.get(null) ?? []) {
      if (primary.nature !== "income" && primary.nature !== "expenses") continue;
      if ((primary.pl_section ?? "profit_loss") !== key) continue;
      const result = visit(primary, true);
      rows.push(...result.rows);
      if (primary.nature === "income") income += result.total;
      else expense += result.total;
    }
    return { income, expense };
  }

  const trading = section("Trading", "trading");
  const gross = trading.income - trading.expense;
  rows.push(
    row(
      "total",
      text(gross < ZERO ? "Gross Loss" : "Gross Profit"),
      amount(gross < ZERO ? -gross : gross),
    ),
  );
  const rest = section("Profit And Loss", "profit_loss");
  const net = gross + rest.income - rest.expense;
  rows.push(
    row(
      "total",
      text(net < ZERO ? "Net Loss" : "Net Profit"),
      amount(net < ZERO ? -net : net),
    ),
  );

  const income = trading.income + rest.income;
  const expense = trading.expense + rest.expense;

  const doc = baseDocument("profit-loss", ctx, range(params.from, params.to), "");
  doc.kpis = [
    kpiMoney("Income", formatPaise(income)),
    kpiMoney("Expenses", formatPaise(expense)),
    kpiMoney(gross < ZERO ? "Gross Loss" : "Gross Profit", formatPaise(gross < ZERO ? -gross : gross)),
    kpiMoney(net < ZERO ? "Net Loss" : "Net Profit", formatPaise(net < ZERO ? -net : net)),
  ];
  doc.tables = [
    {
      columns: [
        { label: "Particulars", align: "left" },
        { label: "Amount", align: "right" },
      ],
      rows,
    },
  ];
  doc.notes = [
    `Covers ${range(params.from, params.to)}. Income and expenses are posted debits and credits to ledgers in the income and expense groups.`,
    "Gross profit is trading income minus trading expenses. Net profit is gross profit plus indirect income minus indirect expenses. The trading and profit and loss parts come from the ledger groups.",
    "There is no inventory, so stock is not counted automatically. A stock value journalled to a trading ledger flows in.",
  ];
  doc.empty = !anyLedger;
  doc.emptyTitle = "No Income Or Expenses";
  doc.emptyHint = "Nothing was posted in this range.";
  return doc;
}

// ---------------------------------------------------------------------------
// Balance Sheet

async function buildBalanceSheet(
  supabase: Supabase,
  chart: Chart,
  params: ReportParams,
  ctx: ReportContext,
): Promise<ReportDocument> {
  const [nets, profitNets] = await Promise.all([
    loadNets(supabase, "report_balance_sheet", null, params.asOn, true),
    loadNets(supabase, "report_balance_sheet", null, params.asOn, false),
  ]);

  // The cumulative profit of every income and expense ledger up to the date.
  let profit = ZERO;
  for (const ledger of chart.ledgers) {
    const nature = chart.groupById.get(ledger.group_id)?.nature;
    if (nature === "income" || nature === "expenses") {
      profit -= profitNets.get(ledger.id) ?? ZERO;
    }
  }

  // One side of the sheet. Assets are debit, liabilities are credit. A ledger
  // on the wrong side shows its opposite side after the amount, with no sign.
  function side(nature: "assets" | "liabilities") {
    const sign = nature === "assets" ? BigInt(1) : BigInt(-1);
    const rows: DocRow[] = [];
    let total = ZERO;

    function wrongSide(value: bigint): string {
      if (value >= ZERO) return "";
      return nature === "assets" ? " Cr" : " Dr";
    }

    function sideCell(value: bigint): Cell {
      const shown = value < ZERO ? -value : value;
      return {
        text: `${formatPaise(shown)}${wrongSide(value)}`,
        value: value < ZERO ? undefined : Number(shown) / 100,
      };
    }

    type Visit = { sum: bigint; rows: DocRow[] };

    function visit(group: GroupRec, depth: number): Visit {
      const own: DocRow[] = [];
      let sum = ZERO;
      for (const ledger of chart.ledgersOf.get(group.id) ?? []) {
        const value = (nets.get(ledger.id) ?? ZERO) * sign;
        sum += value;
        if (value === ZERO) continue;
        own.push(row("ledger", text(ledger.name), sideCell(value)));
      }
      const below: DocRow[] = [];
      for (const child of chart.childrenOf.get(group.id) ?? []) {
        const result = visit(child, depth + 1);
        sum += result.sum;
        below.push(...result.rows);
      }
      if (own.length === 0 && below.length === 0) return { sum, rows: [] };
      return {
        sum,
        rows: [
          row(depth === 0 ? "group" : "sub", text(group.name), sideCell(sum)),
          ...own,
          ...below,
        ],
      };
    }

    for (const primary of chart.childrenOf.get(null) ?? []) {
      if (primary.nature !== nature) continue;
      const result = visit(primary, 0);
      rows.push(...result.rows);
      total += result.sum;
    }
    return { rows, total };
  }

  const liabilities = side("liabilities");
  const assets = side("assets");

  // A profit sits with the liabilities. A loss sits with the assets.
  if (profit >= ZERO) {
    if (profit > ZERO) {
      liabilities.rows.push(row("group", text("Profit And Loss"), amount(profit)));
      liabilities.total += profit;
    }
  } else {
    assets.rows.push(row("group", text("Profit And Loss (Loss)"), amount(-profit)));
    assets.total += -profit;
  }

  liabilities.rows.push(row("total", text("Total"), amount(liabilities.total)));
  assets.rows.push(row("total", text("Total"), amount(assets.total)));

  const difference =
    assets.total > liabilities.total
      ? assets.total - liabilities.total
      : liabilities.total - assets.total;

  const doc = baseDocument("balance-sheet", ctx, `As on ${displayDate(params.asOn)}`, "");
  doc.kpis = [
    kpiMoney("Total Liabilities", formatPaise(liabilities.total)),
    kpiMoney("Total Assets", formatPaise(assets.total)),
    kpiMoney(
      profit < ZERO ? "Loss Carried In" : "Profit Carried In",
      formatPaise(profit < ZERO ? -profit : profit),
      "Cumulative",
    ),
    kpiMoney("Difference", formatPaise(difference), difference === ZERO ? "Balanced" : "Does not balance"),
  ];
  const columns = (label: string) => [
    { label, align: "left" as const },
    { label: "Amount", align: "right" as const },
  ];
  const tables: DocTable[] = [
    { heading: "Liabilities", columns: columns("Liabilities"), rows: liabilities.rows },
    { heading: "Assets", columns: columns("Assets"), rows: assets.rows },
  ];
  doc.tables = tables;
  doc.sideBySide = true;
  doc.notes = [
    `As on ${displayDate(params.asOn)}. Balances are opening balance plus posted entries up to that date.`,
    "Profit And Loss is the cumulative net profit from the first entry up to the date. There is no year-end closing yet.",
  ];
  if (difference !== ZERO) {
    doc.notes.push(
      `The two sides differ by ${formatPaise(difference)}. A common cause is opening balances that were not entered through the Capital - Opening Adjustment ledger.`,
    );
  }
  doc.empty = liabilities.total === ZERO && assets.total === ZERO && difference === ZERO;
  doc.emptyTitle = "No Balances Yet";
  doc.emptyHint = "No ledger has a balance on this date.";
  return doc;
}

// ---------------------------------------------------------------------------

// Builds one report as a document. The screen, print view, Excel and PDF all
// use it, so they always agree. Throws if the database cannot answer.
export async function buildReport(
  key: ReportKey,
  params: ReportParams,
  ctx: ReportContext,
): Promise<ReportDocument> {
  const supabase = await createClient();

  const feature = REPORT_FEATURES[key];

  if (key === "day-book") {
    const options = await loadFilterOptions(feature);
    return buildDayBook(supabase, params, ctx, {
      ledger: options.ledgers.find((l) => l.value === params.ledgerId)?.label ?? "",
      type: options.types.find((t) => t.value === params.typeId)?.label ?? "",
    });
  }

  const chart = await loadChart(supabase, feature);
  switch (key) {
    case "ledger-statement":
      return buildLedgerStatement(supabase, chart, params, ctx);
    case "sales-register":
      return buildRegister(supabase, chart, "sales", params, ctx);
    case "purchase-register":
      return buildRegister(supabase, chart, "purchase", params, ctx);
    case "trial-balance":
      return buildTrialBalance(supabase, chart, params, ctx);
    case "profit-loss":
      return buildProfitLoss(supabase, chart, params, ctx);
    case "balance-sheet":
      return buildBalanceSheet(supabase, chart, params, ctx);
  }
}

