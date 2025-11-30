import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Eye, FileDown, Pencil, Trash2, CheckCircle } from "lucide-react";
import { getQuotes, saveQuotes, getSettings, getCostingData, saveCostingData, upsertBookingFromQuote, getCostingByQuoteId } from "@/lib/storage";
import { Quote } from "@/types";
import { format } from "date-fns";
import { generateCustomerQuotePdf } from "@/lib/pdf";
import { toast } from "sonner";
import { openGoogleCalendarEvent } from "@/lib/calendar";
import { calculateInvoiceTotals } from "@/lib/invoice";

export default function Quotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  useEffect(() => {
    setQuotes(getQuotes());
  }, []);

  const getStatusBadge = (status: Quote["status"]) => {
    const variants: Record<
      Quote["status"],
      { variant: "default" | "secondary" | "outline" | "destructive"; color?: string }
    > = {
      Draft: { variant: "outline" },
      Sent: { variant: "secondary" },
      Accepted: { variant: "default" },
      Declined: { variant: "destructive" },
      Expired: { variant: "outline" },
    };
    return <Badge variant={variants[status].variant}>{status}</Badge>;
  };

  const handleDownload = async (quote: Quote) => {
    try {
      await generateCustomerQuotePdf({ quote, settings: getSettings() });
    } catch (error) {
      toast.error("Unable to generate PDF");
      console.error(error);
    }
  };

  const handleAccept = (quote: Quote) => {
    const updatedQuotes = getQuotes().map((q) =>
      q.id === quote.id ? { ...q, status: "Accepted", updatedAt: new Date().toISOString() } : q
    );
    saveQuotes(updatedQuotes);
    setQuotes(updatedQuotes);
    const booking = upsertBookingFromQuote({ ...quote, status: "Accepted" });
    openGoogleCalendarEvent(quote);
    toast.success(`Quote accepted and booking created for ${booking.event.type}`);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this quote and its costing? This cannot be undone.")) {
      return;
    }
    const updated = getQuotes().filter((q) => q.id !== id);
    saveQuotes(updated);
    const costings = getCostingData().filter((c) => c.quoteId !== id);
    saveCostingData(costings);
    setQuotes(updated);
    toast.success("Quote deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quotes</h1>
          <p className="text-muted-foreground mt-1">Manage customer quotes</p>
        </div>
        <Link to="/quotes/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Quote
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Quotes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Event Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No quotes found
                  </TableCell>
                </TableRow>
              ) : (
                quotes.map((quote) => {
                  const costing = getCostingByQuoteId(quote.id);
                  const { totals } = calculateInvoiceTotals(quote, {
                    includeInternal: false,
                    costing: costing ?? undefined,
                  });
                  return (
                    <TableRow key={quote.id}>
                      <TableCell className="font-medium">#{quote.id.slice(0, 8)}</TableCell>
                      <TableCell>{quote.customer.name}</TableCell>
                      <TableCell>{quote.event.type}</TableCell>
                      <TableCell>{format(new Date(quote.event.date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell className="font-semibold">€{totals.gross.toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(quote.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 text-muted-foreground">
                          <Button variant="default" size="sm" onClick={() => handleAccept(quote)}>
                            Accept
                          </Button>
                          <Link to={`/quotes/${quote.id}`}>
                            <Button variant="ghost" size="icon" title="Preview">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link to={`/quotes/${quote.id}/edit`}>
                            <Button variant="ghost" size="icon" title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="icon" title="Download PDF" onClick={() => handleDownload(quote)}>
                            <FileDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete"
                            onClick={() => handleDelete(quote.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
