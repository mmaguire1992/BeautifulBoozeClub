const API_BASE =
  import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "") ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:4000");

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
  const response = await fetch(url);
  if (!response.ok) {
    let message = "Travel estimate failed";
    try {
      const errorData = await response.json();
      if (typeof errorData.error === "string") {
        message = errorData.error;
      }
    } catch {
      // ignore json parsing errors
    }
    throw new Error(message);
  }
  return response.json();
};
