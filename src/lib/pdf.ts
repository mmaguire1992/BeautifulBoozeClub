import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import logo from "@/assets/logo.png";
import { Quote, Settings, CostingData, DrinkBreakdownItem, Booking } from "@/types";
import type { Content, StyleDictionary, TDocumentDefinitions } from "pdfmake/interfaces";
import { buildInvoiceLines, calculateInvoiceTotals, type InvoiceLine } from "./invoice";
import { getEurToGbpRate } from "./fx";

(pdfMake as unknown as { vfs: any }).vfs =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfFonts as any)?.pdfMake?.vfs || (pdfFonts as any)?.vfs || {};

type QuotePdfVariant = "customer" | "owner";

type OwnerTravelSummary = {
  origin: string;
  destination: string;
  provider: string;
  fuelPricePerLitre: number;
  distance: {
    miles: number;
    km: number;
    durationMinutes: number;
  };
  petrolCost: number | null;
};

const formatCurrency = (value: number, currency: "EUR" | "GBP" = "EUR") =>
  `${currency === "GBP" ? "£" : "€"}${value.toFixed(2)}`;
const formatCurrencyGbp = (value: number) => `£${value.toFixed(2)}`;
const formatCurrencyEur = (value: number) => `€${value.toFixed(2)}`;

const summarizeDrinks = (items: DrinkBreakdownItem[]) => {
  const nonZero = items.filter((item) => item.qty > 0);
  return nonZero.length > 0 ? nonZero.map((item) => `${item.qty} ${item.name}`).join(", ") : "—";
};

const getDrinkTotals = (items: DrinkBreakdownItem[]) => {
  const cost = items.reduce((sum, item) => sum + item.qty * item.cost, 0);
  const revenue = items.reduce((sum, item) => sum + item.qty * item.customerPrice, 0);
  return { cost, revenue };
};

const formatCurrencyPair = (value: number, currency: "EUR" | "GBP", rate: number) => {
  if (currency === "GBP") {
    const eurValue = rate > 0 ? value / rate : value;
    return {
      stack: [
        { text: formatCurrency(value, "GBP"), style: "valueBold" },
        { text: formatCurrencyEur(eurValue), style: "muted" },
      ],
    };
  }
  return {
    stack: [
      { text: formatCurrency(value, "EUR"), style: "valueBold" },
      { text: formatCurrencyGbp(value * rate), style: "muted" },
    ],
  };
};

const partitionExtras = (extras: DrinkBreakdownItem[]) => {
  const customLines = extras.filter((item) => item.source === "customLine");
  const otherExtras = extras.filter((item) => item.source !== "customLine");
  return { customLines, otherExtras };
};

const flattenWines = (wines: CostingData["wines"]) => [...wines.red, ...wines.white];
const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const fetchLogoDataUrl = async (): Promise<string> => {
  try {
    const response = await fetch(logo);
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    return "";
  }
};

const buildHeader = (settings: Settings, title: string, subtitle: string, logoDataUrl: string): Content => ({
  columns: [
    {
      stack: [
        { text: settings.business.name || "The Beautiful Booze Club", style: "h1" },
        { text: subtitle, style: "muted" },
      ],
      alignment: "left",
    },
    logoDataUrl
      ? { image: logoDataUrl, width: 120, alignment: "right" }
      : { text: title, style: "badge", alignment: "right" },
  ],
  margin: [0, 0, 0, 16],
});

const buildEventDetails = (quote: Quote): Content => ({
  columns: [
    [
      { text: "Prepared for", style: "label" },
      { text: quote.customer.name || "—", style: "value" },
      { text: quote.customer.email || "No email", style: "muted" },
      { text: `Quote ID: ${quote.id.slice(0, 8)}`, style: "muted" },
    ],
    [
      { text: "Event", style: "label" },
      { text: quote.event.type || "—", style: "value" },
      { text: `${quote.event.date} ${quote.event.time}`.trim(), style: "muted" },
    ],
    [
      { text: "Location", style: "label" },
      { text: quote.event.location || "—", style: "value" },
      { text: `${quote.event.guests || 0} guests`, style: "muted" },
    ],
  ],
  margin: [0, 0, 0, 12],
});

