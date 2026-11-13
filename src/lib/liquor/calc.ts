import { formatPaise, parseAmountToPaise } from "@/lib/format/money";

// Rate and cost of a bottle and of a peg, worked out from one rate row and the
// item's size. Done in whole paise with BigInt and rounded once at the end, so no
// floating point touches money. A peg is 60 ml. Safe to import in browser code.

const PEG_ML = 60;

export type RateFigures = {
  ratePerBottle: bigint;
  cess: bigint;
  costPerBottle: bigint;
  ratePerPeg: bigint;
  costPerPeg: bigint;
  // Pegs in one bottle, with two decimals as text.
  pegsPerBottle: string;
};

function divideRound(numerator: bigint, denominator: bigint): bigint {
  return (numerator * BigInt(2) + denominator) / (denominator * BigInt(2));
}

export function rateFigures(
  caseRate: string,
  cessAmount: string,
  bottlesPerCase: number,
  volumeMl: number,
): RateFigures | null {
  const casePaise = parseAmountToPaise(caseRate);
  const cessPaise = parseAmountToPaise(cessAmount);
  if (casePaise === null || cessPaise === null || bottlesPerCase <= 0 || volumeMl <= 0) {
    return null;
  }
  const bottles = BigInt(bottlesPerCase);
  const volume = BigInt(volumeMl);
  const peg = BigInt(PEG_ML);
  const pegsHundredths = divideRound(volume * BigInt(100), peg);
  return {
    ratePerBottle: divideRound(casePaise, bottles),
    cess: cessPaise,
    // Cost includes the cess. Rounded once from the exact value.
    costPerBottle: divideRound(casePaise + cessPaise * bottles, bottles),
    ratePerPeg: divideRound(casePaise * peg, bottles * volume),
    costPerPeg: divideRound((casePaise + cessPaise * bottles) * peg, bottles * volume),
    pegsPerBottle: formatPaise(pegsHundredths),
  };
}

// The cess slab for a shop price, as the database works it out: below 500 none,
// 500 to 999 it is 20, 1000 and above it is 40. Shown as a preview only; the
// database sets the saved figure.
export function cessForPrice(fl1Price: string): string | null {
  const paise = parseAmountToPaise(fl1Price);
  if (paise === null) return null;
  if (paise >= BigInt(100000)) return "40.00";
  if (paise >= BigInt(50000)) return "20.00";
  return "0.00";
}

// The first line of an item: the stock name and the size, like AMSTEL BEER 650 ML.
export function itemTitle(stockName: string, volumeMl: number): string {
  return `${stockName.trim()} ${volumeMl} ML`;
}

// The second line: the code and the BevCo name. When the stock name is only the
// BevCo name, the line shows the code alone.
export function itemSubline(code: string, itemName: string, stockName: string): string {
  const same = itemName.trim().toLowerCase() === stockName.trim().toLowerCase();
  return same ? `(${code})` : `(${code} | ${itemName.trim()})`;
}
