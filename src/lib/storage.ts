import { Enquiry, Quote, Booking, CostingData, Settings } from '@/types';

const STORAGE_KEYS = {
  ENQUIRIES: 'booze-club-enquiries',
  QUOTES: 'booze-club-quotes',
  BOOKINGS: 'booze-club-bookings',
  COSTING: 'booze-club-costing',
  SETTINGS: 'booze-club-settings',
};

// Helper functions
const getFromStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const setToStorage = <T>(key: string, value: T): void => {
  localStorage.setItem(key, JSON.stringify(value));
};

const defaultSettings: Settings = {
  business: {
    name: 'The Beautiful Booze Club',
    address: '',
  },
  currency: {
    default: "EUR",
    gbpRate: 0.85,
  },
  vat: {
    defaultEnabled: true,
    defaultRate: 23,
  },
  travel: {
    defaultMpg: 35,
  },
  hourlyRates: {
    staffWork: 25,
    staffTravel: 15,
  },
  costTables: {
    beer: { customerPrice: 4.0 },
    cocktail: { customerPrice: 10.0 },
    wine: { bottleCost: 10, glassesPerBottle: 4, customerPricePerGlass: 8.0 },
  },
  classPricing: {
    classicPerHead: 5.4,
    luxuryPerHead: 7.4,
    ultimatePerHead: 10.1,
  },
};

const mergeSettings = (stored?: Partial<Settings>): Settings => ({
  business: { ...defaultSettings.business, ...(stored?.business || {}) },
  currency: { ...defaultSettings.currency, ...(stored?.currency || {}) },
  vat: { ...defaultSettings.vat, ...(stored?.vat || {}) },
  travel: { ...defaultSettings.travel, ...(stored?.travel || {}) },
  hourlyRates: { ...defaultSettings.hourlyRates, ...(stored?.hourlyRates || {}) },
  costTables: {
    beer: { ...defaultSettings.costTables.beer, ...(stored?.costTables?.beer || {}) },
    cocktail: { ...defaultSettings.costTables.cocktail, ...(stored?.costTables?.cocktail || {}) },
    wine: { ...defaultSettings.costTables.wine, ...(stored?.costTables?.wine || {}) },
  },
  classPricing: { ...defaultSettings.classPricing, ...(stored?.classPricing || {}) },
});

// Enquiries
export const getEnquiries = (): Enquiry[] => getFromStorage(STORAGE_KEYS.ENQUIRIES, []);
export const saveEnquiries = (enquiries: Enquiry[]) => setToStorage(STORAGE_KEYS.ENQUIRIES, enquiries);

// Quotes
// Quotes/bookings/costings now live in the API/D1. Keep these no-ops to avoid usage.
export const getQuotes = (): Quote[] => [];
export const saveQuotes = (_quotes: Quote[]) => undefined;

// Bookings
const normalizeBooking = (booking: Booking): Booking => ({
  ...booking,
  status: booking.status ?? "Confirmed",
  paymentStatus: booking.paymentStatus ?? "Pending",
  depositPaid: booking.depositPaid ?? 0,
  createdAt: booking.createdAt ?? new Date().toISOString(),
});

export const getBookings = (): Booking[] => [];
export const saveBookings = (_bookings: Booking[]) => undefined;
export const upsertBookingFromQuote = (_quote: Quote): Booking => {
  throw new Error("upsertBookingFromQuote is now handled via API/D1");
};

// Costing
export const getCostingData = (): CostingData[] => [];
export const saveCostingData = (_costing: CostingData[]) => undefined;
export const getCostingByQuoteId = (_quoteId: string): CostingData | undefined => undefined;

// Settings
export const getSettings = (): Settings => {
  const raw = getFromStorage<Partial<Settings>>(STORAGE_KEYS.SETTINGS, defaultSettings);
  return mergeSettings(raw);
};
export const saveSettings = (settings: Settings) => setToStorage(STORAGE_KEYS.SETTINGS, settings);
