import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Plus, Minus, Trash2, FileDown } from "lucide-react";
import { getSettings } from "@/lib/storage";
import { CostingData, Quote, QuoteLine } from "@/types";
import {
  fetchTravelEstimate,
  type TravelEstimate,
  fetchEnquiries,
  fetchQuote,
  createQuote,
  updateQuote,
  acceptQuote,
  fetchCosting,
  saveCosting,
} from "@/lib/api";
import { toast } from "sonner";
import CostingWorkspace from "@/components/CostingWorkspace";
import { generateId } from "@/lib/id";
import { calculateInvoiceTotals } from "@/lib/invoice";
import { generateCustomerQuotePdfBlob, generateCostingPdfBlob } from "@/lib/pdf";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

type PackageType = { name: 'Lily' | 'Orchid' | 'Rose'; price: number; cocktails: number; qty: number };
type ClassType = { tier: 'Classic' | 'Luxury' | 'Ultimate'; price: number };
type CustomItem = { id: string; description: string; unitPrice: number; ownerCost: number; qty: number };
const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const whole = (n: number) => Math.max(0, Math.round(Number.isFinite(n) ? n : 0));
const combineCustomItems = (items: CustomItem[]): CustomItem[] => {
  const merged = new Map<string, CustomItem>();
  items.forEach((item) => {
    const key = `${item.description.trim().toLowerCase()}|${round2(item.unitPrice)}|${round2(item.ownerCost)}`;
    const existing = merged.get(key);
    if (existing) {
      existing.qty += whole(item.qty);
    } else {
      merged.set(key, {
        ...item,
        unitPrice: round2(item.unitPrice),
        ownerCost: round2(item.ownerCost),
        qty: whole(item.qty),
      });
    }
  });
  return Array.from(merged.values());
};

