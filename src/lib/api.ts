import type { Enquiry, Quote, Booking, CostingData } from "@/types";

// Use relative URLs in the browser to avoid any malformed host concatenation.
const API_BASE =
  typeof window !== "undefined"
    ? ""
    : (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:4000");

const apiFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data && (data.error || data.message)) || res.statusText || "Request failed";
    throw new Error(message);
  }
  return data as T;
};

export type TravelEstimate = {
  provider: string;
  fuelPricePerLitre: number;
  distance: {
    oneWay: { miles: number; km: number; durationMinutes: number };
    roundTrip: { miles: number; km: number; durationMinutes: number };
  };
  petrolCost: number | null;
  staffTravelCost: number | null;
};

export const fetchTravelEstimate = async ({
  origin,
  destination,
  petrolPrice,
  mpg,
  staffRate,
}: {
  origin: string;
  destination: string;
  petrolPrice?: number;
  mpg?: number;
  staffRate?: number;
}): Promise<TravelEstimate> => {
  const params = new URLSearchParams({
    origin,
    destination,
  });

  if (petrolPrice && petrolPrice > 0) {
    params.append("petrolPrice", String(petrolPrice));
  }
  if (mpg && mpg > 0) {
    params.append("mpg", String(mpg));
  }
  if (staffRate && staffRate > 0) {
    params.append("staffRate", String(staffRate));
  }

  const url = `${API_BASE}/api/travel-estimate?${params.toString()}`;
  return apiFetch<TravelEstimate>(url);
};

export type CreateEnquiryInput = {
  name: string;
  email: string;
  service: string;
  eventType: string;
  location: string;
  preferredDate: string;
  preferredTime: string;
  guests: number;
  notes?: string;
};

export const fetchEnquiries = async (): Promise<Enquiry[]> => apiFetch("/api/enquiries");

export const createEnquiry = async (body: CreateEnquiryInput): Promise<Enquiry> =>
  apiFetch("/api/enquiries", { method: "POST", body: JSON.stringify(body) });
export const deleteEnquiry = async (id: string) =>
  apiFetch<{ ok: boolean }>(`/api/enquiries/${id}`, { method: "DELETE" });

// Quotes
export type QuotePayload = Omit<Quote, "id" | "createdAt" | "updatedAt"> & { id?: string };

export const fetchQuotes = async (): Promise<Quote[]> => apiFetch("/api/quotes");
export const fetchQuote = async (id: string): Promise<Quote> => apiFetch(`/api/quotes/${id}`);
export const createQuote = async (body: QuotePayload): Promise<Quote> =>
  apiFetch("/api/quotes", { method: "POST", body: JSON.stringify(body) });
export const updateQuote = async (id: string, body: QuotePayload): Promise<Quote> =>
  apiFetch(`/api/quotes/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteQuote = async (id: string) => apiFetch<{ ok: boolean }>(`/api/quotes/${id}`, { method: "DELETE" });
export const acceptQuote = async (id: string) =>
  apiFetch<{ quote: Quote; booking: Booking | null }>(`/api/quotes/${id}/accept`, { method: "POST" });
export const updateQuoteStatus = async (id: string, status: Quote["status"]) =>
  apiFetch<Quote>(`/api/quotes/${id}/status`, { method: "POST", body: JSON.stringify({ status }) });

// Costing
export const fetchCosting = async (quoteId: string) =>
  apiFetch<{ data: CostingData | null }>(`/api/quotes/${quoteId}/costing`);
export const saveCosting = async (quoteId: string, data: CostingData) =>
  apiFetch(`/api/quotes/${quoteId}/costing`, { method: "PUT", body: JSON.stringify({ data }) });

// Bookings
export const fetchBookings = async (): Promise<Booking[]> => apiFetch("/api/bookings");
export const updateBooking = async (
  id: string,
  body: Partial<Pick<Booking, "paymentStatus" | "depositPaid" | "status">>
) => apiFetch<Booking>(`/api/bookings/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteBooking = async (id: string) =>
  apiFetch<{ ok: boolean }>(`/api/bookings/${id}`, { method: "DELETE" });
