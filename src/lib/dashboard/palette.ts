// The colour-blind-safe categorical palette (Okabe-Ito) used by every chart, as
// set in docs/00-Overview-And-Architecture.md. Safe to import in browser code.
export const PALETTE = {
  blue: "#1F4FA3",
  orange: "#E98A00",
  sky: "#56B4E9",
  green: "#009E73",
  pink: "#CC79A7",
  vermilion: "#D55E00",
  yellow: "#F0E442",
} as const;

// The order series take their colours in, so the same ledger keeps the same
// colour from one month to the next.
export const SERIES_COLORS = [
  PALETTE.blue,
  PALETTE.pink,
  PALETTE.sky,
  PALETTE.green,
  PALETTE.orange,
  PALETTE.vermilion,
] as const;
