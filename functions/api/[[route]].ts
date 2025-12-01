import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { handle } from "hono/cloudflare-pages";

type Bindings = {
  DB: D1Database;
  AUTH_SECRET: string;
  COOKIE_SECURE?: string;
  GOOGLE_MAPS_API_KEY?: string;
  DEFAULT_FUEL_PRICE_PER_LITRE?: string;
};

type TokenPayload = { sub: string; name?: string; exp: number };
type UserRecord = { username: string; displayName: string; salt: string; hash: string };
type QuoteRow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  enquiryId?: string | null;
  customer: string;
  event: string;
  lines: string;
  vat: string;
  totals: string;
};
type BookingRow = {
  id: string;
  quoteId?: string | null;
  customer: string;
  event: string;
  total: number;
  depositPaid: number;
  paymentStatus: string;
  status: string;
  createdAt: string;
};

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const encoder = new TextEncoder();

// Password: "coolmike" for both users, hashed as sha256(password + salt)
const USERS: UserRecord[] = [
  {
    username: "chris_maguire",
    displayName: "Chris Maguire",
    salt: "de9fa4eda8b6a1cc65ec8ecdd4d25b2e",
    hash: "3497af0007feae3c9c7d741e61d4df0e95ae9c64f170f0e13bc020ae7c86af87",
  },
  {
    username: "michael_maguire",
    displayName: "Michael Maguire",
    salt: "caf1e29dc1a99ce9716e7fc235ca8e00",
    hash: "653139539a47f1bf5c68bff7a05d3ae5b88d3a38c34fc49a9c52be330620eb9c",
  },
];

const base64UrlEncode = (input: ArrayBuffer | string) => {
  const bytes = typeof input === "string" ? encoder.encode(input) : new Uint8Array(input);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

const hmacSha256 = async (secret: string, data: string) => {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return new Uint8Array(sig);
};

const signToken = async (payload: TokenPayload, secret: string) => {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const signature = base64UrlEncode(await hmacSha256(secret, data));
  return `${data}.${signature}`;
};

const verifyToken = async (token?: string, secret?: string) => {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const data = `${header}.${body}`;
  const expected = base64UrlEncode(await hmacSha256(secret, data));
  if (!timingSafeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload as TokenPayload;
  } catch {
    return null;
  }
};

const hashPassword = async (password: string, saltHex: string) => {
  const data = encoder.encode(password + saltHex);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const verifyPassword = async (password: string, user: UserRecord) => {
  const computed = await hashPassword(password, user.salt);
  return timingSafeEqual(computed, user.hash);
};

const parseJSON = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const requireAuth = async (c: Hono.Context<{ Bindings: Bindings; Variables: { user?: TokenPayload } }>, next: Function) => {
  const cookieToken = getCookie(c, "auth_token");
  const bearer = c.req.header("authorization")?.replace("Bearer ", "");
  const token = cookieToken || bearer;
  const payload = await verifyToken(token, c.env.AUTH_SECRET);
  if (!payload?.sub) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("user", payload);
  await next();
};

const secureCookies = (env: Bindings) => env.COOKIE_SECURE !== "false";

const app = new Hono<{ Bindings: Bindings; Variables: { user?: TokenPayload } }>();

const toQuote = (row: QuoteRow) => ({
  id: row.id,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  status: row.status,
  enquiryId: row.enquiryId || undefined,
  customer: parseJSON(row.customer, {}),
  event: parseJSON(row.event, {}),
  lines: parseJSON(row.lines, []),
  vat: parseJSON(row.vat, {}),
  totals: parseJSON(row.totals, {}),
});

const toBooking = (row: BookingRow) => ({
  id: row.id,
  quoteId: row.quoteId || undefined,
  customer: parseJSON(row.customer, {}),
  event: parseJSON(row.event, {}),
  total: row.total,
  depositPaid: row.depositPaid ?? 0,
  paymentStatus: row.paymentStatus as "Pending" | "DepositPaid" | "PaidInFull",
  status: row.status as "Confirmed" | "Completed" | "Cancelled",
  createdAt: row.createdAt,
});

// Health
app.get("/api/health", (c) => c.json({ status: "ok", message: "Booze backend alive 🍸" }));

// Auth
app.post("/api/auth/login", async (c) => {
  const { username, password } = (await c.req.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };
  if (!username || !password) return c.json({ error: "Username and password required" }, 400);
  const user = USERS.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!user || !(await verifyPassword(password, user))) {
    return c.json({ error: "Invalid credentials" }, 401);
  }
  const token = await signToken(
    {
      sub: user.username,
      name: user.displayName,
      exp: Date.now() + TOKEN_TTL_MS,
    },
    c.env.AUTH_SECRET
  );
  setCookie(c, "auth_token", token, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: secureCookies(c.env),
    maxAge: TOKEN_TTL_MS / 1000,
  });
  return c.json({ user: { username: user.username, displayName: user.displayName } });
});

