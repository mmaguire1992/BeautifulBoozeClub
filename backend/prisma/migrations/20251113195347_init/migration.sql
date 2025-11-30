-- CreateTable
CREATE TABLE "Enquiry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "preferredDate" DATETIME NOT NULL,
    "preferredTime" TEXT NOT NULL,
    "guests" INTEGER NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'New'
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "enquiryId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventLocation" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "eventTime" TEXT NOT NULL,
    "guests" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "vatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "vatRate" REAL NOT NULL DEFAULT 23,
    "netTotal" REAL NOT NULL DEFAULT 0,
    "vatTotal" REAL NOT NULL DEFAULT 0,
    "grossTotal" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Quote_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