const buildCompanyInfo = (): Content => ({
  stack: [
    { text: "Company Information", style: "h2" },
    { text: "TLC EVENTS LTD", style: "valueBold" },
    { text: "7 Sunbury Avenue, BT5 5NU, Belfast, United Kingdom", style: "muted" },
    { text: "Tax Number (UTR): 5162714962", style: "muted" },
    { text: "Company Number: NI733018", style: "muted" },
    { text: "NI VAT Reg: 501238341", style: "muted" },
    { text: "ROI VAT Reg: 4484484RH", style: "muted", margin: [0, 0, 0, 8] },
    { text: "Bank Details", style: "h2" },
    { text: "IBAN: GB21 REVO 0099 6938 9156 94", style: "muted" },
    { text: "BIC: REVOGB21", style: "muted" },
    { text: "Revolut Ltd (Bank Provider Address)", style: "muted" },
    { text: "30 South Colonnade, E14 5HX, London, United Kingdom", style: "muted", margin: [0, 0, 0, 8] },
    { text: "Registered Office", style: "h2" },
    { text: "7 Sunbury Avenue, Belfast, Northern Ireland, BT5 5NU, United Kingdom", style: "muted" },
  ],
  margin: [0, 8, 0, 0],
});

const buildFxBlock = (
  totals: { net: number; vat: number; gross: number },
  rate: number,
  fetchedAt: string,
  currency: "EUR" | "GBP"
): Content => {
  const isGbp = currency === "GBP";
  const label = isGbp ? "FX Conversion (GBP→EUR)" : "FX Conversion (EUR→GBP)";
  const convert = (value: number) => (isGbp ? (rate > 0 ? value / rate : value) : value * rate);
  const currencyLabel = isGbp ? "EUR" : "GBP";
  const formatConverted = isGbp ? formatCurrencyEur : formatCurrencyGbp;

  return {
    table: {
      widths: ["*", "auto"],
      body: [
        [
          { text: label, style: "label" },
          {
            text: `Rate: ${rate.toFixed(4)} • ${new Date(fetchedAt).toLocaleString()}`,
            style: "muted",
            alignment: "right",
          },
        ],
        [
          { text: `Subtotal (${currencyLabel})`, style: "label" },
          { text: formatConverted(convert(totals.net)), style: "valueRight" },
        ],
        [
          { text: `VAT (${currencyLabel})`, style: "label" },
          { text: formatConverted(convert(totals.vat)), style: "valueRight" },
        ],
        [
          { text: `Total (${currencyLabel})`, style: "label" },
          { text: formatConverted(convert(totals.gross)), style: "total" },
        ],
      ],
    },
    layout: "lightHorizontalLines",
    margin: [0, 8, 0, 0],
  };
};

const buildTotalsBlock = (
  totals: { net: number; vat: number; gross: number },
  vatEnabled: boolean,
  labels: { subtotal: string; total: string } = { subtotal: "Subtotal", total: "Total" },
  currency: "EUR" | "GBP" = "EUR"
): Content => ({
  table: {
    widths: ["*", "auto"],
    body: [
      [
        { text: labels.subtotal, style: "label" },
        { text: formatCurrency(totals.net, currency), style: "valueRight" },
      ],
      vatEnabled
        ? [
            { text: "VAT", style: "label" },
            { text: formatCurrency(totals.vat, currency), style: "valueRight" },
          ]
        : null,
      [
        { text: labels.total, style: "label" },
        { text: formatCurrency(totals.gross, currency), style: "total" },
      ],
    ].filter(Boolean) as any[],
  },
  layout: "lightHorizontalLines",
  margin: [0, 8, 0, 0],
});

const buildLinesTable = (lines: InvoiceLine[], currency: "EUR" | "GBP"): Content => {
  const hasVisibleAmounts = lines.some((line) => line.showAmount !== false);
  const headerRow = [{ text: "Description", style: "tableHeader" }];
  if (hasVisibleAmounts) {
    headerRow.push({ text: `Amount (${currency})`, style: "tableHeader", alignment: "right" });
  }

  const body = [
    headerRow,
    ...lines.map((line) => {
      const row: any[] = [{ text: line.description, style: "value" }];
      if (hasVisibleAmounts) {
        row.push({
          text: line.showAmount === false ? "" : formatCurrency(line.amount, currency),
          alignment: "right",
          style: "valueBold",
        });
      }
      return row;
    }),
  ];

  return {
    table: {
      headerRows: 1,
      widths: hasVisibleAmounts ? ["*", "auto"] : ["*"],
      body,
    },
    layout: hasVisibleAmounts
      ? "lightHorizontalLines"
      : {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          hLineColor: () => "transparent",
          vLineColor: () => "transparent",
        },
  };
};