app.post("/api/auth/logout", (c) => {
  deleteCookie(c, "auth_token", {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: secureCookies(c.env),
  });
  return c.json({ ok: true });
});

app.get("/api/auth/me", async (c) => {
  const cookieToken = getCookie(c, "auth_token");
  const bearer = c.req.header("authorization")?.replace("Bearer ", "");
  const token = cookieToken || bearer;
  const payload = await verifyToken(token, c.env.AUTH_SECRET);
  if (!payload?.sub) return c.json({ error: "Unauthorized" }, 401);
  return c.json({ user: { username: payload.sub, displayName: payload.name || payload.sub } });
});

// Enquiries
app.get("/api/enquiries", requireAuth, async (c) => {
  const result = await c.env.DB.prepare(
    "SELECT id, createdAt, name, email, service, eventType, location, preferredDate, preferredTime, guests, notes, status FROM Enquiry ORDER BY datetime(createdAt) DESC"
  ).all();
  return c.json(result.results || []);
});

app.post("/api/enquiries", requireAuth, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    service?: string;
    eventType?: string;
    location?: string;
    preferredDate?: string;
    preferredTime?: string;
    guests?: number;
    notes?: string;
  };

  const requiredFields = ["name", "email", "service", "eventType", "location", "preferredDate", "preferredTime", "guests"] as const;
  const missing = requiredFields.filter((key) => !(body as any)[key]);
  if (missing.length) {
    return c.json({ error: `Missing fields: ${missing.join(", ")}` }, 400);
  }

  const date = new Date(body.preferredDate!);
  if (Number.isNaN(date.getTime())) {
    return c.json({ error: "preferredDate must be a valid date" }, 400);
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO Enquiry (id, createdAt, name, email, service, eventType, location, preferredDate, preferredTime, guests, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New')`
  )
    .bind(
      id,
      createdAt,
      body.name!,
      body.email!,
      body.service!,
      body.eventType!,
      body.location!,
      date.toISOString(),
      body.preferredTime!,
      Number(body.guests),
      body.notes || null
    )
    .run();

  return c.json({
    id,
    createdAt,
    name: body.name,
    email: body.email,
    service: body.service,
    eventType: body.eventType,
    location: body.location,
    preferredDate: date.toISOString(),
    preferredTime: body.preferredTime,
    guests: Number(body.guests),
    notes: body.notes || null,
    status: "New",
  });
});

// Travel estimate (Google Distance Matrix)
const GOOGLE_MAPS_DISTANCE_URL = "https://maps.googleapis.com/maps/api/distancematrix/json";
const LITRES_PER_GALLON = 4.54609;

