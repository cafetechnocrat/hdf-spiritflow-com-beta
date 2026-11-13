"use client";

import { useState } from "react";
import type {
  ItemQuery,
  LiquorItemPage,
  LiquorLookups,
} from "@/lib/liquor/types";
import { ImportPanel } from "./import-panel";
import { ItemsPanel } from "./items-panel";
import { LookupsPanel } from "./lookups-panel";

// All visible text sits here so it can be translated later.
const text = {
  tabsLabel: "Section",
  items: "Items",
  lookups: "Categories And Types",
  import: "Import From Excel",
} as const;

type Tab = "items" | "lookups" | "import";

export function LiquorScreen({
  page,
  query,
  lookups,
  canEdit,
  canEditRates,
}: {
  page: LiquorItemPage;
  query: ItemQuery;
  lookups: LiquorLookups;
  canEdit: boolean;
  canEditRates: boolean;
}) {
  const [tab, setTab] = useState<Tab>("items");
  const tabs: { id: Tab; label: string }[] = [
    { id: "items", label: text.items },
    { id: "lookups", label: text.lookups },
    ...(canEdit && canEditRates ? [{ id: "import" as const, label: text.import }] : []),
  ];

  return (
    <div>
      <div
        role="tablist"
        aria-label={text.tabsLabel}
        className="mb-3.5 inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[10px] bg-track p-0.5"
      >
        {tabs.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            id={`liquor-tab-${option.id}`}
            aria-selected={tab === option.id}
            aria-controls={`liquor-panel-${option.id}`}
            onClick={() => setTab(option.id)}
            className={`min-h-10 whitespace-nowrap rounded-lg px-3.5 text-[0.86rem] ${
              tab === option.id
                ? "bg-surface font-semibold text-text shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                : "font-medium text-muted hover:text-text"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <section
        role="tabpanel"
        id={`liquor-panel-${tab}`}
        aria-labelledby={`liquor-tab-${tab}`}
      >
        {tab === "items" ? (
          <ItemsPanel
            page={page}
            query={query}
            lookups={lookups}
            canEdit={canEdit}
            canEditRates={canEditRates}
          />
        ) : tab === "lookups" ? (
          <LookupsPanel lookups={lookups} canEdit={canEdit} />
        ) : (
          <ImportPanel />
        )}
      </section>
    </div>
  );
}
