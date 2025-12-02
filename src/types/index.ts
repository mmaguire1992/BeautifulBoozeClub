export type Enquiry = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  service: 'Mobile Bar Hire' | 'Cocktail Class' | 'Boozy Brunch' | 'Equipment Hire';
  eventType: string;
  location: string;
  preferredDate: string;
  preferredTime: string;
  guests: number;
  notes?: string;
  status: 'New' | 'Quoted' | 'Closed';
};

export type QuoteLine =
  | { kind: 'package'; name: 'Lily' | 'Orchid' | 'Rose'; unitPrice: number; qty: number }
  | { kind: 'class'; tier: 'Classic' | 'Luxury' | 'Ultimate'; pricePerGuest: number; guests: number }
  | { kind: 'boozyBrunch'; pricePerGuest: number; guests: number }
  | { kind: 'guestFee'; pricePerGuest: number; guests: number }
  | { kind: 'custom'; description: string; unitPrice: number; ownerCost: number; qty: number }
  | { kind: 'staffWork'; hourlyRate: number; hours: number }
  | { kind: 'staffTravel'; hourlyRate: number; hours: number }
  | { 
      kind: 'petrol'; 
      model: 'mpg' | 'perMile'; 
      pricePerLitre?: number; 
      miles?: number; 
      mpg?: number; 
      costPerMile?: number;
    };

export type Quote = {
  id: string;
  enquiryId?: string;
  customer: { name: string; email: string };
  event: { type: string; location: string; date: string; time: string; guests: number };
  lines: QuoteLine[];
  vat: { enabled: boolean; rate: number };
  totals: { net: number; vat: number; gross: number };
  status: 'Draft' | 'Sent' | 'Accepted' | 'Declined' | 'Expired';
  createdAt: string;
  updatedAt: string;
};

export type Booking = {
  id: string;
  quoteId: string;
  customer: { name: string; email: string };
  event: { type: string; location: string; date: string; time: string; guests: number };
  total: number;
  depositPaid?: number;
  paymentStatus: 'Pending' | 'DepositPaid' | 'PaidInFull';
  status: 'Confirmed' | 'Completed' | 'Cancelled';
  archived?: boolean;
  createdAt: string;
};

export type DrinkBreakdownItem = {
  id: string;
  name: string;
  qty: number;
  cost: number; // internal cost per unit
  customerPrice: number; // sell price per unit (ex VAT)
  source?: 'customLine' | 'customPackage' | 'quoteDerived';
};

export type CostingData = {
  quoteId: string;
  beers: DrinkBreakdownItem[];
  cocktails: DrinkBreakdownItem[];
  wines: {
    bottleCounts?: { red: number; white: number };
    glassesPerBottle: number;
    bottleCost: number;
    red: DrinkBreakdownItem[];
    white: DrinkBreakdownItem[];
  };
  extras: DrinkBreakdownItem[];
  overheads: {
    staffWages: number;
    staffTravel: number;
    petrol: number;
    vatRate: number;
  };
  totals: { internalCost: number; customerTotal: number; profit: number; marginPct: number; vatAmount: number };
};

export type Settings = {
  business: {
    name: string;
    address: string;
    logoUrl?: string;
  };
  vat: {
    defaultEnabled: boolean;
    defaultRate: number;
  };
  travel: {
    defaultMpg: number;
    costPerMile?: number;
  };
  hourlyRates: {
    staffWork: number;
    staffTravel: number;
  };
  costTables: {
    beer: { customerPrice: number };
    cocktail: { customerPrice: number };
    wine: { bottleCost: number; glassesPerBottle: number; customerPricePerGlass: number };
  };
};
