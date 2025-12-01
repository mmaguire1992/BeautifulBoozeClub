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
