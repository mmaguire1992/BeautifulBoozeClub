import { CostingData, DrinkBreakdownItem, Quote, QuoteLine } from "@/types";
import { calculateLineTotal } from "./calculations";

export type InvoiceLine = { description: string; amount: number };

export const INTERNAL_LINE_KINDS: QuoteLine["kind"][] = ["staffWork", "staffTravel", "petrol"];

const sumRevenue = (items: DrinkBreakdownItem[]) =>
  items.reduce((sum, item) => sum + item.customerPrice * item.qty, 0);

const sumQty = (items: DrinkBreakdownItem[]) => items.reduce((sum, item) => sum + item.qty, 0);

const summarizeSelections = (items: DrinkBreakdownItem[]) =>
  items
    .filter((item) => item.qty > 0)
    .map((item) => `${item.qty} ${item.name}`)
    .join(", ");

export const describeQuoteLine = (line: QuoteLine): string => {
  switch (line.kind) {
    case "package":
      return `${line.name} package × ${line.qty}`;
    case "class":
      return `${line.tier} cocktail class · ${line.guests} guests`;
    case "boozyBrunch":
      return `Boozy brunch · ${line.guests} guests`;
    case "guestFee":
      return `Custom package · ${line.guests} cocktails @ €${line.pricePerGuest}/cocktail`;
    case "custom":
      return `${line.description} × ${line.qty}`;
    case "staffWork":
      return `Staff work · ${line.hours} hrs @ €${line.hourlyRate}/h`;
    case "staffTravel":
      return `Staff travel · ${line.hours} hrs @ €${line.hourlyRate}/h`;
    case "petrol":
      if (line.model === "mpg") {
        const miles = line.miles ?? 0;
        const price = line.pricePerLitre ?? 0;
        const mpg = line.mpg ?? 0;
        return `Travel (${miles} miles · ${mpg} mpg · €${price}/L)`;
      }
      return `Travel (${line.miles ?? 0} miles · €${line.costPerMile ?? 0}/mile)`;
    default:
      return "Line item";
  }
};

export const buildInvoiceLines = (
  quote: Quote,
  options?: { costing?: CostingData; includeInternal?: boolean }
): InvoiceLine[] => {
  const includeInternal = options?.includeInternal ?? false;
  const costing = options?.costing;
  const hasBundleLine = quote.lines.some((line) =>
    ["package", "guestFee", "class", "boozyBrunch"].includes(line.kind)
  );

  const baseLines = quote.lines
    .filter((line) => includeInternal || !INTERNAL_LINE_KINDS.includes(line.kind))
    .map((line) => ({
      description: describeQuoteLine(line),
      amount: calculateLineTotal(line),
    }))
    .filter((line) => line.amount > 0);

  if (!costing) return baseLines;

  const customerLines: InvoiceLine[] = [];
  const beerRevenue = sumRevenue(costing.beers);
  const beerQty = sumQty(costing.beers);
  const beerSelection = summarizeSelections(costing.beers);
  if (beerRevenue > 0) {
    customerLines.push({
      description: `Beers${beerQty ? ` (${beerQty} bottles${beerSelection ? `: ${beerSelection}` : ""})` : ""}`,
      amount: beerRevenue,
    });
  }

  const cocktailRevenue = sumRevenue(costing.cocktails);
  const cocktailQty = sumQty(costing.cocktails);
  const cocktailSelection = summarizeSelections(costing.cocktails);
  const shouldChargeCocktails = includeInternal || !hasBundleLine;
  if (cocktailRevenue > 0 && shouldChargeCocktails) {
    customerLines.push({
      description: `Cocktails${cocktailQty ? ` (${cocktailQty}${cocktailSelection ? `: ${cocktailSelection}` : ""})` : ""}`,
      amount: cocktailRevenue,
    });
  }

  const wineItems = [...costing.wines.red, ...costing.wines.white];
  const wineRevenue = sumRevenue(wineItems);
  const wineQty = sumQty(wineItems);
  const wineSelection = summarizeSelections(wineItems);
  if (wineRevenue > 0) {
    customerLines.push({
      description: `Wine by the glass${wineQty ? ` (${wineQty} glasses${wineSelection ? `: ${wineSelection}` : ""})` : ""}`,
      amount: wineRevenue,
    });
  }

  const detailLines: InvoiceLine[] = [];
  const detailDescription = (label: string, selection: string) =>
    selection ? `${label} selection: ${selection}` : `${label} selection`;

  if (cocktailSelection) {
    detailLines.push({ description: detailDescription("Cocktails", cocktailSelection), amount: 0 });
  }

  return [...baseLines, ...detailLines, ...customerLines];
};

export const calculateInvoiceTotals = (
  quote: Quote,
  options?: { costing?: CostingData; includeInternal?: boolean }
) => {
  const lines = buildInvoiceLines(quote, options);
  const net = lines.reduce((sum, line) => sum + line.amount, 0);
  const vat = quote.vat.enabled ? (net * quote.vat.rate) / 100 : 0;
  const gross = net + vat;

  return { lines, totals: { net, vat, gross } };
};
