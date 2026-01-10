import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { calculateCosting, calculateLineTotal } from "@/lib/calculations";
import { getSettings } from "@/lib/storage";
import { CostingData, DrinkBreakdownItem, Quote } from "@/types";
import { generateId } from "@/lib/id";
import { fetchCosting, saveCosting as saveCostingApi } from "@/lib/api";

const cloneCosting = (data: CostingData): CostingData => JSON.parse(JSON.stringify(data));
const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const round4 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 10000) / 10000;
const clampQty = (n: number) => Math.max(0, round4(n));
const normalizeDrink = (item: DrinkBreakdownItem): DrinkBreakdownItem => ({
  ...item,
  qty: clampQty(item.qty),
  cost: round4(item.cost),
  customerPrice: round4(item.customerPrice),
});

const beerOptions = [
  { id: "coors", name: "Coors Light (bottle)", cost: 0.62 },
  { id: "heineken", name: "Heineken Lager (bottle)", cost: 0.86 },
  { id: "corona", name: "Corona Extra (bottle)", cost: 1.04 },
  { id: "moretti", name: "Birra Moretti Lager (bottle)", cost: 0.93 },
];

const buildDefaultBeers = (customerPrice: number): DrinkBreakdownItem[] =>
  beerOptions.map((o) => ({ ...o, qty: 0, customerPrice }));

const cocktailOptions: Array<{ id: string; name: string; cost: number }> = [
  ["Pornstar Martini", 2.95],
  ["Espresso Martini", 2.7],
  ["Cosmopolitan", 2.5],
  ["Margarita", 2.8],
  ["Martini", 2.1],
  ["Aviation", 2.65],
  ["Boulevardier", 3.2],
  ["Bacardi Cocktail", 2.45],
  ["Clover Club", 2.55],
  ["Daiquiri", 2.3],
  ["Manhattan", 3.1],
  ["White Lady", 2.4],
  ["Woo Woo", 2.35],
  ["Old Fashioned", 3],
  ["Whiskey Sour", 2.75],
  ["Mimosa", 1.85],
  ["Kir", 2.0],
  ["French 75", 2.6],
  ["Mojito", 2.3],
  ["Gin Basil Smash", 2.45],
  ["Irish Coffee", 2.7],
  ["Pina Colada", 2.65],
  ["Tequila Sunrise", 2.5],
  ["Sex on the Beach", 2.4],
  ["Bramble", 2.55],
  ["Paloma", 2.6],
  ["Penicillin", 2.85],
].map(([name, cost], idx) => ({ id: `ct-${idx}`, name, cost: Number(cost) }));

const defaultWineItem = (
  kind: "Red" | "White",
  costPerGlass: number,
  customerPrice: number
): DrinkBreakdownItem => ({
  id: `wine-${kind.toLowerCase()}`,
  name: `${kind} Wine (glass)`,
  qty: 0,
  cost: costPerGlass,
  customerPrice,
});

const buildExtrasFromQuote = (quote: Quote): DrinkBreakdownItem[] => {
  const settings = getSettings();
  const fxRate = quote.fxRate ?? settings.currency.gbpRate;
  const convert = (value: number) => (quote.currency === "GBP" ? value * fxRate : value);
  const classCosts = {
    Classic: convert(settings.classPricing.classicPerHead),
    Luxury: convert(settings.classPricing.luxuryPerHead),
    Ultimate: convert(settings.classPricing.ultimatePerHead),
  };
  return quote.lines
    .filter((line) => line.kind === "custom" || line.kind === "class" || line.kind === "boozyBrunch" || line.kind === "guestFee")
    .map((line, idx) => {
      if (line.kind === "class") {
        const costPerHead = classCosts[line.tier] ?? 0;
        return {
          id: `quote-class-${idx}`,
          name: line.tier,
          qty: line.guests,
          cost: costPerHead,
          customerPrice: line.pricePerGuest,
          source: "quoteDerivedClass",
        };
      }
      if (line.kind === "boozyBrunch") {
        return {
          id: `quote-brunch-${idx}`,
          name: "Boozy Brunch",
          qty: line.guests,
          cost: 0,
          customerPrice: line.pricePerGuest,
          source: "quoteDerivedBrunch",
        };
      }
      if (line.kind === "guestFee") {
        return {
          id: `quote-guestfee-${idx}`,
          name: "Custom Package",
          qty: line.guests,
          cost: 0,
          customerPrice: line.pricePerGuest,
          source: "quoteDerivedGuestFee",
        };
      }
      return {
        id: `quote-line-${idx}`,
        name: line.description || "Custom item",
        qty: line.qty,
        cost: line.ownerCost || 0,
        customerPrice: line.unitPrice,
        source: "customLine",
      };
    });
};

