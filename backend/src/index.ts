import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { prisma } from "./prisma";

const app = express();

app.use(
  cors({
    // Allow all origins during development; tighten in production if needed
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const AUTH_SECRET = process.env.AUTH_SECRET || "change-me-in-env";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type UserRecord = {
  username: string;
  displayName: string;
  salt: string;
  hash: string;
};

// Password: "coolmike" for both users, hashed with scrypt and unique salts
const USERS: UserRecord[] = [
  {
    username: "chris_maguire",
    displayName: "Chris Maguire",
    salt: "de9fa4eda8b6a1cc65ec8ecdd4d25b2e",
    hash: "4bd7d76c525d5e28bba6849e636861efba61d0a6ddd860d3ab868db9a47e79ec6342be529eb5b3d64afb7aadecd87546863a53458f8166807056b2514efc8373",
  },
  {
    username: "michael_maguire",
    displayName: "Michael Maguire",
    salt: "caf1e29dc1a99ce9716e7fc235ca8e00",
    hash: "4a60c35a0ee749b2a736326ac5bcc3f6b1b2bcc5d61b66ddbf76fd1ae02cb61d6e9521dc0f0fa24b5a31885d4b9a3d1a789d06f091af6328b284cdb80e82de3f",
  },
];

const base64Url = (input: Buffer | string) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const signToken = (payload: object) => {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64Url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const signature = base64Url(crypto.createHmac("sha256", AUTH_SECRET).update(data).digest());
  return `${data}.${signature}`;
};

const verifyToken = (token?: string) => {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const data = `${header}.${body}`;
  const expected = base64Url(crypto.createHmac("sha256", AUTH_SECRET).update(data).digest());
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64").toString("utf8"));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
};

const verifyPassword = (password: string, saltHex: string, hashHex: string) => {
  const computed = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(hashHex, "hex"));
};

const setAuthCookie = (res: express.Response, token: string) => {
  res.cookie("auth_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: TOKEN_TTL_MS,
  });
};

const clearAuthCookie = (res: express.Response) => {
  res.clearCookie("auth_token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
  });
};

const requireAuth: express.RequestHandler = (req, res, next) => {
  const token = req.cookies?.auth_token || (req.headers.authorization || "").replace("Bearer ", "");
  const payload = verifyToken(token);
  if (!payload?.sub) return res.status(401).json({ error: "Unauthorized" });
  (req as any).user = payload;
  next();
};

// Simple health check endpoint for smoke tests
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "Booze backend alive 🍸" });
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });
  const user = USERS.find((u) => u.username.toLowerCase() === String(username).toLowerCase());
  if (!user || !verifyPassword(password, user.salt, user.hash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = signToken({
    sub: user.username,
    name: user.displayName,
    exp: Date.now() + TOKEN_TTL_MS,
  });
  setAuthCookie(res, token);
  res.json({ user: { username: user.username, displayName: user.displayName } });
});

app.post("/api/auth/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.get("/api/auth/me", (req, res) => {
  const token = req.cookies?.auth_token || (req.headers.authorization || "").replace("Bearer ", "");
  const payload = verifyToken(token);
  if (!payload?.sub) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json({ user: { username: payload.sub, displayName: payload.name || payload.sub } });
});

// GET all enquiries
app.get("/api/enquiries", requireAuth, async (_req, res) => {
  const enquiries = await prisma.enquiry.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(enquiries);
});

// POST create a new enquiry
app.post("/api/enquiries", requireAuth, async (req, res) => {
  try {
    const {
      name,
      email,
      service,
      eventType,
      location,
      preferredDate,
      preferredTime,
      guests,
      notes,
    } = req.body;

    const enquiry = await prisma.enquiry.create({
      data: {
        name,
        email,
        service,
        eventType,
        location,
        preferredDate: new Date(preferredDate),
        preferredTime,
        guests,
        notes,
      },
    });

    res.status(201).json(enquiry);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Failed to create enquiry" });
  }
});

