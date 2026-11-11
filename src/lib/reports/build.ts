import "server-only";
import {
  formatBalance,
  formatPaise,
  parseAmountToPaise,
  parseSignedPaise,
  sumPaise,
} from "@/lib/format/money";
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

async function loadChart(supabase: Supabase): Promise<Chart> {
  const [groupsResult, ledgersResult] = await Promise.all([
    supabase
      .from("ledger_groups")
      .select("id, name, parent_id, nature, sort_order, pl_section"),
    supabase.from("ledgers").select("id, name, group_id").order("name"),
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
  from: string | null,
  to: string | null,
  withOpening: boolean,
): Promise<Map<string, bigint>> {
  const { data, error } = await supabase.rpc("report_ledger_nets", {
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
export async function loadFilterOptions(): Promise<{
  ledgers: FilterOption[];
  types: FilterOption[];
}> {
  const supabase = await createClient();
  const [chart, typesResult] = await Promise.all([
    loadChart(supabase),
    supabase.from("voucher_types").select("id, name").order("sort_order").order("name"),
  ]);
  return {
    ledgers: chart.ledgers.map((l) => ({ value: l.id, label: l.name })),
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
  let query = supabase
    .from("day_book_rows")
    .select(
      "voucher_id, voucher_date, type_name, reference_no, reference, narration, status, debit_name, credit_name, amount_text",
    )
    .gte("voucher_date", params.from)
    .lte("voucher_date", params.to);
  if (!params.showVoid) query = query.eq("status", "posted");
  if (params.typeId) query = query.eq("voucher_type_id", params.typeId);
  if (params.ledgerId) {
    query = query.or(
      `debit_ledger_id.eq.${params.ledgerId},credit_ledger_id.eq.${params.ledgerId}`,
    );
  }
  const { data, error } = await query
    .order("voucher_date")
    .order("created_at")
    .order("line_no")
    .limit(DAY_BOOK_LIMIT + 1);
  if (error) throw new Error("day book");

  const all = (data ?? []) as DayBookRecord[];
  const truncated = all.length > DAY_BOOK_LIMIT;
  const records = all.slice(0, DAY_BOOK_LIMIT);

  // Void vouchers are left out of every total. Count the ones left out.
  let voidLeftOut = 0;
  if (params.showVoid) {
    voidLeftOut = new Set(records.filter((r) => r.status === "void").map((r) => r.voucher_id)).size;
  } else {
    let voidQuery = supabase
      .from("voucher_summaries")
      .select("id", { count: "exact", head: true })
      .eq("status", "void")
      .gte("voucher_date", params.from)
      .lte("voucher_date", params.to);
    if (params.typeId) voidQuery = voidQuery.eq("voucher_type_id", params.typeId);
    const { count } = await voidQuery;
    voidLeftOut = count ?? 0;
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
    kpi("Total Amount", formatPaise(total), "Debit equals credit"),
    kpi("Void Left Out", String(voidLeftOut), "Not counted"),
    kpi("Days", String(dayCount), "With entries"),
  ];
  doc.tables = [
    {
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
    doc.notes.push(`Only the first ${DAY_BOOK_LIMIT} rows are shown. Narrow the dates to see the rest.`);
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
    loadNets(supabase, null, addDays(params.from, -1), true),
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
  const rows: DocRow[] = [
    row("normal", blank, text("Opening Balance"), blank, blank, blank, text(formatBalance(opening))),
  ];
  for (const r of records) {
    const debit = r.debit_text ? (parseAmountToPaise(r.debit_text) ?? ZERO) : ZERO;
    const credit = r.credit_text ? (parseAmountToPaise(r.credit_text) ?? ZERO) : ZERO;
    debitTotal += debit;
    creditTotal += credit;
    running += debit - credit;
    rows.push(
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
  rows.push(
    row("total", blank, text("Total"), blank, amount(debitTotal), amount(creditTotal), blank),
  );
  rows.push(row("total", blank, text("Closing Balance"), blank, blank, blank, text(formatBalance(running))));

  doc.kpis = [
    kpi("Opening", formatBalance(opening), `On ${displayDate(params.from)}`),
    kpi("Debit", formatPaise(debitTotal)),
    kpi("Credit", formatPaise(creditTotal)),
    kpi("Closing", formatBalance(running), `On ${displayDate(params.to)}`),
  ];
  doc.tables = [
    {
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
// Trial Balance

async function buildTrialBalance(
  supabase: Supabase,
  chart: Chart,
  params: ReportParams,
  ctx: ReportContext,
): Promise<ReportDocument> {
  const nets = await loadNets(supabase, null, params.asOn, true);

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
    kpi("Total Debit", formatPaise(debitTotal)),
    kpi("Total Credit", formatPaise(creditTotal)),
    kpi("Difference", formatPaise(difference), difference === ZERO ? "Matches" : "Does not match"),
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
  const nets = await loadNets(supabase, params.from, params.to, false);

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
    kpi("Income", formatPaise(income)),
    kpi("Expenses", formatPaise(expense)),
    kpi(gross < ZERO ? "Gross Loss" : "Gross Profit", formatPaise(gross < ZERO ? -gross : gross)),
    kpi(net < ZERO ? "Net Loss" : "Net Profit", formatPaise(net < ZERO ? -net : net)),
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
    loadNets(supabase, null, params.asOn, true),
    loadNets(supabase, null, params.asOn, false),
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
    kpi("Total Liabilities", formatPaise(liabilities.total)),
    kpi("Total Assets", formatPaise(assets.total)),
    kpi(
      profit < ZERO ? "Loss Carried In" : "Profit Carried In",
      formatPaise(profit < ZERO ? -profit : profit),
      "Cumulative",
    ),
    kpi("Difference", formatPaise(difference), difference === ZERO ? "Balanced" : "Does not balance"),
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

  if (key === "day-book") {
    const options = await loadFilterOptions();
    return buildDayBook(supabase, params, ctx, {
      ledger: options.ledgers.find((l) => l.value === params.ledgerId)?.label ?? "",
      type: options.types.find((t) => t.value === params.typeId)?.label ?? "",
    });
  }

  const chart = await loadChart(supabase);
  switch (key) {
    case "ledger-statement":
      return buildLedgerStatement(supabase, chart, params, ctx);
    case "trial-balance":
      return buildTrialBalance(supabase, chart, params, ctx);
    case "profit-loss":
      return buildProfitLoss(supabase, chart, params, ctx);
    case "balance-sheet":
      return buildBalanceSheet(supabase, chart, params, ctx);
  }
}

