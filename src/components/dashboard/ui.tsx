import type { ReactNode } from "react";

// Building blocks for the dashboard. All visible text sits in the section
// files so it can be translated later.

const CARD =
  "rounded-[18px] bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_20px_rgba(0,0,0,0.04)]";

export function Panel({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <section aria-label={label} className={`${CARD} min-w-0 p-3.5 sm:px-[18px] sm:py-4 ${className}`}>
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2.5">
      <div>
        <h2 className="text-[0.98rem] font-semibold tracking-[-0.01em]">{title}</h2>
        {subtitle ? <p className="mt-px text-[0.78rem] text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function SectionLabel({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div className="mb-2.5 mt-6 flex items-center gap-2 px-0.5 text-[0.74rem] font-semibold uppercase tracking-[0.05em] text-muted">
      {children}
      {note ? (
        <span className="rounded-full bg-track px-2 py-0.5 text-[0.66rem] normal-case tracking-[0.04em]">
          {note}
        </span>
      ) : null}
    </div>
  );
}

export function Icon({ d, className = "h-[18px] w-[18px]" }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

// A small trend line under a headline figure. The values are display only.
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="mt-2.5 h-[38px]" aria-hidden="true" />;
  const width = 200;
  const height = 38;
  const pad = 4;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values.map((value, index) => [
    index * (width / (values.length - 1)),
    height - pad - ((value - min) / (max - min || 1)) * (height - pad * 2),
  ]);
  const line = points
    .map((point, index) => `${index ? "L" : "M"}${point[0].toFixed(1)} ${point[1].toFixed(1)}`)
    .join(" ");
  const id = `spark-${color.replace("#", "")}`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="mt-2.5 block h-[38px] w-full"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width} ${height} L0 ${height} Z`} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// The change against the same period last year, from two totals in paise.
// Nothing shows when last year has no figure to compare with.
export function DeltaPill({
  current,
  previous,
  goodWhen,
  label,
}: {
  current: bigint;
  previous: bigint;
  goodWhen: "up" | "down";
  label: string;
}) {
  if (previous === BigInt(0)) return null;
  const change = ((current - previous) * BigInt(1000)) / (previous < BigInt(0) ? -previous : previous);
  const up = change >= BigInt(0);
  const percent = (Number(change < BigInt(0) ? -change : change) / 10).toFixed(1);
  const good = change === BigInt(0) ? null : up === (goodWhen === "up");
  const tone =
    good === null ? "bg-track text-muted" : good ? "bg-success-bg text-success" : "bg-warn-bg text-warn";
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-[0.78rem] text-muted">
      <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[0.74rem] font-semibold ${tone}`}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`h-3 w-3 ${up ? "" : "rotate-180"}`}
        >
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
        {percent}%
        <span className="sr-only">{up ? "up" : "down"}</span>
      </span>
      {label}
    </span>
  );
}

export function KpiCard({
  name,
  icon,
  iconBackground,
  iconColor,
  value,
  footer,
  spark,
  sparkColor,
}: {
  name: string;
  icon: string;
  iconBackground: string;
  iconColor: string;
  value: ReactNode;
  footer: ReactNode;
  spark?: number[];
  sparkColor: string;
}) {
  return (
    <Panel label={name}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.78rem] font-semibold uppercase tracking-[0.05em] text-muted">
          {name}
        </span>
        <span
          className="hidden h-[34px] w-[34px] place-items-center rounded-[10px] sm:grid"
          style={{ background: iconBackground, color: iconColor }}
        >
          <Icon d={icon} />
        </span>
      </div>
      <div className="mt-2.5 text-[1.35rem] font-bold leading-[1.1] tracking-[-0.03em] tabular-nums sm:text-[1.75rem]">
        {value}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.78rem] text-muted">{footer}</div>
      {spark ? <Sparkline values={spark} color={sparkColor} /> : null}
    </Panel>
  );
}

// A card the person may not see. It keeps its place and its title, shows no
// figure and says why. Nothing about the figures is loaded for it.
export function LockedCard({
  name,
  subtitle,
  className = "",
}: {
  name: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <Panel label={`${name} (locked)`} className={className}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.78rem] font-semibold uppercase tracking-[0.05em] text-muted">
          {name}
        </span>
        <span className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-track text-muted">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-[18px] w-[18px]"
          >
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 118 0v3" />
          </svg>
        </span>
      </div>
      {subtitle ? <p className="mt-px text-[0.78rem] text-muted">{subtitle}</p> : null}
      <div className="mt-3 text-[1.35rem] font-bold leading-[1.1] text-[#A8AFC0] sm:text-[1.75rem]" aria-hidden="true">
        &#8212; &#8212;
      </div>
      <p role="status" className="mt-2 text-[0.8rem] text-muted">
        You do not have access to view this report. Ask the System Admin to unlock it.
      </p>
    </Panel>
  );
}

export function SectionSkeleton({ height = "h-40" }: { height?: string }) {
  return (
    <div aria-busy="true" className={`animate-pulse rounded-[18px] bg-surface ${height}`}>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function SectionError({ title }: { title: string }) {
  return (
    <Panel>
      <div role="alert" className="py-4 text-center text-[0.88rem] text-muted">
        <strong className="mb-0.5 block text-[0.95rem] text-error">{title}</strong>
        This section could not be loaded. Nothing was changed. Press Refresh to try again. The other
        sections still work.
      </div>
    </Panel>
  );
}