const buildCostingSection = (
  costing?: CostingData,
  booking?: Booking,
  fxRate?: number,
  currency: "EUR" | "GBP" = "EUR"
): Content => {
  if (!costing) {
    return { text: "No costing data. Use the costing tab on the quote to add beverage and overhead details.", style: "muted" };
  }

  const beerTotals = getDrinkTotals(costing.beers);
  const cocktailTotals = getDrinkTotals(costing.cocktails);
  const wineTotals = getDrinkTotals(flattenWines(costing.wines));
  const { customLines, otherExtras } = partitionExtras(costing.extras);
  const classExtras = otherExtras.filter((item) => item.source === "quoteDerivedClass");
  const brunchExtras = otherExtras.filter((item) => item.source === "quoteDerivedBrunch");
  const guestFeeExtras = otherExtras.filter((item) => item.source === "quoteDerivedGuestFee");
  const remainingExtras = otherExtras.filter(
    (item) =>
      item.source !== "quoteDerivedClass" &&
      item.source !== "quoteDerivedBrunch" &&
      item.source !== "quoteDerivedGuestFee",
  );
  const customLineTotals = getDrinkTotals(customLines);
  const classExtraTotals = getDrinkTotals(classExtras);
  const brunchExtraTotals = getDrinkTotals(brunchExtras);
  const guestFeeTotals = getDrinkTotals(guestFeeExtras);
  const remainingExtraTotals = getDrinkTotals(remainingExtras);

  const categoryRows: Array<[string, string, number, number]> = [
    ["Beers", summarizeDrinks(costing.beers), beerTotals.cost, beerTotals.revenue],
    ["Cocktails", summarizeDrinks(costing.cocktails), cocktailTotals.cost, cocktailTotals.revenue],
    ["Wine", summarizeDrinks(flattenWines(costing.wines)), wineTotals.cost, wineTotals.revenue],
  ];

  const addCategory = (label: string, items: DrinkBreakdownItem[], totals: { cost: number; revenue: number }) => {
    if (items.length === 0 && totals.cost === 0 && totals.revenue === 0) return;
    categoryRows.push([label, summarizeDrinks(items), totals.cost, totals.revenue]);
  };

  addCategory("Custom items", customLines, customLineTotals);
  addCategory("Cocktail Making Class", classExtras, classExtraTotals);
  addCategory("Boozy Brunch", brunchExtras, brunchExtraTotals);
  addCategory("Custom Package", guestFeeExtras, guestFeeTotals);
  addCategory("Extras", remainingExtras, remainingExtraTotals);

  const overheadRows: Array<[string, number]> = [
    ["Staff wages", costing.overheads.staffWages],
    ["Staff travel", costing.overheads.staffTravel],
    ["Petrol", costing.overheads.petrol],
  ];

  const marginPct = (revenue: number, cost: number) => (revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0);
  const profitAlt = fxRate
    ? currency === "GBP"
      ? fxRate > 0
        ? costing.totals.profit / fxRate
        : null
      : costing.totals.profit * fxRate
    : null;
  const netAfterVat = costing.totals.profit - costing.totals.vatAmount;
  const netAfterVatAlt = fxRate
    ? currency === "GBP"
      ? fxRate > 0
        ? netAfterVat / fxRate
        : null
      : netAfterVat * fxRate
    : null;

  return {
    stack: [
      { text: "Profit & Costing", style: "h2" },
      {
        table: {
          headerRows: 1,
          widths: ["*", "*", "auto", "auto", "auto", "auto"],
          body: [
            [
              { text: "Category", style: "tableHeader" },
              { text: "Selection", style: "tableHeader" },
              { text: "Internal", style: "tableHeader", alignment: "right" },
              { text: "Customer", style: "tableHeader", alignment: "right" },
              { text: "Profit", style: "tableHeader", alignment: "right" },
              { text: "Margin %", style: "tableHeader", alignment: "right" },
            ],
            ...categoryRows.map(([name, selection, cost, revenue]) => [
              { text: name, style: "value" },
              { text: selection, style: "muted" },
              { text: formatCurrency(cost, currency), alignment: "right", style: "value" },
              { text: formatCurrency(revenue, currency), alignment: "right", style: "valueBold" },
              { text: formatCurrency(revenue - cost, currency), alignment: "right", style: "valueBold" },
              { text: `${marginPct(revenue, cost).toFixed(1)}%`, alignment: "right", style: "muted" },
            ]),
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 8, 0, 12],
      },
      buildTotalsBlock(
        { net: costing.totals.internalCost, vat: costing.totals.vatAmount, gross: costing.totals.customerTotal },
        costing.overheads.vatRate > 0,
        { subtotal: "Internal Cost", total: "Customer Total (ex VAT)" },
        currency
      ),
      {
        text: `Profit: ${formatCurrency(costing.totals.profit, currency)}${
          profitAlt
            ? ` / ${currency === "GBP" ? formatCurrencyEur(profitAlt) : formatCurrencyGbp(profitAlt)}`
            : ""
        } (${costing.totals.marginPct.toFixed(1)}%) • VAT @ ${costing.overheads.vatRate}%: ${formatCurrency(
          costing.totals.vatAmount,
          currency
        )}`,
        style: "muted",
        margin: [0, 6, 0, 8],
      },
      {
        text: `Profit after remitting VAT: ${formatCurrency(netAfterVat, currency)}${
          netAfterVatAlt
            ? ` / ${currency === "GBP" ? formatCurrencyEur(netAfterVatAlt) : formatCurrencyGbp(netAfterVatAlt)}`
            : ""
        }`,
        style: "muted",
        margin: [0, 0, 0, 8],
      },
      {
        table: {
          widths: ["*", "auto"],
          body: [
            [{ text: "Overheads", style: "tableHeader", colSpan: 2, alignment: "left" }, {}],
            ...overheadRows.map(([label, value]) => [
              { text: label, style: "value" },
              { text: formatCurrency(value, currency), alignment: "right", style: "value" },
            ]),
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 8],
      },
      {
        columns: [
          {
            stack: [
              { text: "Assumptions", style: "h2" },
              { text: `Bottle cost €${costing.wines.bottleCost.toFixed(2)}`, style: "muted" },
              { text: `${costing.wines.glassesPerBottle} glasses per bottle`, style: "muted" },
            ],
          },
          booking
            ? {
                stack: [
                  { text: "Booking / Payments", style: "h2" },
                  { text: `Status: ${booking.status}`, style: "value" },
                  { text: `Payment: ${booking.paymentStatus}`, style: "value" },
                  booking.depositPaid
                    ? { text: `Deposit received: ${formatCurrency(booking.depositPaid, currency)}`, style: "muted" }
                    : { text: "Deposit not recorded", style: "muted" },
                ],
              }
            : { text: "" },
        ],
        columnGap: 16,
      },
    ],
    margin: [0, 12, 0, 0],
  };
};

const buildTravelSection = (travel?: OwnerTravelSummary, currency: "EUR" | "GBP" = "EUR"): Content | null => {
  if (!travel) return null;
  return {
    stack: [
      { text: "Travel Summary", style: "h2" },
      {
        table: {
          widths: ["*", "*"],
          body: [
            [
              { text: "Origin", style: "label" },
              { text: travel.origin, style: "value" },
            ],
            [
              { text: "Destination", style: "label" },
              { text: travel.destination, style: "value" },
            ],
            [
              { text: "Provider", style: "label" },
              { text: `${travel.provider} • Fuel €${travel.fuelPricePerLitre.toFixed(2)}/L`, style: "muted" },
            ],
            [
              { text: "Round trip", style: "label" },
              { text: `${travel.distance.miles.toFixed(1)} mi • ${(travel.distance.durationMinutes / 60).toFixed(1)} hrs`, style: "value" },
            ],
            [
              { text: "Petrol est.", style: "label" },
              { text: travel.petrolCost !== null ? formatCurrency(travel.petrolCost, currency) : "—", style: "value" },
            ],
          ],
        },
        layout: "lightHorizontalLines",
      },
    ],
    margin: [0, 12, 0, 0],
  };
};

const buildStyles = (): StyleDictionary => ({
  h1: { fontSize: 18, bold: true, color: "#0B152E" },
  h2: { fontSize: 14, bold: true, color: "#0B152E", margin: [0, 8, 0, 4] },
  label: { fontSize: 9, color: "#666" },
  value: { fontSize: 11, color: "#1f1f1f" },
  valueBold: { fontSize: 11, color: "#1f1f1f", bold: true },
  valueRight: { fontSize: 11, color: "#1f1f1f", alignment: "right" },
  muted: { fontSize: 9, color: "#777" },
  tableHeader: { bold: true, fontSize: 10, fillColor: "#0c163a", color: "#fff" },
  total: { bold: true, fontSize: 14, alignment: "right", color: "#0b152e" },
  badge: { fontSize: 12, bold: true, color: "#0c163a" },
});

const getVariantConfig = (variant: QuotePdfVariant) => {
  if (variant === "customer") {
    return {
      title: "Customer Quote",
      subtitle: "Tailored experience for your event",
      note: "",
      filterInternal: true,
      filenameSuffix: "Customer",
    };
  }

  return {
    title: "Owner Quote",
    subtitle: "Full operational view",
    note: "Owner copy includes staffing, travel, and profitability details.",
    filterInternal: false,
    filenameSuffix: "Owner",
  };
};

const getCostingForQuote = (_quote: Quote) => undefined;
const getBookingForQuote = (_quote: Quote) => undefined as Booking | undefined;

const buildQuoteDocDefinition = async ({
  quote,
  settings,
  variant,
  ownerContext,
}: {
  quote: Quote;
  settings: Settings;
  variant: QuotePdfVariant;
  ownerContext?: { travel?: OwnerTravelSummary };
}): Promise<{ doc: TDocumentDefinitions; filename: string }> => {
  const logoDataUrl = await fetchLogoDataUrl();
  const config = getVariantConfig(variant);
  const costing = getCostingForQuote(quote);
  const invoice = calculateInvoiceTotals(quote, {
    includeInternal: variant === "owner",
    costing,
  });
  const lines = buildInvoiceLines(quote, { includeInternal: variant === "owner", costing });
  const totals = invoice.totals;
  const booking = variant === "owner" ? getBookingForQuote(quote) : undefined;
  const currency = quote.currency ?? "EUR";
  const fx = await getEurToGbpRate();
  const fxRateToUse = quote.fxRate ?? settings.currency.gbpRate ?? fx.rate;
  const fxFetchedAt = quote.fxRate ? new Date().toISOString() : fx.fetchedAt;

  const content: Content[] = [
    buildHeader(settings, config.title, `${config.subtitle} • ${new Date().toLocaleDateString()}`, logoDataUrl),
    buildEventDetails(quote),
    buildLinesTable(lines, currency),
    buildTotalsBlock(totals, quote.vat.enabled, { subtotal: "Subtotal", total: "Total" }, currency),
    currency === "EUR" ? buildFxBlock(totals, fxRateToUse, fxFetchedAt, currency) : null,
    config.note ? { text: config.note, style: "muted", margin: [0, 8, 0, 0] } : null,
  ];

  if (variant === "owner") {
    content.push(buildCostingSection(costing, booking, fxRateToUse, currency));
    const travelBlock = buildTravelSection(ownerContext?.travel, currency);
    if (travelBlock) content.push(travelBlock);
  } else {
    content.push(buildCompanyInfo());
  }

  const doc: TDocumentDefinitions = {
    content: content.filter(Boolean) as Content[],
    styles: buildStyles(),
    defaultStyle: { fontSize: 10 },
    footer: (currentPage, pageCount) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: "right",
      margin: [0, 8, 24, 0],
      style: "muted",
    }),
  };

  const safeCustomerName = quote.customer.name?.trim().replace(/\s+/g, "-") || "customer";
  const safeDate = quote.event.date || new Date().toISOString().slice(0, 10);
  const filename = `BB-Quote-${safeCustomerName}-${safeDate}-${config.filenameSuffix}.pdf`;

  return { doc, filename };
};

