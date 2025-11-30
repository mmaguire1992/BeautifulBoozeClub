import { test, expect } from "@playwright/test";

const STORAGE_KEYS = {
  QUOTES: "booze-club-quotes",
  SETTINGS: "booze-club-settings",
  COSTING: "booze-club-costing",
};

const clearStorage = async (page: any) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
};

const readFromStorage = async <T>(page: any, key: string): Promise<T | null> => {
  return page.evaluate((k: string) => {
    const raw = window.localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  }, key);
};

test.describe("Pricing integrity suite", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("custom item price stays exact after save", async ({ page }) => {
    await page.goto("/quotes/new");

    // Required fields
    await page.getByLabel("Customer Name").fill("Price Integrity User");
    await page.getByLabel("Customer Email").fill("price@test.com");
    await page.getByLabel("Event Type").fill("Test Event");
    await page.getByLabel("Location").fill("Test Location");

    // Add custom item @ €300
    await page.getByRole("button", { name: "Add Item" }).click();
    await page.getByPlaceholder("Description").fill("Soft Drinks");
    await page.getByPlaceholder("Cost").fill("0");
    const customerPriceInput = page.getByPlaceholder("Customer price (what you charge)");
    await customerPriceInput.fill("300");
    await page.getByPlaceholder("Qty").fill("1");

    // Verify input reflects typed value
    await expect(customerPriceInput).toHaveValue("300");

    // Save quote
    await page.getByRole("button", { name: "Save Quote" }).click();
    await page.waitForURL("**/quotes");

    // Assert stored line uses exact price
    const storedQuotes = await readFromStorage<any[]>(page, STORAGE_KEYS.QUOTES);
    expect(storedQuotes).toBeTruthy();
    const latest = storedQuotes![0] ?? storedQuotes![storedQuotes!.length - 1];
    const customLine = latest.lines.find((line: any) => line.kind === "custom");
    expect(customLine.unitPrice).toBe(300);
  });

  test("settings cocktail price flows into custom package price", async ({ page }) => {
    // Set cocktail customer price to 9.5 in settings
    await page.goto("/settings");
    const cocktailInput = page.getByLabel("Cocktail customer price (€)");
    await cocktailInput.fill("9.5");
    await cocktailInput.blur();

    // Open new quote and check custom package customer price default
    await page.goto("/quotes/new");
    await page.getByLabel("Customer Name").fill("Settings Flow");
    await page.getByLabel("Event Type").fill("Event");
    await page.getByLabel("Location").fill("Loc");

    // Enable custom package
    await page.getByText("Custom Package").scrollIntoViewIfNeeded();
    await page.getByRole("switch", { name: "Custom Package" }).click();
    const customerPricePerCocktail = page.getByLabel("Customer price per cocktail (€)");
    await expect(customerPricePerCocktail).toHaveValue("9.5");
  });

  test("package + custom line totals persist with VAT intact", async ({ page }) => {
    await page.goto("/quotes/new");
    await page.getByLabel("Customer Name").fill("Total Audit");
    await page.getByLabel("Customer Email").fill("audit@test.com");
    await page.getByLabel("Event Type").fill("Audit Event");
    await page.getByLabel("Location").fill("Audit Location");

    // Add Lily package qty 1
    await page.getByText("Lily Package").scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Lily Package" }).getByRole("button", { name: "+" }).click();

    // Add custom item €200 qty 1
    await page.getByRole("button", { name: "Add Item" }).click();
    await page.getByPlaceholder("Description").fill("Test Custom");
    await page.getByPlaceholder("Cost").fill("0");
    await page.getByPlaceholder("Customer price (what you charge)").fill("200");
    await page.getByPlaceholder("Qty").fill("1");

    await page.getByRole("button", { name: "Save Quote" }).click();
    await page.waitForURL("**/quotes");

    const storedQuotes = await readFromStorage<any[]>(page, STORAGE_KEYS.QUOTES);
    const latest = storedQuotes![0] ?? storedQuotes![storedQuotes!.length - 1];

    // Net should be 650 (Lily) + 200 = 850; VAT 23% => 195.5; gross 1045.5
    expect(latest.totals.net).toBeCloseTo(850, 2);
    expect(latest.totals.vat).toBeCloseTo(195.5, 2);
    expect(latest.totals.gross).toBeCloseTo(1045.5, 2);
  });

  test("custom items are not duplicated when identical entries are added", async ({ page }) => {
    await page.goto("/quotes/new");
    await page.getByLabel("Customer Name").fill("Dup Check");
    await page.getByLabel("Event Type").fill("Event");
    await page.getByLabel("Location").fill("Loc");

    // Add same custom item twice
    await page.getByRole("button", { name: "Add Item" }).click();
    await page.getByPlaceholder("Description").fill("Spirits");
    await page.getByPlaceholder("Cost").fill("0");
    await page.getByPlaceholder("Customer price (what you charge)").fill("300");
    await page.getByPlaceholder("Qty").fill("1");

    await page.getByRole("button", { name: "Add Item" }).click();
    const descriptions = page.getByPlaceholder("Description");
    await descriptions.nth(1).fill("Spirits");
    await page.getByPlaceholder("Cost").nth(1).fill("0");
    await page.getByPlaceholder("Customer price (what you charge)").nth(1).fill("300");
    await page.getByPlaceholder("Qty").nth(1).fill("1");

    await page.getByRole("button", { name: "Save Quote" }).click();
    await page.waitForURL("**/quotes");

    const storedQuotes = await readFromStorage<any[]>(page, STORAGE_KEYS.QUOTES);
    const latest = storedQuotes![0] ?? storedQuotes![storedQuotes!.length - 1];
    const customs = latest.lines.filter((l: any) => l.kind === "custom");
    // The combine logic should merge qty to 2, not create two separate lines
    expect(customs.length).toBe(1);
    expect(customs[0].qty).toBe(2);
    expect(customs[0].unitPrice).toBe(300);
  });
});
