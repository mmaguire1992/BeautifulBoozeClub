import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon } from "lucide-react";
import { getSettings, saveSettings } from "@/lib/storage";
import { Settings as SettingsType } from "@/types";
import { toast } from "sonner";

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType>(getSettings());
  const [form, setForm] = useState({
    businessName: settings.business.name,
    businessAddress: settings.business.address,
    vatRate: settings.vat.defaultRate.toString(),
    travelMpg: settings.travel.defaultMpg.toString(),
    staffWork: settings.hourlyRates.staffWork.toString(),
    staffTravel: settings.hourlyRates.staffTravel.toString(),
    beerPrice: settings.costTables.beer.customerPrice.toString(),
    cocktailPrice: settings.costTables.cocktail.customerPrice.toString(),
    winePricePerGlass: settings.costTables.wine.customerPricePerGlass.toString(),
    wineBottleCost: settings.costTables.wine.bottleCost.toString(),
    wineGlassesPerBottle: settings.costTables.wine.glassesPerBottle.toString(),
  });

  const handleSave = () => {
    const parsed: SettingsType = {
      business: {
        name: form.businessName,
        address: form.businessAddress,
        logoUrl: settings.business.logoUrl,
      },
      vat: {
        defaultEnabled: settings.vat.defaultEnabled,
        defaultRate: parseFloat(form.vatRate) || 0,
      },
      travel: {
        defaultMpg: parseFloat(form.travelMpg) || 0,
        costPerMile: settings.travel.costPerMile,
      },
      hourlyRates: {
        staffWork: parseFloat(form.staffWork) || 0,
        staffTravel: parseFloat(form.staffTravel) || 0,
      },
      costTables: {
        beer: { customerPrice: parseFloat(form.beerPrice) || 0 },
        cocktail: { customerPrice: parseFloat(form.cocktailPrice) || 0 },
        wine: {
          customerPricePerGlass: parseFloat(form.winePricePerGlass) || 0,
          bottleCost: parseFloat(form.wineBottleCost) || 0,
          glassesPerBottle: parseFloat(form.wineGlassesPerBottle) || 1,
        },
      },
    };
    setSettings(parsed);
    saveSettings(parsed);
    toast.success("Settings saved successfully");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Configure business defaults</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Business Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={form.businessAddress}
                onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>VAT Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Default VAT Rate (%)</Label>
              <Input
                type="text"
                min="0"
                max="100"
                value={form.vatRate}
                onChange={(e) => setForm({ ...form, vatRate: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Travel Defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Default MPG</Label>
              <Input
                type="text"
                min="0"
                value={form.travelMpg}
                onChange={(e) => setForm({ ...form, travelMpg: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hourly Rates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Staff Work (€/hour)</Label>
              <Input
                type="text"
                min="0"
                value={form.staffWork}
                onChange={(e) => setForm({ ...form, staffWork: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Staff Travel (€/hour)</Label>
              <Input
                type="text"
                min="0"
                value={form.staffTravel}
                onChange={(e) => setForm({ ...form, staffTravel: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Default Pricing</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Beer customer price (€)</Label>
              <Input
                type="text"
                min="0"
                step="0.1"
                value={form.beerPrice}
                onChange={(e) => setForm({ ...form, beerPrice: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Cocktail customer price (€)</Label>
              <Input
                type="text"
                min="0"
                step="0.1"
                value={form.cocktailPrice}
                onChange={(e) => setForm({ ...form, cocktailPrice: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Wine customer price per glass (€)</Label>
              <Input
                type="text"
                min="0"
                step="0.1"
                value={form.winePricePerGlass}
                onChange={(e) => setForm({ ...form, winePricePerGlass: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Wine bottle cost (€)</Label>
              <Input
                type="text"
                min="0"
                step="0.1"
                value={form.wineBottleCost}
                onChange={(e) => setForm({ ...form, wineBottleCost: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Glasses per bottle</Label>
              <Input
                type="text"
                min="1"
                step="1"
                value={form.wineGlassesPerBottle}
                onChange={(e) => setForm({ ...form, wineGlassesPerBottle: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave}>Save Settings</Button>
      </div>
    </div>
  );
}
