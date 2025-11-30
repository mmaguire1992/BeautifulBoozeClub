import { useState, useEffect } from "react";
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

  const handleSave = () => {
    saveSettings(settings);
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
                value={settings.business.name}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    business: { ...settings.business, name: e.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={settings.business.address}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    business: { ...settings.business, address: e.target.value },
                  })
                }
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
                type="number"
                min="0"
                max="100"
                value={settings.vat.defaultRate}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    vat: { ...settings.vat, defaultRate: parseFloat(e.target.value) },
                  })
                }
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
                type="number"
                min="0"
                value={settings.travel.defaultMpg}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    travel: { ...settings.travel, defaultMpg: parseFloat(e.target.value) },
                  })
                }
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
                type="number"
                min="0"
                value={settings.hourlyRates.staffWork}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    hourlyRates: { ...settings.hourlyRates, staffWork: parseFloat(e.target.value) },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Staff Travel (€/hour)</Label>
              <Input
                type="number"
                min="0"
                value={settings.hourlyRates.staffTravel}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    hourlyRates: { ...settings.hourlyRates, staffTravel: parseFloat(e.target.value) },
                  })
                }
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
                type="number"
                min="0"
                step="0.1"
                value={settings.costTables.beer.customerPrice}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    costTables: {
                      ...settings.costTables,
                      beer: { ...settings.costTables.beer, customerPrice: parseFloat(e.target.value) || 0 },
                    },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Cocktail customer price (€)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={settings.costTables.cocktail.customerPrice}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    costTables: {
                      ...settings.costTables,
                      cocktail: { ...settings.costTables.cocktail, customerPrice: parseFloat(e.target.value) || 0 },
                    },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Wine customer price per glass (€)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={settings.costTables.wine.customerPricePerGlass}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    costTables: {
                      ...settings.costTables,
                      wine: { ...settings.costTables.wine, customerPricePerGlass: parseFloat(e.target.value) || 0 },
                    },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Wine bottle cost (€)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={settings.costTables.wine.bottleCost}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    costTables: {
                      ...settings.costTables,
                      wine: { ...settings.costTables.wine, bottleCost: parseFloat(e.target.value) || 0 },
                    },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Glasses per bottle</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={settings.costTables.wine.glassesPerBottle}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    costTables: {
                      ...settings.costTables,
                      wine: { ...settings.costTables.wine, glassesPerBottle: parseFloat(e.target.value) || 1 },
                    },
                  })
                }
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
