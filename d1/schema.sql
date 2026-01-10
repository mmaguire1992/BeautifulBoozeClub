CREATE TABLE IF NOT EXISTS Enquiry (
  id TEXT PRIMARY KEY,
  createdAt TEXT DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  service TEXT NOT NULL,
  eventType TEXT NOT NULL,
  location TEXT NOT NULL,
  preferredDate TEXT NOT NULL,
  preferredTime TEXT NOT NULL,
  guests INTEGER NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'New'
);

CREATE TABLE IF NOT EXISTS Quote (
  id TEXT PRIMARY KEY,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now')),
  status TEXT NOT NULL,
  enquiryId TEXT,
  currency TEXT DEFAULT 'EUR',
  fxRate REAL,
  customer TEXT NOT NULL, -- JSON string
  event TEXT NOT NULL,    -- JSON string
  lines TEXT NOT NULL,    -- JSON string
  vat TEXT NOT NULL,      -- JSON string
  totals TEXT NOT NULL    -- JSON string
);

CREATE TABLE IF NOT EXISTS Booking (
  id TEXT PRIMARY KEY,
  quoteId TEXT,
  customer TEXT NOT NULL, -- JSON string
  event TEXT NOT NULL,    -- JSON string
  total REAL NOT NULL,
  depositPaid REAL DEFAULT 0,
  paymentStatus TEXT DEFAULT 'Pending',
  status TEXT DEFAULT 'Confirmed',
  archived INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Costing (
  id TEXT PRIMARY KEY,
  quoteId TEXT UNIQUE,
  data TEXT NOT NULL -- JSON string
);
