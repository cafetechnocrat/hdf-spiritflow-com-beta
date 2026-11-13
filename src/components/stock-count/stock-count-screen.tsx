"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  CountEntry,
  CountHeader,
  CountItem,
  CountPoint,
  CountRights,
} from "@/lib/stock-count/types";
import { CountPanel } from "./count-panel";
import { PastPanel } from "./past-panel";

// All visible text sits here so it can be translated later.
const text = {
  tabsLabel: "Section",
  count: "Count",
  past: "Past Counts",
  noPoints: "No Liquor Stock Points",
  noPointsHint: "Add an active Liquor stock point on the Stock Points screen, then count here.",
  noItems: "No Active Items",
  noItemsHint: "Make items Active on the Liquor Items screen, then count here.",
} as const;

type Tab = "count" | "past";

export function StockCountScreen({
  points,
  items,
  pointId,
  date,
  header,
  entries,
  rights,
  userName,
  today,
  refreshKey,
}: {
  points: CountPoint[];
  items: CountItem[];
  pointId: string;
  date: string;
  header: CountHeader | null;
  entries: Record<string, CountEntry>;
  rights: CountRights;
  userName: string;
  today: string;
  // Changes after a delete so the screen starts again from what the database holds.
  refreshKey: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("count");

  function select(nextPoint: string, nextDate: string, reload = false) {
    const params = new URLSearchParams({ point: nextPoint, date: nextDate });
    if (reload) params.set("r", String(Date.now()));
    router.replace(`/stock-count?${params.toString()}`);
  }

  if (points.length === 0 || items.length === 0) {
    const none = points.length === 0;
    return (
      <div
        role="status"
        className="rounded-2xl bg-surface px-4 py-9 text-center shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
      >
        <strong className="mb-0.5 block text-[1rem]">{none ? text.noPoints : text.noItems}</strong>
        <span className="text-[0.9rem] text-muted">{none ? text.noPointsHint : text.noItemsHint}</span>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "count", label: text.count },
    { id: "past", label: text.past },
  ];

  return (
    <div>
      <div
        role="tablist"
        aria-label={text.tabsLabel}
        className="mb-3.5 inline-flex max-w-full gap-0.5 rounded-[10px] bg-track p-0.5"
      >
        {tabs.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            id={`count-tab-${option.id}`}
            aria-selected={tab === option.id}
            aria-controls={`count-panel-${option.id}`}
            onClick={() => setTab(option.id)}
            className={`min-h-10 whitespace-nowrap rounded-lg px-4 text-[0.86rem] ${
              tab === option.id
                ? "bg-surface font-semibold text-text shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                : "font-medium text-muted hover:text-text"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <section role="tabpanel" id={`count-panel-${tab}`} aria-labelledby={`count-tab-${tab}`}>
        {tab === "count" ? (
          <CountPanel
            key={`${pointId}|${date}|${refreshKey}`}
            points={points}
            items={items}
            pointId={pointId}
            date={date}
            header={header}
            initialEntries={entries}
            rights={rights}
            userName={userName}
            onSelect={select}
            onDeleted={() => select(pointId, date, true)}
          />
        ) : (
          <PastPanel
            points={points}
            rights={rights}
            today={today}
            onOpen={(openPoint, openDate) => {
              setTab("count");
              select(openPoint, openDate);
            }}
          />
        )}
      </section>
    </div>
  );
}
