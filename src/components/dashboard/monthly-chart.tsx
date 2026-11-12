"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel, PanelHeader } from "./ui";

const text = {
  chart: "Chart",
  table: "Table",
  month: "Month",
  lakh: "lakh",
} as const;

export type ChartSeries = { name: string; color: string; values: number[] };

// A bar chart by month with a legend and a table view, as the design rules ask.
// Chart values are in lakhs and are for drawing only. The table shows the exact
// amounts as text from the database.
export function MonthlyChart({
  title,
  subtitle,
  months,
  series,
  stacked,
  tableHead,
  tableRows,
  describe,
}: {
  title: string;
  subtitle: string;
  months: string[];
  series: ChartSeries[];
  stacked: boolean;
  tableHead: string[];
  tableRows: string[][];
  describe: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");

  const data = months.map((label, index) => {
    const row: Record<string, string | number> = { label };
    series.forEach((item, position) => {
      row[`s${position}`] = item.values[index] ?? 0;
    });
    return row;
  });

  return (
    <Panel label={title}>
      <PanelHeader
        title={title}
        subtitle={subtitle}
        action={
          <span className="inline-flex flex-none gap-0.5 rounded-[9px] bg-track p-0.5" role="group" aria-label={title}>
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
      <ul className="mb-2 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[0.78rem] text-muted">
        {series.map((item) => (
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
        <div role="img" aria-label={describe} className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="#E8E8ED" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6E6E73" }} />
              <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: "#6E6E73" }} />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                formatter={(value, name) => [`${Number(value).toFixed(2)} ${text.lakh}`, String(name)]}
                contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 6px 24px rgba(0,0,0,0.12)", fontSize: 12 }}
              />
              {series.map((item, position) => (
                <Bar
                  key={item.name}
                  dataKey={`s${position}`}
                  name={item.name}
                  fill={item.color}
                  stackId={stacked ? "total" : undefined}
                  radius={stacked ? (position === series.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]}
                  maxBarSize={stacked ? 34 : 18}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.84rem] tabular-nums">
            <thead>
              <tr>
                {tableHead.map((head, index) => (
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
              {tableRows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td
                      key={index}
                      className={`border-b border-divider px-2 py-[7px] ${index === 0 ? "text-left" : "text-right"}`}
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
