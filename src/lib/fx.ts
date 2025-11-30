type FxCache = { rate: number; fetchedAt: string };
const FX_STORAGE_KEY = "booze-club-fx";

const readCache = (): FxCache | null => {
  try {
    const raw = localStorage.getItem(FX_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FxCache;
  } catch {
    return null;
  }
};

const writeCache = (data: FxCache) => {
  try {
    localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
};

export const getEurToGbpRate = async (): Promise<{ rate: number; fetchedAt: string; source: string }> => {
  const fallback = { rate: 0.85, fetchedAt: new Date().toISOString(), source: "Fallback" };
  const cached = readCache();
  try {
    const res = await fetch("https://api.exchangerate.host/latest?base=EUR&symbols=GBP");
    if (!res.ok) throw new Error("Failed FX fetch");
    const data = await res.json();
    const rate = Number(data?.rates?.GBP);
    if (!rate || !Number.isFinite(rate)) throw new Error("Invalid FX rate");
    const payload = { rate, fetchedAt: new Date().toISOString(), source: "exchangerate.host" };
    writeCache(payload);
    return payload;
  } catch {
    if (cached) return { ...cached, source: `${cached.source || "Cached"}` };
    return fallback;
  }
};