const downloadPdf = (doc: TDocumentDefinitions, filename: string) => {
  pdfMake.createPdf(doc).download(filename);
};

const getPdfBlob = (doc: TDocumentDefinitions): Promise<Blob> =>
  new Promise((resolve, reject) => {
    pdfMake.createPdf(doc).getBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to create PDF blob"));
    });
  });

export const generateQuotePdf = async (args: {
  quote: Quote;
  settings: Settings;
  variant: QuotePdfVariant;
  ownerContext?: { travel?: OwnerTravelSummary };
}) => {
  const { doc, filename } = await buildQuoteDocDefinition(args);
  downloadPdf(doc, filename);
};

export const generateCustomerQuotePdf = ({ quote, settings }: { quote: Quote; settings: Settings }) =>
  generateQuotePdf({ quote, settings, variant: "customer" });

export const generateOwnerQuotePdf = ({
  quote,
  settings,
  travel,
}: {
  quote: Quote;
  settings: Settings;
  travel?: OwnerTravelSummary;
}) => generateQuotePdf({ quote, settings, variant: "owner", ownerContext: { travel } });

export const generateCustomerQuotePdfBlob = async ({
  quote,
  settings,
}: {
  quote: Quote;
  settings: Settings;
}): Promise<{ blob: Blob; filename: string }> => {
  const { doc, filename } = await buildQuoteDocDefinition({ quote, settings, variant: "customer" });
  const blob = await getPdfBlob(doc);
  return { blob, filename };
};