export default function NewQuote() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { quoteId } = useParams();
  const enquiryId = searchParams.get('enquiryId');
  const settings = getSettings();
  const isEdit = Boolean(quoteId);
  const [draftQuoteId] = useState(() => generateId());
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  const [customer, setCustomer] = useState({ name: "", email: "" });
  const [event, setEvent] = useState({ type: "", location: "", date: "", time: "", guests: 0 });
  const [guestInput, setGuestInput] = useState<string>("0");
  const [originalQuote, setOriginalQuote] = useState<Quote | null>(null);
  
  // Packages
  const [packages, setPackages] = useState<PackageType[]>([
    { name: 'Lily', price: 650, cocktails: 60, qty: 0 },
    { name: 'Orchid', price: 750, cocktails: 80, qty: 0 },
    { name: 'Rose', price: 950, cocktails: 100, qty: 0 },
  ]);
  const [packagesEnabled, setPackagesEnabled] = useState(true);

  // Cocktail Class
  const [classEnabled, setClassEnabled] = useState(false);
  const [classTier, setClassTier] = useState<'Classic' | 'Luxury' | 'Ultimate'>('Classic');
  const [classGuests, setClassGuests] = useState(0);
  const classPrices: Record<ClassType['tier'], number> = {
    Classic: 39,
    Luxury: 49,
    Ultimate: 60,
  };

  // Boozy Brunch
  const [brunchEnabled, setBrunchEnabled] = useState(false);
  const [brunchGuests, setBrunchGuests] = useState(0);
  const brunchPrice = 45;

  // Custom Package (priced per cocktail)
  const [guestFeeEnabled, setGuestFeeEnabled] = useState(false);
  const [guestFeeCocktails, setGuestFeeCocktails] = useState<string>("0");
  const [guestFeeCustomerPrice, setGuestFeeCustomerPrice] = useState(
    settings.costTables.cocktail.customerPrice ?? 0
  );
  const getGuestFeeCount = (value: string = guestFeeCocktails) => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  // Travel & Staff
  const [petrolPrice, setPetrolPrice] = useState(1.75);
  const [petrolMiles, setPetrolMiles] = useState(0);
  const [petrolMpg, setPetrolMpg] = useState(settings.travel.defaultMpg);
  const [travelOrigin, setTravelOrigin] = useState(settings.business.address || "");
  const [travelDestination, setTravelDestination] = useState("");
  const [travelLoading, setTravelLoading] = useState(false);
  const [travelError, setTravelError] = useState<string | null>(null);
  const [travelEstimate, setTravelEstimate] = useState<TravelEstimate | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [staffWorkHours, setStaffWorkHours] = useState(0);
  const [staffTravelHours, setStaffTravelHours] = useState(0);

  // VAT
  const [vatEnabled, setVatEnabled] = useState(settings.vat.defaultEnabled);
  const [vatRate, setVatRate] = useState(settings.vat.defaultRate);

  // Custom Items
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [costing, setCosting] = useState<CostingData | null>(null);

  useEffect(() => {
    const load = async () => {
      if (enquiryId) {
        try {
          const list = await fetchEnquiries();
          const enquiry = list.find((e) => e.id === enquiryId);
          if (enquiry) {
            setCustomer({ name: enquiry.name, email: enquiry.email });
            setEvent({
              type: enquiry.eventType,
              location: enquiry.location,
              date: enquiry.preferredDate,
              time: enquiry.preferredTime,
              guests: enquiry.guests,
            });
            setGuestInput(String(enquiry.guests ?? "0"));
            setTravelDestination(enquiry.location);
          }
        } catch {
          // ignore
        }
      }

      if (quoteId) {
        try {
          const existing = await fetchQuote(quoteId);
          setOriginalQuote(existing);
          setCustomer(existing.customer);
          setEvent(existing.event);
          setGuestInput(String(existing.event.guests ?? "0"));
          setVatEnabled(existing.vat.enabled);
          setVatRate(existing.vat.rate);
          existing.lines.forEach((line) => {
            switch (line.kind) {
              case "package":
                setPackages((prev) => prev.map((p) => (p.name === line.name ? { ...p, qty: line.qty } : p)));
                break;
              case "class":
                setClassEnabled(true);
                setClassTier(line.tier);
                setClassGuests(line.guests);
                break;
              case "boozyBrunch":
                setBrunchEnabled(true);
                setBrunchGuests(line.guests);
                break;
              case "guestFee":
                setGuestFeeEnabled(true);
                setGuestFeeCocktails(String(line.guests ?? "0"));
                setGuestFeeCustomerPrice(line.pricePerGuest);
                break;
              case "custom":
                setCustomItems((prev) => [
                  ...prev,
                  {
                    id: generateId(),
                    description: line.description,
                    unitPrice: round2(line.unitPrice),
                    ownerCost: "ownerCost" in line ? round2((line as any).ownerCost || 0) : 0,
                    qty: whole(line.qty),
                  },
                ]);
                break;
              case "staffWork":
                setStaffWorkHours(line.hours);
                break;
              case "staffTravel":
                setStaffTravelHours(line.hours);
                break;
              case "petrol":
                setPetrolMiles(line.miles ?? 0);
                setPetrolPrice(line.pricePerLitre ?? petrolPrice);
                setPetrolMpg(line.mpg ?? petrolMpg);
                break;
            }
          });
          if (existing.event.location) {
            setTravelDestination(existing.event.location);
          }
          const cost = await fetchCosting(existing.id);
          if (cost?.data) setCosting(cost.data as CostingData);
        } catch {
          toast.error("Quote not found");
          navigate("/quotes");
        }
      }
    };
    load();
  }, [enquiryId, quoteId, navigate, petrolMpg, petrolPrice]);

  const handleTravelEstimate = async () => {
    if (!travelDestination.trim()) {
      setTravelError("Destination is required");
      return;
    }

    setTravelLoading(true);
    setTravelError(null);
    try {
      const estimate = await fetchTravelEstimate({
        origin: travelOrigin || "7 Sunbury Ave Belfast BT5 5NU",
        destination: travelDestination,
        petrolPrice: petrolPrice || undefined,
        mpg: petrolMpg || undefined,
      });

      setTravelEstimate(estimate);
      setPetrolPrice(estimate.fuelPricePerLitre);
      setPetrolMiles(Number(estimate.distance.roundTrip.miles.toFixed(1)));
      toast.success("Travel estimate updated");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Travel estimate failed (check Google Maps API key)";
      setTravelError(message);
      toast.error(message);
    } finally {
      setTravelLoading(false);
    }
  };

  const updatePackageQty = (name: 'Lily' | 'Orchid' | 'Rose', delta: number) => {
    setPackages(packages.map(p =>
      p.name === name ? { ...p, qty: Math.max(0, p.qty + delta) } : p
    ));
  };

  const addCustomItem = () => {
    setCustomItems([
      ...customItems,
      { id: generateId(), description: "", unitPrice: 0, ownerCost: 0, qty: 1 },
    ]);
  };

  const updateCustomItem = (id: string, field: keyof CustomItem, value: string | number) => {
    setCustomItems(customItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const removeCustomItem = (id: string) => {
    setCustomItems(customItems.filter(item => item.id !== id));
  };

  const calculateTotals = () => {
    const guests = parseInt(guestInput, 10) || 0;
    const lines: QuoteLine[] = [];
    const normalizedCustoms = combineCustomItems(
      customItems.map((item) => ({
        ...item,
        unitPrice: round2(item.unitPrice),
        ownerCost: round2(item.ownerCost),
        qty: whole(item.qty),
      }))
    );

    // Add packages
    if (packagesEnabled) {
      packages.forEach(pkg => {
        if (pkg.qty > 0) {
          lines.push({
            kind: 'package',
            name: pkg.name,
            unitPrice: pkg.price,
            qty: pkg.qty,
          });
        }
      });
    }

    // Add class
    if (classEnabled && classGuests > 0) {
      lines.push({
        kind: 'class',
        tier: classTier,
        pricePerGuest: classPrices[classTier],
        guests: classGuests,
      });
    }

    // Add brunch
    if (brunchEnabled && brunchGuests > 0) {
      lines.push({
        kind: 'boozyBrunch',
        pricePerGuest: brunchPrice,
        guests: brunchGuests,
      });
    }

    // Add guest fee
    const cocktailsCount = getGuestFeeCount();
    if (guestFeeEnabled && cocktailsCount > 0) {
      lines.push({
        kind: 'guestFee',
        pricePerGuest: guestFeeCustomerPrice,
        guests: cocktailsCount,
      });
    }

    // Add staff work
    if (staffWorkHours > 0) {
      lines.push({
        kind: 'staffWork',
        hourlyRate: settings.hourlyRates.staffWork,
        hours: staffWorkHours,
      });
    }

    // Add staff travel (hourly)
    if (staffTravelHours > 0) {
      lines.push({
        kind: 'staffTravel',
        hourlyRate: settings.hourlyRates.staffTravel,
        hours: staffTravelHours,
      });
    }

    // Add petrol (from Google Maps estimate)
    if (petrolMiles > 0 && petrolPrice > 0 && petrolMpg > 0) {
      lines.push({
        kind: 'petrol',
        model: 'mpg',
        pricePerLitre: petrolPrice,
        miles: petrolMiles,
        mpg: petrolMpg,
      });
    }

    // Add custom items (combined to avoid duplicates)
    normalizedCustoms.forEach(item => {
      if (item.description && item.qty > 0) {
        lines.push({
          kind: 'custom',
          description: item.description,
          unitPrice: round2(item.unitPrice),
          ownerCost: round2(item.ownerCost),
          qty: whole(item.qty),
        });
      }
    });

    const quoteIdToUse = quoteId || originalQuote?.id || draftQuoteId;
    const createdAt = originalQuote?.createdAt || new Date().toISOString();
    const status = isEdit && originalQuote ? originalQuote.status : 'Draft';

    const quote: Quote = {
      id: quoteIdToUse,
      enquiryId,
      customer,
      event: { ...event, guests },
      lines,
      vat: { enabled: vatEnabled, rate: vatRate },
      totals: { net: 0, vat: 0, gross: 0 },
      status,
      createdAt,
      updatedAt: new Date().toISOString(),
    };

    const { totals, lines: invoiceLines } = calculateInvoiceTotals(quote, {
      includeInternal: false,
      costing: costing || undefined,
    });

    quote.totals = totals;

    return { quote, totals, invoiceLines };
  };

  const handleSave = async () => {
    setFormError(null);
    if (!customer.name.trim() || !event.type.trim() || !event.location.trim()) {
      setFormError("Name, event type, and location are required.");
      return;
    }

    const { quote, invoiceLines } = calculateTotals();
    if (invoiceLines.length === 0) {
      setFormError("Add at least one billable item before saving.");
      return;
    }
    if (quote.totals.gross <= 0) {
      setFormError("Quote total must be greater than zero.");
      return;
    }
    try {
      let saved: Quote;
      if (isEdit) {
        saved = await updateQuote(quote.id, quote);
      } else {
        saved = await createQuote(quote);
      }
      if (costing) {
        await saveCosting(saved.id, costing);
      }
      toast.success(isEdit ? "Quote updated" : "Quote saved successfully");
      navigate("/quotes");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save quote");
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleModalCustomerDownload = async () => {
    try {
      const { quote, invoiceLines } = calculateTotals();
      if (invoiceLines.length === 0) {
        toast.error("Add at least one billable item before downloading.");
        return;
      }
      const { blob, filename } = await generateCustomerQuotePdfBlob({ quote, settings });
      downloadBlob(blob, filename);
    } catch (error) {
      console.error(error);
      toast.error("Unable to prepare customer invoice.");
    }
  };

  const handleModalCostingDownload = async () => {
    try {
      const { quote } = calculateTotals();
      const costingToUse = costing;
      if (!costingToUse) {
        toast.error("Add costing details in the Costing tab first.");
        return;
      }
      const { blob, filename } = await generateCostingPdfBlob({ quote, costing: costingToUse, settings });
      downloadBlob(blob, filename);
    } catch (error) {
      console.error(error);
      toast.error("Unable to prepare costing invoice.");
    }
  };

  const { quote: previewQuote, totals } = calculateTotals();

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/quotes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {isEdit ? "Edit Quote" : "Quote Builder"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEdit ? "Update pricing and details before sending" : "Create a detailed quote"}
          </p>
        </div>
      </div>
      {formError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {formError}
        </div>
      )}

      {/* Customer & Event Info */}
      <Card>
        <CardHeader>
          <CardTitle>Customer & Event Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input
                value={customer.name}
                onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Customer Email</Label>
              <Input
                type="email"
                value={customer.email}
                onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Event Type</Label>
              <Input
                value={event.type}
                onChange={(e) => setEvent({ ...event, type: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={event.location}
                onChange={(e) => {
                  setEvent({ ...event, location: e.target.value });
                  setTravelDestination(e.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={event.date}
                onChange={(e) => setEvent({ ...event, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={event.time}
                onChange={(e) => setEvent({ ...event, time: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
              <Label>Number of Guests</Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={guestInput}
                onChange={(e) => {
                    const value = e.target.value;
                    setGuestInput(value);
                    const parsed = parseInt(value, 10) || 0;
                    setEvent({ ...event, guests: parsed });
                }}
              />
          </div>
        </CardContent>
      </Card>

      {/* Cocktail Packages */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Cocktail Packages</CardTitle>
            <Switch checked={packagesEnabled} onCheckedChange={setPackagesEnabled} />
          </div>
        </CardHeader>
        {packagesEnabled && (
          <CardContent className="space-y-4">
            {packages.map(pkg => (
              <div key={pkg.name} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{pkg.name} Package</p>
                  <p className="text-sm text-muted-foreground">{pkg.cocktails} cocktails - €{pkg.price}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => updatePackageQty(pkg.name, -1)}
                    disabled={pkg.qty === 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-semibold">{pkg.qty}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => updatePackageQty(pkg.name, 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <span className="w-24 text-right font-semibold">
                    €{(pkg.price * pkg.qty).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Cocktail Making Class */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Cocktail Making Class</CardTitle>
            <Switch checked={classEnabled} onCheckedChange={setClassEnabled} />
          </div>
        </CardHeader>
        {classEnabled && (
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tier</Label>
                <div className="flex gap-2">
                  {(['Classic', 'Luxury', 'Ultimate'] as const).map(tier => (
                    <Button
                      key={tier}
                      variant={classTier === tier ? "default" : "outline"}
                      onClick={() => setClassTier(tier)}
                      className="flex-1"
                    >
                      {tier} (€{classPrices[tier]})
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Number of Guests</Label>
                <Input
                  type="number"
                  min="0"
                  value={classGuests}
                  onChange={(e) => setClassGuests(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="text-right">
              <span className="font-semibold text-lg">
                Total: €{(classPrices[classTier] * classGuests).toFixed(2)}
              </span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Boozy Brunch */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Boozy Brunch (€{brunchPrice} per guest)</CardTitle>
            <Switch checked={brunchEnabled} onCheckedChange={setBrunchEnabled} />
          </div>
        </CardHeader>
        {brunchEnabled && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Number of Guests</Label>
              <Input
                type="number"
                min="0"
                value={brunchGuests}
                onChange={(e) => setBrunchGuests(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="text-right">
              <span className="font-semibold text-lg">
                Total: €{(brunchPrice * brunchGuests).toFixed(2)}
              </span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Custom Package (per cocktail) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Custom Package</CardTitle>
            <Switch checked={guestFeeEnabled} onCheckedChange={setGuestFeeEnabled} />
          </div>
        </CardHeader>
        {guestFeeEnabled && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Number of Cocktails</Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={guestFeeCocktails}
                onChange={(e) => setGuestFeeCocktails(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Customer price per cocktail (€)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={guestFeeCustomerPrice}
                onChange={(e) => setGuestFeeCustomerPrice(parseFloat(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Defaults to cocktail customer price from Settings.
              </p>
            </div>
            <div className="text-right">
              <span className="font-semibold text-lg">
                Total: €{(guestFeeCustomerPrice * getGuestFeeCount()).toFixed(2)}
              </span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Travel & Staff */}
      <Card>
        <CardHeader>
          <CardTitle>Travel & Staff</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium">Google Maps Estimate</h3>
                <Button onClick={handleTravelEstimate} disabled={travelLoading} variant="outline">
                  {travelLoading ? "Calculating..." : "Calculate"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Pull distance and petrol estimates from Google Maps to prefill the petrol fields below.
                Staff travel uses the hourly rate from Settings; enter hours manually. Requires `GOOGLE_MAPS_API_KEY` on the backend.
              </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Origin</Label>
                <Input
                  value={travelOrigin}
                  onChange={(e) => setTravelOrigin(e.target.value)}
                  placeholder="Home base or depot"
                />
              </div>
              <div className="space-y-2">
                <Label>Destination</Label>
                <Input
                  value={travelDestination}
                  onChange={(e) => setTravelDestination(e.target.value)}
                  placeholder="Event address"
                />
              </div>
            </div>
            {travelError && <p className="text-sm text-destructive">{travelError}</p>}
            {travelEstimate && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    Round trip: {travelEstimate.distance.roundTrip.miles.toFixed(1)} mi •{" "}
                    {(travelEstimate.distance.roundTrip.durationMinutes / 60).toFixed(1)} hrs
                  </span>
                  <span className="text-muted-foreground capitalize">{travelEstimate.provider} route</span>
                </div>
                <p className="text-muted-foreground">
                  Petrol est.:{" "}
                  {travelEstimate.petrolCost !== null
                    ? `€${travelEstimate.petrolCost.toFixed(2)}`
                    : "—"}{" "}
                  • Fuel price: €{travelEstimate.fuelPricePerLitre.toFixed(2)}/L
                </p>
                <p className="text-muted-foreground">
                  Distance applied to petrol fields below. Staff travel remains a flat rate you set.
                </p>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="font-medium">Staff</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Staff Work Hours (€{settings.hourlyRates.staffWork}/h)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={staffWorkHours}
                  onChange={(e) => setStaffWorkHours(parseFloat(e.target.value) || 0)}
                />
                {staffWorkHours > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Total: €{(staffWorkHours * settings.hourlyRates.staffWork).toFixed(2)}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Staff Travel Hours (€{settings.hourlyRates.staffTravel}/h)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={staffTravelHours}
                  onChange={(e) => setStaffTravelHours(parseFloat(e.target.value) || 0)}
                />
                {staffTravelHours > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Total: €{(staffTravelHours * settings.hourlyRates.staffTravel).toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* VAT */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>VAT</CardTitle>
            <Switch
              checked={vatEnabled}
              onCheckedChange={(checked) => {
                setVatEnabled(checked);
                if (checked) {
                  setVatRate(settings.vat.defaultRate);
                }
              }}
            />
          </div>
        </CardHeader>
        {vatEnabled && (
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>VAT is applied at {vatRate}% (from Settings).</p>
          </CardContent>
        )}
      </Card>

      {/* Custom Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Custom Line Items</CardTitle>
            <Button variant="outline" size="sm" onClick={addCustomItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {customItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No custom items added
            </p>
          ) : (
            <>
              <div className="hidden md:grid grid-cols-[1fr_140px_140px_96px_96px_48px] gap-3 text-xs font-semibold text-muted-foreground px-1">
                <span>Description</span>
                <span>Cost</span>
                <span>Customer</span>
                <span>Qty</span>
                <span className="text-right">Total</span>
                <span className="sr-only">Actions</span>
              </div>
              {customItems.map(item => (
              <div
                key={item.id}
                className="grid gap-3 p-3 border rounded-lg md:grid-cols-[1fr_140px_140px_96px_96px_48px] md:items-center"
              >
                <Input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateCustomItem(item.id, 'description', e.target.value)}
                  className="w-full"
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Cost"
                  aria-label="Cost"
                  title="Cost"
                  value={item.ownerCost}
                  onChange={(e) => updateCustomItem(item.id, 'ownerCost', parseFloat(e.target.value) || 0)}
                  className="w-full"
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Customer price (what you charge)"
                  aria-label="Customer price (what you charge)"
                  title="Customer price (what you charge)"
                  value={item.unitPrice}
                  onChange={(e) => updateCustomItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                  className="w-full"
                />
                <Input
                  type="number"
                  min="0"
                  placeholder="Qty"
                  value={item.qty}
                  onChange={(e) => updateCustomItem(item.id, 'qty', parseInt(e.target.value) || 0)}
                  className="w-full"
                />
                <span className="text-right font-semibold">
                  €{(item.unitPrice * item.qty).toFixed(2)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCustomItem(item.id)}
                  className="justify-self-end"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* Costing */}
      <div className="mt-6">
        <CostingWorkspace quote={previewQuote} onChange={setCosting} />
      </div>

      {/* Totals */}
      <Card className="bg-accent/30">
        <CardHeader>
          <CardTitle>Quote Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Subtotal:</span>
            <span className="font-semibold">€{totals.net.toFixed(2)}</span>
          </div>
          {vatEnabled && (
            <div className="flex justify-between text-sm">
              <span>VAT ({vatRate}%):</span>
              <span className="font-semibold">€{totals.vat.toFixed(2)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>Grand Total:</span>
            <span className="text-accent">€{totals.gross.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 sticky bottom-4 bg-background/95 backdrop-blur p-4 border rounded-lg">
        <Button onClick={handleSave} className="flex-1">
          Save Quote
        </Button>
        <Dialog open={invoiceModalOpen} onOpenChange={setInvoiceModalOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex-1">
              <FileDown className="mr-2 h-4 w-4" />
              Invoices
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Download Invoices</DialogTitle>
              <DialogDescription>
                Choose which invoice PDF to download for this quote.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Customer invoice</p>
                  <p className="text-sm text-muted-foreground">Guest-facing pricing with VAT if enabled.</p>
                </div>
                <Button onClick={handleModalCustomerDownload}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Costing invoice</p>
                  <p className="text-sm text-muted-foreground">Internal costing breakdown, staff and petrol included.</p>
                </div>
                <Button variant="secondary" onClick={handleModalCostingDownload}>
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
      </div>
    </div>
  );
}
