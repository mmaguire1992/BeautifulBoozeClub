import { Quote } from "@/types";
import { format } from "date-fns";

const formatDateTime = (dateString: string, timeString: string) => {
  const startRaw = new Date(`${dateString}T${timeString || "00:00"}`);
  if (isNaN(startRaw.getTime())) return null;
  const endRaw = new Date(startRaw.getTime() + 2 * 60 * 60 * 1000);
  const fmt = (date: Date) => format(date, "yyyyMMdd'T'HHmmss");
  return `${fmt(startRaw)}/${fmt(endRaw)}`;
};

const getCalendarId = () => {
  const embedUrl = import.meta.env.VITE_GOOGLE_CALENDAR_EMBED_URL;
  if (!embedUrl) return null;
  try {
    const parsed = new URL(embedUrl);
    const src = parsed.searchParams.get("src");
    return src || null;
  } catch {
    return null;
  }
};

export const openGoogleCalendarEvent = (quote: Quote) => {
  const dateRange = formatDateTime(quote.event.date, quote.event.time);
  if (!dateRange) return;
  const text = encodeURIComponent(`${quote.event.type} — ${quote.customer.name}`);
  const details = encodeURIComponent(`Guests: ${quote.event.guests}\nTotal: €${quote.totals.gross.toFixed(2)}`);
  const location = encodeURIComponent(quote.event.location);
  const sharedCalendarId = getCalendarId();
  const addParam = sharedCalendarId ? `&add=${encodeURIComponent(sharedCalendarId)}` : "";
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dateRange}&location=${location}&details=${details}${addParam}`;
  window.open(url, "_blank", "noreferrer");
};
