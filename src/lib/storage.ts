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
};

const mergeSettings = (stored?: Partial<Settings>): Settings => ({
  business: { ...defaultSettings.business, ...(stored?.business || {}) },
  vat: { ...defaultSettings.vat, ...(stored?.vat || {}) },
  travel: { ...defaultSettings.travel, ...(stored?.travel || {}) },
  hourlyRates: { ...defaultSettings.hourlyRates, ...(stored?.hourlyRates || {}) },
  costTables: {
    beer: { ...defaultSettings.costTables.beer, ...(stored?.costTables?.beer || {}) },
    cocktail: { ...defaultSettings.costTables.cocktail, ...(stored?.costTables?.cocktail || {}) },
    wine: { ...defaultSettings.costTables.wine, ...(stored?.costTables?.wine || {}) },
  },
});

// Enquiries
export const getEnquiries = (): Enquiry[] => getFromStorage(STORAGE_KEYS.ENQUIRIES, []);
export const saveEnquiries = (enquiries: Enquiry[]) => setToStorage(STORAGE_KEYS.ENQUIRIES, enquiries);

// Quotes
export const getQuotes = (): Quote[] => getFromStorage(STORAGE_KEYS.QUOTES, []);
export const saveQuotes = (quotes: Quote[]) => setToStorage(STORAGE_KEYS.QUOTES, quotes);

// Bookings
const normalizeBooking = (booking: Booking): Booking => ({
  ...booking,
  status: booking.status ?? "Confirmed",
  paymentStatus: booking.paymentStatus ?? "Pending",
  depositPaid: booking.depositPaid ?? 0,
  createdAt: booking.createdAt ?? new Date().toISOString(),
});

export const getBookings = (): Booking[] => getFromStorage(STORAGE_KEYS.BOOKINGS, []).map(normalizeBooking);
export const saveBookings = (bookings: Booking[]) => setToStorage(STORAGE_KEYS.BOOKINGS, bookings);
export const upsertBookingFromQuote = (quote: Quote): Booking => {
  const all = getBookings();
  const existing = all.find((b) => b.quoteId === quote.id);
  const base: Booking = existing
    ? { ...existing }
    : {
        id: quote.id,
        quoteId: quote.id,
        customer: quote.customer,
        event: quote.event,
        total: quote.totals.gross,
        status: "Confirmed",
        paymentStatus: "Pending",
        depositPaid: 0,
        createdAt: new Date().toISOString(),
      };

  const updated: Booking = {
    ...base,
    customer: quote.customer,
    event: quote.event,
    total: quote.totals.gross,
  };

  const idx = all.findIndex((b) => b.quoteId === quote.id);
  if (idx >= 0) {
    all[idx] = updated;
  } else {
    all.unshift(updated);
  }
  saveBookings(all);
  return updated;
};

// Costing
export const getCostingData = (): CostingData[] => getFromStorage(STORAGE_KEYS.COSTING, []);
export const saveCostingData = (costing: CostingData[]) => setToStorage(STORAGE_KEYS.COSTING, costing);
export const getCostingByQuoteId = (quoteId: string): CostingData | undefined =>
  getCostingData().find((c) => c.quoteId === quoteId);

// Settings
export const getSettings = (): Settings => {
  const raw = getFromStorage<Partial<Settings>>(STORAGE_KEYS.SETTINGS, defaultSettings);
  return mergeSettings(raw);
};
export const saveSettings = (settings: Settings) => setToStorage(STORAGE_KEYS.SETTINGS, settings);
