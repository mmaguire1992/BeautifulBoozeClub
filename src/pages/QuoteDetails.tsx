import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { ArrowLeft, FileDown, Pencil, Trash2, Calculator, Mail } from "lucide-react";
import {
  getQuotes,
  saveQuotes,
  getSettings,
  getCostingData,
  saveCostingData,
  getCostingByQuoteId,
  upsertBookingFromQuote,
} from "@/lib/storage";
import { CostingData, Quote } from "@/types";
import { generateCustomerQuotePdfBlob, generateCostingPdfBlob } from "@/lib/pdf";
import { openGoogleCalendarEvent } from "@/lib/calendar";
import { toast } from "sonner";
import CostingWorkspace from "@/components/CostingWorkspace";
import { calculateInvoiceTotals } from "@/lib/invoice";

const formatCurrency = (value: number) => `€${value.toFixed(2)}`;

export default function QuoteDetails() {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const quote: Quote | undefined = getQuotes().find((q) => q.id === quoteId);
  const [tab, setTab] = useState<"quote" | "costing">("quote");
  const [costing, setCosting] = useState<CostingData | null>(() =>
    quote ? getCostingByQuoteId(quote.id) ?? null : null
  );
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  const invoice = useMemo(
    () => (quote ? calculateInvoiceTotals(quote, { includeInternal: false, costing: costing ?? undefined }) : null),
    [quote, costing]
  );
  const totals = invoice?.totals ?? quote?.totals;

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCustomerInvoice = async () => {
    if (!quote) return;
    try {
      const { blob, filename } = await generateCustomerQuotePdfBlob({ quote, settings: getSettings() });
      downloadBlob(blob, filename);
    } catch (error) {
      console.error(error);
      toast.error("Unable to generate customer invoice.");
    }
  };

  const handleCostingInvoice = async () => {
    if (!quote) return;
    const costingToUse = costing || getCostingByQuoteId(quote.id);
    if (!costingToUse) {
      toast.error("Add costing details first.");
      return;
    }
    try {
      const { blob, filename } = await generateCostingPdfBlob({ quote, costing: costingToUse, settings: getSettings() });
      downloadBlob(blob, filename);
    } catch (error) {
      console.error(error);
      toast.error("Unable to generate costing invoice.");
    }
  };

  const openGmailDraft = (options: { to?: string; subject: string; body: string }) => {
    const { to = "", subject, body } = options;
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSendInvoiceEmail = async () => {
    if (!quote) return;
    try {
      const settings = getSettings();
      const { blob, filename } = await generateCustomerQuotePdfBlob({ quote, settings });
      downloadBlob(blob, filename); // ensure the PDF is available locally to attach

      const customerName = quote.customer.name?.trim() || "there";
      const businessName = settings.business.name || "The Beautiful Booze Club";
      const subject = `Invoice for ${quote.event.type || "your event"} - ${businessName}`;
      const bodyLines = [
        `Hi ${customerName},`,
        "",
        `Thanks for choosing ${businessName}. Please find your invoice attached for ${quote.event.type || "your event"}${quote.event.date ? ` on ${quote.event.date}` : ""}.`,
        "",
        "If anything looks off, reply to this email and I'll fix it right away.",
        "",
        `Thanks,\n${businessName}`,
      ];

      openGmailDraft({
        to: quote.customer.email,
        subject,
        body: bodyLines.join("\n"),
      });

      toast.success("Invoice downloaded. Gmail draft opened—attach the PDF and hit send.");
    } catch (error) {
      console.error(error);
      toast.error("Unable to prepare the invoice email.");
    }
  };

  const handleDelete = () => {
    if (!quote) return;
    if (!confirm("Delete this quote and its costing? This cannot be undone.")) return;
    const updated = getQuotes().filter((q) => q.id !== quote.id);
    saveQuotes(updated);
    saveCostingData(getCostingData().filter((c) => c.quoteId !== quote.id));
    toast.success("Quote deleted");
    navigate("/quotes");
  };

  const updateStatus = (status: Quote["status"], options?: { skipRefresh?: boolean }) => {
    if (!quote) return;
    const all = getQuotes();
    const idx = all.findIndex((q) => q.id === quote.id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], status, updatedAt: new Date().toISOString() };
    saveQuotes(all);
    toast.success(`Quote marked ${status}`);
    if (!options?.skipRefresh) {
      navigate(0);
    }
  };

  const handleAccept = () => {
    if (!quote) return;
    updateStatus("Accepted", { skipRefresh: true });
    const booking = upsertBookingFromQuote(quote);
    openGoogleCalendarEvent(quote);
    toast.success(`Booking created for ${booking.event.type}`);
    navigate("/bookings");
  };

  if (!quote) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Quote not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              The quote you're looking for doesn't exist. Return to the{" "}
              <Link to="/quotes" className="underline">
                quotes list
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quote #{quote.id.slice(0, 8)}</h1>
          <p className="text-muted-foreground">{quote.customer.name} • {quote.event.type}</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Badge>{quote.status}</Badge>
          <Button variant="outline" size="sm" onClick={() => navigate(`/quotes/${quote.id}/edit`)}>
            <Pencil className="h-4 w-4 mr-2" /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => updateStatus("Sent")}>
            Send
          </Button>
          <Button variant="outline" size="sm" onClick={handleAccept}>
            Accept
          </Button>
          <Button variant="outline" size="sm" onClick={() => updateStatus("Declined")}>
            Decline
          </Button>
          <Button variant="default" size="sm" onClick={handleSendInvoiceEmail}>
            <Mail className="h-4 w-4 mr-2" /> Send invoice email
          </Button>
          <Dialog open={invoiceModalOpen} onOpenChange={setInvoiceModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <FileDown className="h-4 w-4 mr-2" /> Invoices
              </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Download Invoices</DialogTitle>
                <DialogDescription>Choose which invoice PDF to download for this quote.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Customer invoice</p>
                    <p className="text-sm text-muted-foreground">Guest-facing pricing with VAT if enabled.</p>
                  </div>
                  <Button onClick={handleCustomerInvoice}>
                    <FileDown className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Costing invoice</p>
                    <p className="text-sm text-muted-foreground">Internal costing breakdown, staff and petrol included.</p>
                  </div>
                  <Button variant="secondary" onClick={handleCostingInvoice}>
                    <FileDown className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
              <DialogFooter className="sm:justify-end">
                <DialogClose asChild>
                  <Button variant="ghost">Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={() => setTab("costing")}>
            <Calculator className="h-4 w-4 mr-2" /> Costing
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2 text-destructive" /> Delete
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as "quote" | "costing")}>
        <TabsList className="flex w-full justify-start">
          <TabsTrigger value="quote">Quote</TabsTrigger>
          <TabsTrigger value="costing">Costing</TabsTrigger>
        </TabsList>

        <TabsContent value="quote" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Customer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="font-medium">{quote.customer.name}</p>
                <p className="text-muted-foreground">{quote.customer.email || "No email"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Event</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>{quote.event.type}</p>
                <p className="text-muted-foreground">{quote.event.location}</p>
                <p className="text-muted-foreground">
                  {quote.event.date} at {quote.event.time} • {quote.event.guests} guests
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Totals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>Subtotal: <span className="font-semibold">{formatCurrency(totals?.net ?? 0)}</span></p>
                {quote.vat.enabled && (
                  <p>VAT ({quote.vat.rate}%): <span className="font-semibold">{formatCurrency(totals?.vat ?? 0)}</span></p>
                )}
                <p className="text-lg font-bold text-primary">
                  Grand Total: {formatCurrency(totals?.gross ?? 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              {invoice && invoice.lines.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.lines.map((line, index) => (
                      <TableRow key={index}>
                        <TableCell>{line.description}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(line.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No billable items on this quote.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costing">
          <CostingWorkspace quote={quote} onChange={setCosting} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