const buildCostingDocDefinition = async ({
  quote,
  costing,
  settings,
}: {
  quote: Quote;
  costing: CostingData;
  settings: Settings;
}): Promise<{ doc: TDocumentDefinitions; filename: string }> => {
  const logoDataUrl = await fetchLogoDataUrl();
  const fx = await getEurToGbpRate();
  const currency = quote.currency ?? "EUR";
  const fxRateToUse = quote.fxRate ?? settings.currency.gbpRate ?? fx.rate;
  const fxFetchedAt = quote.fxRate ? new Date().toISOString() : fx.fetchedAt;
  const beerTotals = getDrinkTotals(costing.beers);
  const cocktailTotals = getDrinkTotals(costing.cocktails);
  const redTotals = getDrinkTotals(costing.wines.red);
  const whiteTotals = getDrinkTotals(costing.wines.white);
  const { customLines, otherExtras } = partitionExtras(costing.extras);
  const classExtras = otherExtras.filter((item) => item.source === "quoteDerivedClass");
  const brunchExtras = otherExtras.filter((item) => item.source === "quoteDerivedBrunch");
  const guestFeeExtras = otherExtras.filter((item) => item.source === "quoteDerivedGuestFee");
  const remainingExtras = otherExtras.filter(
    (item) =>
      item.source !== "quoteDerivedClass" &&
      item.source !== "quoteDerivedBrunch" &&
      item.source !== "quoteDerivedGuestFee",
  );
  const netAfterVat = costing.totals.profit - costing.totals.vatAmount;
  const overheadRows = ([
    ["Staff wages", "Labour hours", costing.overheads.staffWages, 0],
    ["Staff travel", "Travel time", costing.overheads.staffTravel, 0],
    ["Petrol", "Fuel", costing.overheads.petrol, 0],
  ] as Array<[string, string, number, number]>).filter(
    (row): row is [string, string, number, number] => row[2] > 0,
  );
  const hasValue = (cost: number, revenue: number) => Math.abs(cost) > 0 || Math.abs(revenue) > 0;
  const rows: any[] = [];
  const addRow = (label: string, selection: string, cost: number, revenue: number) => {
    if (!hasValue(cost, revenue)) return;
    rows.push([
      label,
      selection,
      formatCurrencyPair(cost, currency, fxRateToUse),
      formatCurrencyPair(revenue, currency, fxRateToUse),
      formatCurrencyPair(revenue - cost, currency, fxRateToUse),
    ]);
  };

  addRow("Bottle Beers", summarizeDrinks(costing.beers), beerTotals.cost, beerTotals.revenue);
  addRow("Cocktails", summarizeDrinks(costing.cocktails), cocktailTotals.cost, cocktailTotals.revenue);
  addRow("Red wine (glasses)", summarizeDrinks(costing.wines.red), redTotals.cost, redTotals.revenue);
  addRow("White wine (glasses)", summarizeDrinks(costing.wines.white), whiteTotals.cost, whiteTotals.revenue);

  customLines.forEach((item) => {
    const cost = item.qty * item.cost;
    const revenue = item.qty * item.customerPrice;
    addRow("Custom item", item.name || "Custom item", cost, revenue);
  });

  classExtras.forEach((item) => {
    const cost = item.qty * item.cost;
    const revenue = item.qty * item.customerPrice;
    addRow("Cocktail Making Class", item.name || "Cocktail Making Class", cost, revenue);
  });

  brunchExtras.forEach((item) => {
    const cost = item.qty * item.cost;
    const revenue = item.qty * item.customerPrice;
    addRow("Boozy Brunch", item.name || "Boozy Brunch", cost, revenue);
  });

  guestFeeExtras.forEach((item) => {
    const cost = item.qty * item.cost;
    const revenue = item.qty * item.customerPrice;
    addRow("Custom Package", item.name || "Custom Package", cost, revenue);
  });

  if (remainingExtras.length) {
    const otherExtraTotals = getDrinkTotals(remainingExtras);
    addRow("Extras", summarizeDrinks(remainingExtras), otherExtraTotals.cost, otherExtraTotals.revenue);
  }

  overheadRows.forEach(([label, selection, cost, revenue]) => addRow(label, selection, cost, revenue));

  const content: Content[] = [
    buildHeader(settings, "Internal Costing", `Margin snapshot • ${new Date().toLocaleString()}`, logoDataUrl),
    buildEventDetails(quote),
    {
      table: {
        headerRows: 1,
        widths: ["*", "*", "auto", "auto", "auto"],
        body: [
          [
            { text: "Category", style: "tableHeader" },
            { text: "Selection", style: "tableHeader" },
            { text: "Internal (€ / £)", style: "tableHeader", alignment: "right" },
            { text: "Customer (€ / £)", style: "tableHeader", alignment: "right" },
            { text: "Profit (€ / £)", style: "tableHeader", alignment: "right" },
          ],
          ...rows,
        ],
      },
      layout: "lightHorizontalLines",
      margin: [0, 8, 0, 8],
    },
    buildTotalsBlock(
      {
        net: costing.totals.internalCost,
        vat: 0,
        gross: costing.totals.customerTotal,
      },
      false,
      { subtotal: "Internal Cost", total: "Customer Total" },
      currency
    ),
    currency === "EUR"
      ? buildFxBlock(
          {
            net: costing.totals.internalCost,
            vat: 0,
            gross: costing.totals.customerTotal,
          },
          fxRateToUse,
          fxFetchedAt,
          currency
        )
      : null,
    {
      text: `Projected Profit: ${formatCurrency(costing.totals.profit, currency)}${
        fxRateToUse
          ? ` / ${
              currency === "GBP"
                ? formatCurrencyEur(
                    fxRateToUse > 0 ? costing.totals.profit / fxRateToUse : costing.totals.profit
                  )
                : formatCurrencyGbp(costing.totals.profit * fxRateToUse)
            }`
          : ""
      } (${costing.totals.marginPct.toFixed(1)}%) • VAT @ ${costing.overheads.vatRate}%: ${formatCurrency(
        costing.totals.vatAmount,
        currency
      )}`,
      style: "muted",
      margin: [0, 8, 0, 0],
    },
    {
      text: `Profit after remitting VAT: ${formatCurrency(netAfterVat, currency)}${
        fxRateToUse
          ? ` / ${
              currency === "GBP"
                ? formatCurrencyEur(fxRateToUse > 0 ? netAfterVat / fxRateToUse : netAfterVat)
                : formatCurrencyGbp(netAfterVat * fxRateToUse)
            }`
          : ""
      }`,
      style: "muted",
      margin: [0, 0, 0, 0],
    },
  ];

  const doc: TDocumentDefinitions = {
    content,
    styles: buildStyles(),
    defaultStyle: { fontSize: 10 },
  };
  const filename = `BB-Costing-${quote.customer.name || quote.id}.pdf`;
  return { doc, filename };
};

export const generateCostingPdf = async ({
  quote,
  costing,
  settings,
}: {
  quote: Quote;
  costing: CostingData;
  settings: Settings;
}) => {
  const { doc, filename } = await buildCostingDocDefinition({ quote, costing, settings });
  downloadPdf(doc, filename);
};

export const generateCostingPdfBlob = async ({
  quote,
  costing,
  settings,
}: {
  quote: Quote;
  costing: CostingData;
  settings: Settings;
}): Promise<{ blob: Blob; filename: string }> => {
  const { doc, filename } = await buildCostingDocDefinition({ quote, costing, settings });
  const blob = await getPdfBlob(doc);
  return { blob, filename };
};
