"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_RANGES, type ChartRange } from "@/lib/dashboard/buckets";
import { Panel, PanelHeader } from "./ui";

const text = {
  chart: "Chart",
  table: "Table",
  lakh: "lakh",
  rangeLabel: "Report range",
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
} as const;

const RANGE_LABEL: Record<ChartRange, string> = {
  day: text.day,
  week: text.week,
  month: text.month,
  year: text.year,
};

export type ChartSeries = { name: string; color: string; values: number[] };

// Everything one range of a chart shows. Chart values are in lakhs and are for
// drawing only. The table shows the exact amounts as text from the database.
export type ChartView = {
  subtitle: string;
  labels: string[];
  series: ChartSeries[];
  tableHead: string[];
  tableRows: string[][];
  describe: string;
};

// A chart with a Day, Week, Month and Year range, a legend and a table view, as
// the design rules ask. Lines suit two figures compared period against period.
export function MonthlyChart({
  title,
  views,
  defaultRange = "day",
  kind = "bars",
  stacked = false,
}: {
  title: string;
  views: Record<ChartRange, ChartView>;
  defaultRange?: ChartRange;
  kind?: "bars" | "lines";
  stacked?: boolean;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [range, setRange] = useState<ChartRange>(defaultRange);
  const current = views[range];

  const data = current.labels.map((label, index) => {
    const row: Record<string, string | number> = { label };
    current.series.forEach((item, position) => {
      row[`s${position}`] = item.values[index] ?? 0;
    });
    return row;
  });

  const axis = { fontSize: 11, fill: "#5B6478" };
  const tooltip = {
    borderRadius: 12,
    border: "none",
    boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
    fontSize: 12,
  };

  return (
    <Panel label={title}>
      <PanelHeader
        title={title}
        subtitle={current.subtitle}
        action={
          <span
            className="inline-flex flex-none gap-0.5 rounded-[9px] bg-track p-0.5"
            role="group"
            aria-label={title}
          >
            {(["chart", "table"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => setView(option)}
                className={`min-h-[30px] rounded-[7px] px-2.5 text-[0.76rem] ${
                  view === option
                    ? "bg-surface font-semibold text-text shadow-[0_1px_3px_rgba(0,0,0,0.18)]"
                    : "font-medium text-muted hover:text-text"
                }`}
              >
                {option === "chart" ? text.chart : text.table}
              </button>
            ))}
          </span>
        }
      />

      <div
        role="group"
        aria-label={`${title}. ${text.rangeLabel}`}
        className="mb-2.5 inline-flex gap-0.5 rounded-[9px] bg-track p-0.5"
      >
        {CHART_RANGES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={range === option}
            onClick={() => setRange(option)}
            className={`min-h-[32px] min-w-[56px] rounded-[7px] px-3 text-[0.8rem] ${
              range === option
                ? "bg-surface font-semibold text-text shadow-[0_1px_3px_rgba(0,0,0,0.18)]"
                : "font-medium text-muted hover:text-text"
            }`}
          >
            {RANGE_LABEL[option]}
          </button>
        ))}
      </div>

      <ul className="mb-2 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[0.78rem] text-muted">
        {current.series.map((item) => (
          <li key={item.name}>
            <i
              className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] align-[-1px]"
              style={{ background: item.color }}
              aria-hidden="true"
            />
            {item.name}
          </li>
        ))}
      </ul>

      {view === "chart" ? (
        <div role="img" aria-label={current.describe} className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {kind === "lines" ? (
              <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="#E6E9F1" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} />
                <YAxis tickLine={false} axisLine={false} width={44} tick={axis} />
                <Tooltip
                  formatter={(value, name) => [`${Number(value).toFixed(2)} ${text.lakh}`, String(name)]}
                  contentStyle={tooltip}
                />
                {current.series.map((item, position) => (
                  <Line
                    key={item.name}
                    type="monotone"
                    dataKey={`s${position}`}
                    name={item.name}
                    stroke={item.color}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: item.color, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    strokeDasharray={position === 1 ? "6 3" : undefined}
                  />
                ))}
              </LineChart>
            ) : (
              <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="#E6E9F1" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} />
                <YAxis tickLine={false} axisLine={false} width={44} tick={axis} />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  formatter={(value, name) => [`${Number(value).toFixed(2)} ${text.lakh}`, String(name)]}
                  contentStyle={tooltip}
                />
                {current.series.map((item, position) => (
                  <Bar
                    key={item.name}
                    dataKey={`s${position}`}
                    name={item.name}
                    fill={item.color}
                    stackId={stacked ? "total" : undefined}
                    radius={
                      stacked ? (position === current.series.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]
                    }
                    maxBarSize={stacked ? 34 : 18}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.84rem] tabular-nums">
            <thead>
              <tr>
                {current.tableHead.map((head, index) => (
                  <th
                    key={head}
                    className={`border-b border-divider px-2 py-[7px] text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-muted ${
                      index === 0 ? "text-left" : "text-right"
                    }`}
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {current.tableRows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td
                      key={index}
                      className={`border-b border-divider px-2 py-[7px] ${
                        index === 0 ? "text-left" : "text-right"
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
