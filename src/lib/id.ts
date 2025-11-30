// Lightweight ID helper that works even when `crypto.randomUUID` is unavailable (Safari < 15.4, some WebViews).
export const generateId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random segment
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};