const mergeExtras = (items: DrinkBreakdownItem[]): DrinkBreakdownItem[] => {
  const grouped = new Map<string, DrinkBreakdownItem>();
  items.forEach((item) => {
    const key = `${item.source || "none"}|${item.name}|${item.cost}|${item.customerPrice}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.qty += item.qty;
    } else {
      grouped.set(key, { ...item });
    }
  });
  return Array.from(grouped.values());
};

const createDefaultCosting = (quote: Quote): CostingData => {
  const settings = getSettings();
  const fxRate = quote.fxRate ?? settings.currency.gbpRate;
  const convert = (value: number) => (quote.currency === "GBP" ? value * fxRate : value);
  const glassesPerBottle = settings.costTables.wine.glassesPerBottle || 4;
  const bottleCost = convert(settings.costTables.wine.bottleCost || 10);
  const costPerGlass = bottleCost / glassesPerBottle;
  const beerCustomer = convert(settings.costTables.beer.customerPrice || 4);
  const wineCustomer = convert(settings.costTables.wine.customerPricePerGlass || 8);
  const vatRate = quote.vat.enabled ? quote.vat.rate : 0;

  return {
    quoteId: quote.id,
    beers: buildDefaultBeers(beerCustomer).map((b) => ({ ...b, cost: convert(b.cost) })),
    cocktails: [],
    wines: {
      bottleCounts: { red: 0, white: 0 },
      glassesPerBottle,
      bottleCost,
      red: [defaultWineItem("Red", costPerGlass, wineCustomer)],
      white: [defaultWineItem("White", costPerGlass, wineCustomer)],
    },
    extras: mergeExtras(buildExtrasFromQuote(quote)),
    overheads: {
      staffWages: 0,
      staffTravel: 0,
      petrol: 0,
      vatRate,
    },
    totals: { internalCost: 0, customerTotal: 0, profit: 0, marginPct: 0, vatAmount: 0 },
  };
};

const sumDrinkCost = (items: DrinkBreakdownItem[]) =>
  items.reduce((sum, item) => sum + item.qty * item.cost, 0);

const deriveBottleCount = (items: DrinkBreakdownItem[], glassesPerBottle: number) => {
  const perBottle = glassesPerBottle || 1;
  const qty = items[0]?.qty ?? 0;
  return perBottle > 0 ? round2(qty / perBottle) : 0;
};

const normalizeCosting = (costing: CostingData) => {
  const glassesPerBottle = costing.wines.glassesPerBottle || 1;
  const bottleCounts = {
    red: costing.wines.bottleCounts?.red ?? deriveBottleCount(costing.wines.red, glassesPerBottle),
    white: costing.wines.bottleCounts?.white ?? deriveBottleCount(costing.wines.white, glassesPerBottle),
  };

  const applyBottleCounts = (items: DrinkBreakdownItem[], count: number | undefined) => {
    const bottles = Number.isFinite(count) ? round2(Number(count)) : 0;
    const glasses = round4(bottles * glassesPerBottle);
    return items.map((wine) => ({ ...wine, qty: glasses }));
  };

  const normalized = {
    ...costing,
    wines: {
      ...costing.wines,
      bottleCounts,
      red: applyBottleCounts(costing.wines.red, bottleCounts.red),
      white: applyBottleCounts(costing.wines.white, bottleCounts.white),
    },
    beers: costing.beers.map((b) => ({
      ...b,
      qty: Number.isFinite(b.qty) ? Number(b.qty) : 0, // preserve exact beer bottle count typed
      cost: round4(b.cost),
      customerPrice: round4(b.customerPrice),
    })),
    cocktails: costing.cocktails.map(normalizeDrink),
    extras: costing.extras.map(normalizeDrink),
  };
  return { ...normalized, totals: calculateCosting(normalized) };
};

const applyCostingDefaults = (data: CostingData, quote: Quote) => {
  const settings = getSettings();
  const fxRate = quote.fxRate ?? settings.currency.gbpRate;
  const convert = (value: number) => (quote.currency === "GBP" ? value * fxRate : value);
  const defaultCocktailPrice = convert(settings.costTables.cocktail.customerPrice || 0);
  const defaultBeerPrice = convert(settings.costTables.beer.customerPrice || 0);
  const wineSettings = settings.costTables.wine;
  const glassesPerBottle = wineSettings.glassesPerBottle || 1;
  const bottleCost = convert(wineSettings.bottleCost || 0);
  const costPerGlass = bottleCost / glassesPerBottle;
  const wineCustomerPrice = convert(wineSettings.customerPricePerGlass || 0);

  const updated = {
    ...data,
    beers: data.beers.map((b) => ({
      ...b,
      customerPrice: defaultBeerPrice,
    })),
    cocktails: data.cocktails
      .map((c) => ({ ...c, customerPrice: defaultCocktailPrice }))
      .filter((c) => !(cocktailOptions.some((preset) => preset.id === c.id) && c.qty === 0)),
    wines: {
      ...data.wines,
      glassesPerBottle,
      bottleCost,
      red: data.wines.red.map((wine) => ({ ...wine, cost: costPerGlass, customerPrice: wineCustomerPrice })),
      white: data.wines.white.map((wine) => ({ ...wine, cost: costPerGlass, customerPrice: wineCustomerPrice })),
    },
  };

  return normalizeCosting(updated);
};

const getOverheadsFromQuote = (quote: Quote, _fallbackVat: number) => {
  const staffWages = quote.lines
    .filter((line) => line.kind === "staffWork")
    .reduce((sum, line) => sum + calculateLineTotal(line), 0);
  const staffTravel = quote.lines
    .filter((line) => line.kind === "staffTravel")
    .reduce((sum, line) => sum + calculateLineTotal(line), 0);
  const petrol = quote.lines
    .filter((line) => line.kind === "petrol")
    .reduce((sum, line) => sum + calculateLineTotal(line), 0);

  return {
    staffWages: Number(staffWages.toFixed(2)),
    staffTravel: Number(staffTravel.toFixed(2)),
    petrol: Number(petrol.toFixed(2)),
    vatRate: quote.vat.enabled ? quote.vat.rate : 0,
  };
};

const applyQuoteOverheads = (data: CostingData, quote: Quote) => {
  const updated: CostingData = {
    ...data,
    overheads: { ...data.overheads, ...getOverheadsFromQuote(quote, data.overheads.vatRate) },
  };
  return normalizeCosting(updated);
};

type CostingWorkspaceProps = {
  quote: Quote;
  onChange?: (costing: CostingData) => void;
};

const extrasSignature = (items: DrinkBreakdownItem[]) =>
  JSON.stringify(
    items.map((item) => ({
      name: item.name,
      qty: item.qty,
      cost: item.cost,
      customerPrice: item.customerPrice,
      source: item.source,
    }))
  );

export default function CostingWorkspace({ quote, onChange }: CostingWorkspaceProps) {
  const [costing, setCosting] = useState<CostingData | null>(null);
  const [selectedCocktailId, setSelectedCocktailId] = useState<string>(cocktailOptions[0]?.id || "");
  const [selectedCocktailQty, setSelectedCocktailQty] = useState<number>(1);
  const currencySymbol = quote.currency === "GBP" ? "£" : "€";
  const formatMoney = (value: number) => `${currencySymbol}${value.toFixed(2)}`;
  const fxRate = quote.fxRate ?? getSettings().currency.gbpRate;
  const convertPresetCost = (value: number) => (quote.currency === "GBP" ? value * fxRate : value);

  useEffect(() => {
    const load = async () => {
      const base = normalizeCosting(createDefaultCosting(quote));
      let remote: CostingData | null = null;
      try {
        if (quote.id) {
          const res = await fetchCosting(quote.id);
          if (res?.data) remote = normalizeCosting(res.data as CostingData);
        }
      } catch {
        // ignore
      }
      const chosen = remote ?? base;
      const withOverheads = applyQuoteOverheads(chosen, quote);
      setCosting(applyCostingDefaults(withOverheads, quote));
    };
    load();
  }, [quote.id, quote.currency, quote.fxRate]);

  const quoteOverheadsKey = useMemo(
    () => JSON.stringify(getOverheadsFromQuote(quote, quote.vat.rate)),
    [quote],
  );

  useEffect(() => {
    setCosting((prev) => {
      if (!prev) return prev;
      const nextOverheads = getOverheadsFromQuote(quote, prev.overheads.vatRate);
      const hasChange =
        prev.overheads.staffWages !== nextOverheads.staffWages ||
        prev.overheads.staffTravel !== nextOverheads.staffTravel ||
        prev.overheads.petrol !== nextOverheads.petrol ||
        prev.overheads.vatRate !== nextOverheads.vatRate;
      if (!hasChange) return prev;
      return normalizeCosting({
        ...prev,
        overheads: { ...prev.overheads, ...nextOverheads },
      });
    });
  }, [quoteOverheadsKey]);

  useEffect(() => {
    if (!costing) return;
    const persist = async () => {
      if (!quote.id) return;
      try {
        await saveCostingApi(quote.id, costing);
      } catch {
        // ignore
      }
    };
    persist();
    onChange?.(costing);
  }, [costing, onChange, quote.id]);

  useEffect(() => {
    if (!costing) return;
    const latestExtras = mergeExtras(buildExtrasFromQuote(quote));
    const changed = extrasSignature(costing.extras) !== extrasSignature(latestExtras);
    if (!changed) return;
    setCosting((prev) => {
      if (!prev) return prev;
      return normalizeCosting({ ...prev, extras: latestExtras });
    });
  }, [quote, costing]);

  const updateDrinks = (
    section: "beers" | "cocktails" | "extras" | "wineRed" | "wineWhite",
    id: string,
    field: "qty" | "customerPrice",
    value: number
  ) => {
    if (!costing) return;
    setCosting((prev) => {
      if (!prev) return prev;
      const clone = cloneCosting(prev);
      const target =
        section === "wineRed"
          ? clone.wines.red
          : section === "wineWhite"
          ? clone.wines.white
          : (clone as any)[section];
      const idx = target.findIndex((item: DrinkBreakdownItem) => item.id === id);
      if (idx >= 0) {
        target[idx] = { ...target[idx], [field]: value };
      }
      return normalizeCosting(clone);
    });
  };

  const addExtraLine = () => {
    if (!costing) return;
    setCosting((prev) => {
      if (!prev) return prev;
      const clone = cloneCosting(prev);
      clone.extras.push({
        id: generateId(),
        name: "Custom item",
        qty: 0,
        cost: 0,
        customerPrice: 0,
      });
      return normalizeCosting(clone);
    });
  };

  const addBeerLine = () => {
    if (!costing) return;
    setCosting((prev) => {
      if (!prev) return prev;
      const clone = cloneCosting(prev);
      clone.beers.push({
        id: generateId(),
        name: "Custom beer",
        qty: 0,
        cost: 0,
        customerPrice: convertPresetCost(getSettings().costTables.beer.customerPrice),
      });
      return normalizeCosting(clone);
    });
  };

  const addCocktailFromDropdown = () => {
    if (!costing || !selectedCocktailId) return;
    const option = cocktailOptions.find((c) => c.id === selectedCocktailId);
    if (!option) return;
    const defaultPrice = convertPresetCost(getSettings().costTables.cocktail.customerPrice || 0);
    const convertedCost = convertPresetCost(option.cost);

    setCosting((prev) => {
      if (!prev) return prev;
      const clone = cloneCosting(prev);
      const existing = clone.cocktails.find((c) => c.id === option.id);
      const qtyToUse = selectedCocktailQty > 0 ? selectedCocktailQty : 1;
      if (existing) {
        existing.customerPrice = defaultPrice;
        existing.qty = qtyToUse;
        existing.cost = convertedCost;
        return normalizeCosting(clone);
      }
      clone.cocktails.push({
        ...option,
        qty: qtyToUse,
        customerPrice: defaultPrice,
        cost: convertedCost,
      });
      return normalizeCosting(clone);
    });
    setSelectedCocktailQty(1);
  };

  const addCocktailLine = () => {
    if (!costing) return;
    setCosting((prev) => {
      if (!prev) return prev;
      const clone = cloneCosting(prev);
      clone.cocktails.push({
        id: generateId(),
        name: "Custom cocktail",
        qty: 0,
        cost: 0,
        customerPrice: convertPresetCost(getSettings().costTables.cocktail.customerPrice),
      });
      return normalizeCosting(clone);
    });
  };

  const removeCocktailLine = (id: string) => {
    if (!costing) return;
    setCosting((prev) => {
      if (!prev) return prev;
      const clone = cloneCosting(prev);
      clone.cocktails = clone.cocktails.filter((c) => c.id !== id);
      return normalizeCosting(clone);
    });
  };

  const updateExtraMeta = (id: string, field: "name" | "cost", value: string | number, section: "extras" | "beers" | "cocktails" = "extras") => {
    if (!costing) return;
    setCosting((prev) => {
      if (!prev) return prev;
      const clone = cloneCosting(prev);
      const target = section === "extras" ? clone.extras : (clone as any)[section];
      const idx = target.findIndex((item: DrinkBreakdownItem) => item.id === id);
      if (idx >= 0) {
        target[idx] = { ...target[idx], [field]: value };
      }
      return normalizeCosting(clone);
    });
  };

  const beverageCost = useMemo(
    () =>
      costing
        ? sumDrinkCost(costing.beers) +
          sumDrinkCost(costing.cocktails) +
          sumDrinkCost(costing.wines.red) +
          sumDrinkCost(costing.wines.white) +
          sumDrinkCost(costing.extras)
        : 0,
    [costing]
  );

const updateWineBottles = (kind: "red" | "white", bottles: number) => {
  if (!costing) return;
  setCosting((prev) => {
    if (!prev) return prev;
    const clone = cloneCosting(prev);
    const glassesPerBottle = clone.wines.glassesPerBottle || 1;
    const bottlesInput = Number.isFinite(bottles) ? Math.max(0, round2(bottles)) : 0;
    const glasses = round4(bottlesInput * glassesPerBottle);
    const target = kind === "red" ? clone.wines.red : clone.wines.white;
    const updated = target.map((wine) => ({ ...wine, qty: glasses }));
    if (kind === "red") clone.wines.red = updated;
    else clone.wines.white = updated;
    clone.wines.bottleCounts = {
      red: kind === "red" ? bottlesInput : clone.wines.bottleCounts?.red ?? 0,
      white: kind === "white" ? bottlesInput : clone.wines.bottleCounts?.white ?? 0,
    };
    return normalizeCosting(clone);
  });
};

  if (!costing) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading costing for this quote...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Beers</CardTitle>
            <Button variant="outline" size="sm" onClick={addBeerLine}>
              <Plus className="h-4 w-4 mr-2" /> Custom beer
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Cost ({currencySymbol})</TableHead>
                  <TableHead>Customer ({currencySymbol})</TableHead>
                  <TableHead className="text-right">Qty (bottles)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costing.beers.map((beer) => (
                  <TableRow key={beer.id}>
                    <TableCell>
                      <Input
                        value={beer.name}
                        onChange={(e) => updateExtraMeta(beer.id, "name", e.target.value, "beers")}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={beer.cost}
                        onChange={(e) => updateExtraMeta(beer.id, "cost", parseFloat(e.target.value) || 0, "beers")}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={beer.customerPrice}
                        onChange={(e) => updateDrinks("beers", beer.id, "customerPrice", parseFloat(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        value={beer.qty}
                        onChange={(e) => updateDrinks("beers", beer.id, "qty", parseFloat(e.target.value) || 0)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Bottle cost {formatMoney(costing.wines.bottleCost)} / {costing.wines.glassesPerBottle} glasses ⇒{" "}
              {formatMoney(costing.wines.bottleCost / costing.wines.glassesPerBottle || 0)} per glass
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Red bottles carried</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={costing.wines.bottleCounts?.red ?? (costing.wines.red[0]?.qty || 0) / (costing.wines.glassesPerBottle || 1)}
                  onChange={(e) => updateWineBottles("red", parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">Sets red glasses to bottles × glasses per bottle.</p>
              </div>
              <div className="space-y-2">
                <Label>White bottles carried</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={costing.wines.bottleCounts?.white ?? (costing.wines.white[0]?.qty || 0) / (costing.wines.glassesPerBottle || 1)}
                  onChange={(e) => updateWineBottles("white", parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">Sets white glasses to bottles × glasses per bottle.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Red Wine (glasses)</Label>
              <div className="space-y-3">
                {costing.wines.red.map((wine) => (
                  <div
                    key={wine.id}
                    className="flex flex-wrap items-center gap-3 rounded-md border p-3"
                  >
                    <div className="flex-1 min-w-[180px]">
                      <p className="font-medium">{wine.name}</p>
                      <p className="text-sm text-muted-foreground">{formatMoney(wine.cost)} cost</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Customer {currencySymbol}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        className="w-24"
                        value={wine.customerPrice}
                        onChange={(e) => updateDrinks("wineRed", wine.id, "customerPrice", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Qty</Label>
                      <Input
                        type="number"
                        min="0"
                        className="w-20"
                        value={wine.qty}
                        onChange={(e) => updateDrinks("wineRed", wine.id, "qty", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>White Wine (glasses)</Label>
              <div className="space-y-3">
                {costing.wines.white.map((wine) => (
                  <div
                    key={wine.id}
                    className="flex flex-wrap items-center gap-3 rounded-md border p-3"
                  >
                    <div className="flex-1 min-w-[180px]">
                      <p className="font-medium">{wine.name}</p>
                      <p className="text-sm text-muted-foreground">{formatMoney(wine.cost)} cost</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Customer {currencySymbol}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        className="w-24"
                        value={wine.customerPrice}
                        onChange={(e) => updateDrinks("wineWhite", wine.id, "customerPrice", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Qty</Label>
                      <Input
                        type="number"
                        min="0"
                        className="w-20"
                        value={wine.qty}
                        onChange={(e) => updateDrinks("wineWhite", wine.id, "qty", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Cocktails</CardTitle>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label>Add cocktail from presets</Label>
              <Select
                value={selectedCocktailId}
                onValueChange={(value) => {
                  setSelectedCocktailId(value);
                  const match = cocktailOptions.find((c) => c.id === value);
                  if (match) {
                    setSelectedCocktailQty(0);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a cocktail" />
                </SelectTrigger>
                <SelectContent>
                  {cocktailOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name} — {formatMoney(convertPresetCost(option.cost))} cost
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Qty</Label>
                <Input
                  type="number"
                  min="1"
                  className="w-20"
                  value={selectedCocktailQty}
                  onChange={(e) => setSelectedCocktailQty(parseFloat(e.target.value) || 0)}
                />
              </div>
              <Button onClick={addCocktailFromDropdown} disabled={!selectedCocktailId}>
                Add cocktail
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Select a cocktail, set price/quantity, then add.</p>
          {costing.cocktails.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground text-center">
              Add a cocktail to begin.
            </div>
          ) : (
            <div className="space-y-3">
              {costing.cocktails.map((cocktail) => (
                <div key={cocktail.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-medium">{cocktail.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Cost {formatMoney(cocktail.cost)} • Customer {formatMoney(cocktail.customerPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Qty</Label>
                    <Input
                      type="number"
                      min="0"
                      className="w-20"
                      value={cocktail.qty}
                      onChange={(e) => updateDrinks("cocktails", cocktail.id, "qty", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeCocktailLine(cocktail.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                    <span className="sr-only">Remove cocktail</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Overheads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Staff wages ({currencySymbol})</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={costing.overheads.staffWages}
                onChange={(e) =>
                  setCosting(
                    normalizeCosting({
                      ...costing,
                      overheads: { ...costing.overheads, staffWages: parseFloat(e.target.value) || 0 },
                    })
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Staff travel ({currencySymbol})</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={costing.overheads.staffTravel}
                onChange={(e) =>
                  setCosting(
                    normalizeCosting({
                      ...costing,
                      overheads: { ...costing.overheads, staffTravel: parseFloat(e.target.value) || 0 },
                    })
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Petrol ({currencySymbol})</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={costing.overheads.petrol}
                onChange={(e) =>
                  setCosting(
                    normalizeCosting({
                      ...costing,
                      overheads: { ...costing.overheads, petrol: parseFloat(e.target.value) || 0 },
                    })
                  )
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Margin Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Internal cost (incl. overheads)</p>
              <p className="text-2xl font-bold">{formatMoney(costing.totals.internalCost)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Customer total (ex VAT)</p>
              <p className="text-2xl font-bold text-primary">{formatMoney(costing.totals.customerTotal)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">VAT (@ {costing.overheads.vatRate}%)</p>
              <p className="text-lg font-semibold">{formatMoney(costing.totals.vatAmount)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Projected profit</p>
              <p className="text-2xl font-bold">{formatMoney(costing.totals.profit)}</p>
              <p className="text-sm text-muted-foreground">Margin {costing.totals.marginPct.toFixed(1)}%</p>
            </div>
            <Separator className="md:col-span-2" />
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Beverage cost (COGS)</p>
              <p className="text-lg font-medium">{formatMoney(beverageCost)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Overheads (staff + petrol)</p>
              <p className="text-lg font-medium">
                {formatMoney(costing.overheads.staffWages + costing.overheads.staffTravel + costing.overheads.petrol)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
