import { Quote, QuoteLine, CostingData, DrinkBreakdownItem } from '@/types';

export const calculateLineTotal = (line: QuoteLine): number => {
  switch (line.kind) {
    case 'package':
      return line.unitPrice * line.qty;
    case 'class':
      return line.pricePerGuest * line.guests;
    case 'boozyBrunch':
      return line.pricePerGuest * line.guests;
    case 'guestFee':
      return line.pricePerGuest * line.guests;
    case 'custom':
      return line.unitPrice * line.qty;
    case 'staffWork':
      return line.hourlyRate * line.hours;
    case 'staffTravel':
      return line.hourlyRate * line.hours;
    case 'petrol':
      if (line.model === 'mpg' && line.pricePerLitre && line.miles && line.mpg) {
        const litresUsed = (line.miles / line.mpg) * 4.54609;
        return litresUsed * line.pricePerLitre;
      } else if (line.model === 'perMile' && line.costPerMile && line.miles) {
        return line.miles * line.costPerMile;
      }
      return 0;
    default:
      return 0;
  }
};

export const calculateQuoteTotals = (quote: Quote): { net: number; vat: number; gross: number } => {
  const net = quote.lines.reduce((sum, line) => sum + calculateLineTotal(line), 0);
  const vat = quote.vat.enabled ? (net * quote.vat.rate) / 100 : 0;
  const gross = net + vat;
  
  return { net, vat, gross };
};

const sumDrinkCost = (items: DrinkBreakdownItem[]) =>
  items.reduce((sum, item) => sum + item.qty * item.cost, 0);

const sumDrinkRevenue = (items: DrinkBreakdownItem[]) =>
  items.reduce((sum, item) => sum + item.qty * item.customerPrice, 0);

export const calculateCosting = (costing: CostingData) => {
  const drinkCost =
    sumDrinkCost(costing.beers) +
    sumDrinkCost(costing.cocktails) +
    sumDrinkCost(costing.wines.red) +
    sumDrinkCost(costing.wines.white) +
    sumDrinkCost(costing.extras);

  const drinkRevenue =
    sumDrinkRevenue(costing.beers) +
    sumDrinkRevenue(costing.cocktails) +
    sumDrinkRevenue(costing.wines.red) +
    sumDrinkRevenue(costing.wines.white) +
    sumDrinkRevenue(costing.extras);

  const overheadsTotal =
    costing.overheads.staffWages + costing.overheads.staffTravel + costing.overheads.petrol;

  const internalCost = drinkCost + overheadsTotal;
  const customerTotal = drinkRevenue;
  const profit = customerTotal - internalCost;
  const marginPct = customerTotal > 0 ? (profit / customerTotal) * 100 : 0;
  const vatAmount = costing.overheads.vatRate > 0 ? customerTotal * (costing.overheads.vatRate / 100) : 0;

  return { internalCost, customerTotal, profit, marginPct, vatAmount };
};