app.get("/api/travel-estimate", async (c) => {
  try {
    if (!c.env.GOOGLE_MAPS_API_KEY) {
      return c.json({ error: "Google Maps API key not configured on server." }, 500);
    }

    const originAddress = c.req.query("origin") ?? "7 Sunbury Ave Belfast BT5 5NU";
    const destinationAddress = c.req.query("destination");
    if (!destinationAddress) {
      return c.json({ error: "destination query parameter is required" }, 400);
    }

    const params = new URLSearchParams({
      origins: originAddress,
      destinations: destinationAddress,
      key: c.env.GOOGLE_MAPS_API_KEY,
      units: "metric",
    });

    const response = await fetch(`${GOOGLE_MAPS_DISTANCE_URL}?${params.toString()}`);
    if (!response.ok) {
      return c.json({ error: "Unable to contact Google Maps" }, 502);
    }

    const data = (await response.json()) as {
      status: string;
      rows: Array<{ elements: Array<{ status: string; distance?: { value: number }; duration?: { value: number } }> }>;
      error_message?: string;
    };

    if (data.status !== "OK" || !data.rows?.length || !data.rows[0].elements?.length) {
      return c.json({ error: data.error_message || "Bad response from Google Maps" }, 502);
    }

    const element = data.rows[0].elements[0];
    if (element.status !== "OK" || !element.distance || !element.duration) {
      return c.json({ error: "No route found between the locations" }, 404);
    }

    const distanceMeters = element.distance.value;
    const durationSeconds = element.duration.value;

    const oneWayDistanceMiles = distanceMeters / 1609.34;
    const oneWayDistanceKm = distanceMeters / 1000;
    const oneWayDurationMinutes = durationSeconds / 60;
    const roundTripDistanceMiles = oneWayDistanceMiles * 2;
    const roundTripDistanceKm = oneWayDistanceKm * 2;
    const roundTripDurationMinutes = oneWayDurationMinutes * 2;

    const DEFAULT_FUEL_PRICE_PER_LITRE = Number(c.env.DEFAULT_FUEL_PRICE_PER_LITRE || "1.75");
    const mpg = c.req.query("mpg") ? Number(c.req.query("mpg")) : undefined;
    const petrolPrice = c.req.query("petrolPrice") ? Number(c.req.query("petrolPrice")) : undefined;
    const staffRate = c.req.query("staffRate") ? Number(c.req.query("staffRate")) : undefined;
    const fuelPricePerLitre = petrolPrice && petrolPrice > 0 ? petrolPrice : DEFAULT_FUEL_PRICE_PER_LITRE;

    let petrolCost: number | null = null;
    if (mpg && mpg > 0) {
      const gallonsUsed = roundTripDistanceMiles / mpg;
      const litresUsed = gallonsUsed * LITRES_PER_GALLON;
      petrolCost = Number((litresUsed * fuelPricePerLitre).toFixed(2));
    }

    let staffTravelCost: number | null = null;
    if (staffRate && staffRate > 0) {
      staffTravelCost = Number(((roundTripDurationMinutes / 60) * staffRate).toFixed(2));
    }

    return c.json({
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
    return c.json({ error: "Unable to calculate travel estimate" }, 500);
  }
});

app.delete("/api/enquiries/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const res = await c.env.DB.prepare("DELETE FROM Enquiry WHERE id = ?").bind(id).run();
  if (res.meta.changes === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// Quotes CRUD
app.get("/api/quotes", requireAuth, async (c) => {
  const res = await c.env.DB.prepare(
    "SELECT id, createdAt, updatedAt, status, enquiryId, customer, event, lines, vat, totals FROM Quote ORDER BY datetime(createdAt) DESC"
  ).all<QuoteRow>();
  return c.json((res.results || []).map(toQuote));
});

app.get("/api/quotes/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const res = await c.env.DB.prepare(
    "SELECT id, createdAt, updatedAt, status, enquiryId, customer, event, lines, vat, totals FROM Quote WHERE id = ?"
  )
    .bind(id)
    .first<QuoteRow>();
  if (!res) return c.json({ error: "Not found" }, 404);
  return c.json(toQuote(res));
});

app.post("/api/quotes", requireAuth, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as any;
  const required = ["customer", "event", "lines", "vat", "totals"];
  const missing = required.filter((k) => !(k in body));
  if (missing.length) return c.json({ error: `Missing fields: ${missing.join(", ")}` }, 400);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const status = body.status || "Draft";
  await c.env.DB.prepare(
    `INSERT INTO Quote (id, createdAt, updatedAt, status, enquiryId, customer, event, lines, vat, totals)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      now,
      now,
      status,
      body.enquiryId || null,
      JSON.stringify(body.customer),
      JSON.stringify(body.event),
      JSON.stringify(body.lines),
      JSON.stringify(body.vat),
      JSON.stringify(body.totals)
    )
    .run();
  return c.json({
    id,
    createdAt: now,
    updatedAt: now,
    status,
    enquiryId: body.enquiryId || null,
    customer: body.customer,
    event: body.event,
    lines: body.lines,
    vat: body.vat,
    totals: body.totals,
  });
});

app.put("/api/quotes/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as any;
  const now = new Date().toISOString();
  const res = await c.env.DB.prepare(
    "UPDATE Quote SET status = coalesce(?, status), enquiryId = coalesce(?, enquiryId), customer = ?, event = ?, lines = ?, vat = ?, totals = ?, updatedAt = ? WHERE id = ?"
  )
    .bind(
      body.status || null,
      "enquiryId" in body ? body.enquiryId || null : null,
      JSON.stringify(body.customer ?? {}),
      JSON.stringify(body.event ?? {}),
      JSON.stringify(body.lines ?? []),
      JSON.stringify(body.vat ?? {}),
      JSON.stringify(body.totals ?? {}),
      now,
      id
    )
    .run();
  if (res.success && res.meta.changes === 0) return c.json({ error: "Not found" }, 404);
  const updated = await c.env.DB.prepare(
    "SELECT id, createdAt, updatedAt, status, enquiryId, customer, event, lines, vat, totals FROM Quote WHERE id = ?"
  )
    .bind(id)
    .first<QuoteRow>();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(toQuote(updated));
});

app.delete("/api/quotes/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM Costing WHERE quoteId = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM Booking WHERE quoteId = ?").bind(id).run();
  const res = await c.env.DB.prepare("DELETE FROM Quote WHERE id = ?").bind(id).run();
  if (res.meta.changes === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// Quote status + accept -> booking
app.post("/api/quotes/:id/status", requireAuth, async (c) => {
  const id = c.req.param("id");
  const { status } = (await c.req.json().catch(() => ({}))) as { status?: string };
  if (!status) return c.json({ error: "status required" }, 400);
  const now = new Date().toISOString();
  await c.env.DB.prepare("UPDATE Quote SET status = ?, updatedAt = ? WHERE id = ?").bind(status, now, id).run();
  const updated = await c.env.DB.prepare(
    "SELECT id, createdAt, updatedAt, status, enquiryId, customer, event, lines, vat, totals FROM Quote WHERE id = ?"
  )
    .bind(id)
    .first<QuoteRow>();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(toQuote(updated));
});

app.post("/api/quotes/:id/accept", requireAuth, async (c) => {
  const id = c.req.param("id");
  const now = new Date().toISOString();
  const quoteRow = await c.env.DB.prepare(
    "SELECT id, createdAt, updatedAt, status, enquiryId, customer, event, lines, vat, totals FROM Quote WHERE id = ?"
  )
    .bind(id)
    .first<QuoteRow>();
  if (!quoteRow) return c.json({ error: "Not found" }, 404);
  await c.env.DB.prepare("UPDATE Quote SET status = 'Accepted', updatedAt = ? WHERE id = ?").bind(now, id).run();
  const bookingId = crypto.randomUUID();
  const quote = toQuote(quoteRow);
  await c.env.DB.prepare(
    `INSERT INTO Booking (id, quoteId, customer, event, total, depositPaid, paymentStatus, status, createdAt)
     VALUES (?, ?, ?, ?, ?, 0, 'Pending', 'Confirmed', ?)`
  )
    .bind(
      bookingId,
      quote.id,
      JSON.stringify(quote.customer),
      JSON.stringify(quote.event),
      Number(quote.totals?.gross ?? 0),
      now
    )
    .run();
  const updatedQuote = { ...quote, status: "Accepted", updatedAt: now };
  const bookingRow = await c.env.DB.prepare(
    "SELECT id, quoteId, customer, event, total, depositPaid, paymentStatus, status, createdAt FROM Booking WHERE id = ?"
  )
    .bind(bookingId)
    .first<BookingRow>();
  return c.json({ quote: updatedQuote, booking: bookingRow ? toBooking(bookingRow) : null });
});

// Costing
app.get("/api/quotes/:id/costing", requireAuth, async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT data FROM Costing WHERE quoteId = ?").bind(id).first<{ data: string }>();
  if (!row) return c.json({ data: null });
  return c.json({ data: parseJSON(row.data, null) });
});

app.put("/api/quotes/:id/costing", requireAuth, async (c) => {
  const id = c.req.param("id");
  const { data } = (await c.req.json().catch(() => ({}))) as { data?: unknown };
  if (!data) return c.json({ error: "data required" }, 400);
  const existing = await c.env.DB.prepare("SELECT id FROM Costing WHERE quoteId = ?").bind(id).first<{ id: string }>();
  if (existing) {
    await c.env.DB.prepare("UPDATE Costing SET data = ? WHERE quoteId = ?")
      .bind(JSON.stringify(data), id)
      .run();
  } else {
    await c.env.DB.prepare("INSERT INTO Costing (id, quoteId, data) VALUES (?, ?, ?)")
      .bind(crypto.randomUUID(), id, JSON.stringify(data))
      .run();
  }
  return c.json({ ok: true });
});

// Bookings
app.get("/api/bookings", requireAuth, async (c) => {
  const res = await c.env.DB.prepare(
    "SELECT id, quoteId, customer, event, total, depositPaid, paymentStatus, status, createdAt FROM Booking ORDER BY datetime(createdAt) DESC"
  ).all<BookingRow>();
  return c.json((res.results || []).map(toBooking));
});

app.patch("/api/bookings/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const { paymentStatus, depositPaid, status } = (await c.req.json().catch(() => ({}))) as {
    paymentStatus?: string;
    depositPaid?: number;
    status?: string;
  };
  const res = await c.env.DB.prepare(
    "UPDATE Booking SET paymentStatus = coalesce(?, paymentStatus), depositPaid = coalesce(?, depositPaid), status = coalesce(?, status) WHERE id = ?"
  )
    .bind(paymentStatus || null, depositPaid ?? null, status || null, id)
    .run();
  if (res.meta.changes === 0) return c.json({ error: "Not found" }, 404);
  const row = await c.env.DB.prepare(
    "SELECT id, quoteId, customer, event, total, depositPaid, paymentStatus, status, createdAt FROM Booking WHERE id = ?"
  )
    .bind(id)
    .first<BookingRow>();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(toBooking(row));
});

app.delete("/api/bookings/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const res = await c.env.DB.prepare("DELETE FROM Booking WHERE id = ?").bind(id).run();
  if (res.meta.changes === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

export const onRequest = handle(app);
