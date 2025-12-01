import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import logo from "@/assets/logo.png";
import { Quote, Settings, CostingData, DrinkBreakdownItem, Booking } from "@/types";
import { getBookings, getCostingByQuoteId } from "./storage";
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

const formatCurrency = (value: number) => `€${value.toFixed(2)}`;
const formatCurrencyGbp = (value: number) => `£${value.toFixed(2)}`;

const summarizeDrinks = (items: DrinkBreakdownItem[]) => {
  const nonZero = items.filter((item) => item.qty > 0);
  return nonZero.length > 0 ? nonZero.map((item) => `${item.qty} ${item.name}`).join(", ") : "—";
};

const getDrinkTotals = (items: DrinkBreakdownItem[]) => {
  const cost = items.reduce((sum, item) => sum + item.qty * item.cost, 0);
  const revenue = items.reduce((sum, item) => sum + item.qty * item.customerPrice, 0);
  return { cost, revenue };
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

const buildFxBlock = (totals: { net: number; vat: number; gross: number }, rate: number, fetchedAt: string): Content => ({
  table: {
    widths: ["*", "auto"],
    body: [
      [
        { text: "FX Conversion (EUR→GBP)", style: "label" },
        { text: `Rate: ${rate.toFixed(4)} • ${new Date(fetchedAt).toLocaleString()}`, style: "muted", alignment: "right" },
      ],
      [
        { text: "Subtotal (GBP)", style: "label" },
        { text: formatCurrencyGbp(totals.net * rate), style: "valueRight" },
      ],
      [
        { text: "VAT (GBP)", style: "label" },
        { text: formatCurrencyGbp(totals.vat * rate), style: "valueRight" },
      ],
      [
        { text: "Total (GBP)", style: "label" },
        { text: formatCurrencyGbp(totals.gross * rate), style: "total" },
      ],
    ],
  },
  layout: "lightHorizontalLines",
  margin: [0, 8, 0, 0],
});

const buildTotalsBlock = (
  totals: { net: number; vat: number; gross: number },
  vatEnabled: boolean,
  labels: { subtotal: string; total: string } = { subtotal: "Subtotal", total: "Total" }
): Content => ({
  table: {
    widths: ["*", "auto"],
    body: [
      [
        { text: labels.subtotal, style: "label" },
        { text: formatCurrency(totals.net), style: "valueRight" },
      ],
      vatEnabled
        ? [
            { text: "VAT", style: "label" },
            { text: formatCurrency(totals.vat), style: "valueRight" },
          ]
        : null,
      [
        { text: labels.total, style: "label" },
        { text: formatCurrency(totals.gross), style: "total" },
      ],
    ].filter(Boolean) as any[],
  },
  layout: "lightHorizontalLines",
  margin: [0, 8, 0, 0],
});

const buildLinesTable = (lines: InvoiceLine[]): Content => {
  const hasVisibleAmounts = lines.some((line) => line.showAmount !== false);
  const headerRow = [{ text: "Description", style: "tableHeader" }];
  if (hasVisibleAmounts) {
    headerRow.push({ text: "Amount (€)", style: "tableHeader", alignment: "right" });
  }

  const body = [
    headerRow,
    ...lines.map((line) => {
      const row: any[] = [{ text: line.description, style: "value" }];
      if (hasVisibleAmounts) {
        row.push({
          text: line.showAmount === false ? "" : formatCurrency(line.amount),
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

const buildCostingSection = (costing?: CostingData, booking?: Booking, fxRate?: number): Content => {
  if (!costing) {
    return { text: "No costing data. Use the costing tab on the quote to add beverage and overhead details.", style: "muted" };
  }

  const beerTotals = getDrinkTotals(costing.beers);
  const cocktailTotals = getDrinkTotals(costing.cocktails);
  const wineTotals = getDrinkTotals(flattenWines(costing.wines));
  const { customLines, otherExtras } = partitionExtras(costing.extras);
  const customLineTotals = getDrinkTotals(customLines);
  const otherExtraTotals = getDrinkTotals(otherExtras);

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
  addCategory("Extras", otherExtras, otherExtraTotals);

  const overheadRows: Array<[string, number]> = [
    ["Staff wages", costing.overheads.staffWages],
    ["Staff travel", costing.overheads.staffTravel],
    ["Petrol", costing.overheads.petrol],
  ];

  const marginPct = (revenue: number, cost: number) => (revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0);
  const profitGbp = fxRate ? costing.totals.profit * fxRate : null;
  const netAfterVat = costing.totals.profit - costing.totals.vatAmount;
  const netAfterVatGbp = fxRate ? netAfterVat * fxRate : null;

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
              { text: formatCurrency(cost), alignment: "right", style: "value" },
              { text: formatCurrency(revenue), alignment: "right", style: "valueBold" },
              { text: formatCurrency(revenue - cost), alignment: "right", style: "valueBold" },
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
        { subtotal: "Internal Cost", total: "Customer Total (ex VAT)" }
      ),
      {
        text: `Profit: ${formatCurrency(costing.totals.profit)}${
          profitGbp ? ` / ${formatCurrencyGbp(profitGbp)}` : ""
        } (${costing.totals.marginPct.toFixed(1)}%) • VAT @ ${costing.overheads.vatRate}%: ${formatCurrency(
          costing.totals.vatAmount
        )}`,
        style: "muted",
        margin: [0, 6, 0, 8],
      },
      {
        text: `Profit after remitting VAT: ${formatCurrency(netAfterVat)}${
          netAfterVatGbp ? ` / ${formatCurrencyGbp(netAfterVatGbp)}` : ""
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
              { text: formatCurrency(value), alignment: "right", style: "value" },
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
                    ? { text: `Deposit received: ${formatCurrency(booking.depositPaid)}`, style: "muted" }
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

const buildTravelSection = (travel?: OwnerTravelSummary): Content | null => {
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
              { text: travel.petrolCost !== null ? formatCurrency(travel.petrolCost) : "—", style: "value" },
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

const getCostingForQuote = (quote: Quote) => (quote.id ? getCostingByQuoteId(quote.id) : undefined);
const getBookingForQuote = (quote: Quote) => getBookings().find((b) => b.quoteId === quote.id);

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
  const fx = await getEurToGbpRate();

  const content: Content[] = [
    buildHeader(settings, config.title, `${config.subtitle} • ${new Date().toLocaleDateString()}`, logoDataUrl),
    buildEventDetails(quote),
    buildLinesTable(lines),
    buildTotalsBlock(totals, quote.vat.enabled),
    buildFxBlock(totals, fx.rate, fx.fetchedAt),
    config.note ? { text: config.note, style: "muted", margin: [0, 8, 0, 0] } : null,
  ];

  if (variant === "owner") {
    content.push(buildCostingSection(costing, booking, fx.rate));
    const travelBlock = buildTravelSection(ownerContext?.travel);
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
  const beerTotals = getDrinkTotals(costing.beers);
  const cocktailTotals = getDrinkTotals(costing.cocktails);
  const redTotals = getDrinkTotals(costing.wines.red);
  const whiteTotals = getDrinkTotals(costing.wines.white);
  const { customLines, otherExtras } = partitionExtras(costing.extras);
  const customLineTotals = getDrinkTotals(customLines);
  const otherExtraTotals = getDrinkTotals(otherExtras);
  const netAfterVat = costing.totals.profit - costing.totals.vatAmount;
  const overheadRows: Array<[string, string, number, number]> = [
    ["Staff wages", "Labour hours", costing.overheads.staffWages, 0],
    ["Staff travel", "Travel time", costing.overheads.staffTravel, 0],
    ["Petrol", "Fuel", costing.overheads.petrol, 0],
  ].filter(([, , cost]) => cost > 0);

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
            { text: "Internal (€)", style: "tableHeader", alignment: "right" },
            { text: "Customer (€)", style: "tableHeader", alignment: "right" },
            { text: "Profit (€)", style: "tableHeader", alignment: "right" },
          ],
          [
            "Bottle Beers",
            summarizeDrinks(costing.beers),
            formatCurrency(beerTotals.cost),
            formatCurrency(beerTotals.revenue),
            formatCurrency(beerTotals.revenue - beerTotals.cost),
          ],
          [
            "Cocktails",
            summarizeDrinks(costing.cocktails),
            formatCurrency(cocktailTotals.cost),
            formatCurrency(cocktailTotals.revenue),
            formatCurrency(cocktailTotals.revenue - cocktailTotals.cost),
          ],
          [
            "Red wine (glasses)",
            summarizeDrinks(costing.wines.red),
            formatCurrency(redTotals.cost),
            formatCurrency(redTotals.revenue),
            formatCurrency(redTotals.revenue - redTotals.cost),
          ],
          [
            "White wine (glasses)",
            summarizeDrinks(costing.wines.white),
            formatCurrency(whiteTotals.cost),
            formatCurrency(whiteTotals.revenue),
            formatCurrency(whiteTotals.revenue - whiteTotals.cost),
          ],
          ...(customLines.length
            ? [
                [
                  "Custom items",
                  summarizeDrinks(customLines),
                  formatCurrency(customLineTotals.cost),
                  formatCurrency(customLineTotals.revenue),
                  formatCurrency(customLineTotals.revenue - customLineTotals.cost),
                ],
              ]
            : []),
          ...(otherExtras.length
            ? [
                [
                  "Extras",
                  summarizeDrinks(otherExtras),
                  formatCurrency(otherExtraTotals.cost),
                  formatCurrency(otherExtraTotals.revenue),
                  formatCurrency(otherExtraTotals.revenue - otherExtraTotals.cost),
                ],
              ]
            : []),
          ...overheadRows.map(([label, selection, cost, revenue]) => [
            label,
            selection,
            formatCurrency(cost),
            formatCurrency(revenue),
            formatCurrency(revenue - cost),
          ]),
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
      { subtotal: "Internal Cost", total: "Customer Total" }
    ),
    buildFxBlock(
      {
        net: costing.totals.internalCost,
        vat: 0,
        gross: costing.totals.customerTotal,
      },
      fx.rate,
      fx.fetchedAt
    ),
    {
      text: `Projected Profit: ${formatCurrency(costing.totals.profit)}${fx.rate ? ` / ${formatCurrencyGbp(
        costing.totals.profit * fx.rate
      )}` : ""} (${costing.totals.marginPct.toFixed(1)}%) • VAT @ ${costing.overheads.vatRate}%: ${formatCurrency(
        costing.totals.vatAmount
      )}`,
      style: "muted",
      margin: [0, 8, 0, 0],
    },
    {
      text: `Profit after remitting VAT: ${formatCurrency(netAfterVat)}${
        fx.rate ? ` / ${formatCurrencyGbp(netAfterVat * fx.rate)}` : ""
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