const GOOGLE_MAPS_DISTANCE_URL =
  "https://maps.googleapis.com/maps/api/distancematrix/json";
const LITRES_PER_GALLON = 4.54609;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const DEFAULT_FUEL_PRICE_PER_LITRE = Number(
  process.env.DEFAULT_FUEL_PRICE_PER_LITRE || "1.75"
);

app.get("/api/travel-estimate", async (req, res) => {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      return res
        .status(500)
        .json({ error: "Google Maps API key not configured on server." });
    }

    const originAddress =
      (req.query.origin as string) ?? "7 Sunbury Ave Belfast BT5 5NU";
    const destinationAddress = req.query.destination as string;
    if (!destinationAddress) {
      return res
        .status(400)
        .json({ error: "destination query parameter is required" });
    }

    const params = new URLSearchParams({
      origins: originAddress,
      destinations: destinationAddress,
      key: GOOGLE_MAPS_API_KEY,
      units: "metric",
    });

    const response = await fetch(
      `${GOOGLE_MAPS_DISTANCE_URL}?${params.toString()}`
    );

    if (!response.ok) {
      return res.status(502).json({ error: "Unable to contact Google Maps" });
    }

    type DistanceElement = {
      status: string;
      distance?: { value: number };
      duration?: { value: number };
    };

    const data = (await response.json()) as {
      status: string;
      rows: Array<{ elements: DistanceElement[] }>;
      error_message?: string;
    };

    if (
      data.status !== "OK" ||
      !data.rows?.length ||
      !data.rows[0].elements?.length
    ) {
      return res
        .status(502)
        .json({ error: data.error_message || "Bad response from Google Maps" });
    }

    const element = data.rows[0].elements[0];
    if (element.status !== "OK" || !element.distance || !element.duration) {
      return res
        .status(404)
        .json({ error: "No route found between the locations" });
    }

    const distanceMeters = element.distance.value;
    const durationSeconds = element.duration.value;

    const oneWayDistanceMiles = distanceMeters / 1609.34;
    const oneWayDistanceKm = distanceMeters / 1000;
    const oneWayDurationMinutes = durationSeconds / 60;
    const roundTripDistanceMiles = oneWayDistanceMiles * 2;
    const roundTripDistanceKm = oneWayDistanceKm * 2;
    const roundTripDurationMinutes = oneWayDurationMinutes * 2;

    const mpg = req.query.mpg ? Number(req.query.mpg) : undefined;
    const petrolPrice = req.query.petrolPrice
      ? Number(req.query.petrolPrice)
      : undefined;
    const staffRate = req.query.staffRate
      ? Number(req.query.staffRate)
      : undefined;
    const fuelPricePerLitre =
      petrolPrice && petrolPrice > 0 ? petrolPrice : DEFAULT_FUEL_PRICE_PER_LITRE;

    let petrolCost: number | null = null;
    if (mpg && mpg > 0) {
      const gallonsUsed = roundTripDistanceMiles / mpg;
      const litresUsed = gallonsUsed * LITRES_PER_GALLON;
      petrolCost = Number((litresUsed * fuelPricePerLitre).toFixed(2));
    }

    let staffTravelCost: number | null = null;
    if (staffRate && staffRate > 0) {
      staffTravelCost = Number(
        ((roundTripDurationMinutes / 60) * staffRate).toFixed(2)
      );
    }

    res.json({
      provider: "google",
      fuelPricePerLitre,
      distance: {
        oneWay: {
          miles: oneWayDistanceMiles,
          km: oneWayDistanceKm,
          durationMinutes: oneWayDurationMinutes,
        },
        roundTrip: {
          miles: roundTripDistanceMiles,
          km: roundTripDistanceKm,
          durationMinutes: roundTripDurationMinutes,
        },
      },
      petrolCost,
      staffTravelCost,
    });
  } catch (error) {
    console.error("travel-estimate error", error);
    res.status(500).json({ error: "Unable to calculate travel estimate" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
