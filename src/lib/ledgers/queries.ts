import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  AccountNature,
  BalanceSide,
  LedgerData,
  LedgerGroupRow,
  LedgerRow,
  RecordStatus,
} from "./types";

type GroupRecord = {
  id: string;
  name: string;
  parent_id: string | null;
  nature: AccountNature;
  is_default: boolean;
  sort_order: number;
  status: RecordStatus;
};

type LedgerRecord = {
  id: string;
  name: string;
  alias: string | null;
  group_id: string;
  opening_amount: number | string;
  opening_side: BalanceSide;
  note: string | null;
  status: RecordStatus;
};

// Row Level Security decides who may read these tables. The group list, its
// order and its nature all come from the database. Nothing is listed in code.
export async function loadLedgerData(): Promise<LedgerData> {
  const supabase = await createClient();
  const [groupsResult, ledgersResult] = await Promise.all([
    supabase
      .from("ledger_groups")
      .select("id, name, parent_id, nature, is_default, sort_order, status"),
    supabase
      .from("ledgers")
      .select("id, name, alias, group_id, opening_amount, opening_side, note, status")
      .order("name"),
  ]);

  const groupRecords = (groupsResult.data ?? []) as GroupRecord[];
  const ledgerRecords = (ledgersResult.data ?? []) as LedgerRecord[];

  const byParent = new Map<string | null, GroupRecord[]>();
  for (const group of groupRecords) {
    const siblings = byParent.get(group.parent_id) ?? [];
    siblings.push(group);
    byParent.set(group.parent_id, siblings);
  }
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }

  const names = new Map(groupRecords.map((g) => [g.id, g.name]));
  const natures = new Map(groupRecords.map((g) => [g.id, g.nature]));

  // Depth first, so every sub-group follows its group.
  const groups: LedgerGroupRow[] = [];
  function walk(parentId: string | null, depth: number) {
    for (const group of byParent.get(parentId) ?? []) {
      groups.push({
        id: group.id,
        name: group.name,
        parentId: group.parent_id,
        parentName: group.parent_id ? (names.get(group.parent_id) ?? null) : null,
        nature: group.nature,
        isDefault: group.is_default,
        status: group.status,
        depth,
        activeLedgerCount: ledgerRecords.filter(
          (l) => l.group_id === group.id && l.status === "active",
        ).length,
        activeChildCount: (byParent.get(group.id) ?? []).filter(
          (child) => child.status === "active",
        ).length,
      });
      walk(group.id, depth + 1);
    }
  }
  walk(null, 0);

  const ledgers: LedgerRow[] = ledgerRecords.map((l) => ({
    id: l.id,
    name: l.name,
    alias: l.alias,
    groupId: l.group_id,
    groupName: names.get(l.group_id) ?? "",
    groupNature: natures.get(l.group_id) ?? "assets",
    openingAmount: Number(l.opening_amount),
    openingSide: l.opening_side,
    note: l.note,
    status: l.status,
  }));

  return { groups, ledgers };
}
