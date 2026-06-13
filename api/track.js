const { createHash } = require("node:crypto");

const MAX_EVENTS = 20;
const MAX_STORED_EVENTS = Number(process.env.SOCCERCARD_TRACK_MEMORY_LIMIT || 2000);
const MAX_DETAIL_BYTES = 12000;
const ALLOWED_EVENTS = new Set([
  "page_view",
  "screen_view",
  "form_start",
  "field_interaction",
  "generate_click",
  "loading_view",
  "result_view",
  "result_image_loaded",
  "result_asset_load_failed",
  "reading_expand",
  "reading_collapse",
  "share_click",
  "share_close",
  "poster_generated",
  "poster_download",
  "gallery_open",
  "gallery_page",
  "gallery_card_open",
  "library_back",
  "regen_click",
  "exit",
]);

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") return sendJson(res, { ok: true });
  if (req.method === "GET" && isAdminRequest(req)) {
    if (!isAuthorizedAdmin(req)) return sendJson(res, { error: "unauthorized" }, 401);
    return sendJson(res, buildAdminSnapshot(req));
  }
  if (req.method !== "POST") return sendJson(res, { error: "method_not_allowed" }, 405);

  try {
    const body = await readJsonBody(req);
    const rawEvents = Array.isArray(body?.events) ? body.events : [body];
    const events = rawEvents.slice(0, MAX_EVENTS)
      .map((event) => normalizeEvent(req, event))
      .filter(Boolean);

    if (!events.length) return sendJson(res, { error: "invalid_event" }, 400);
    recordEvents(events);

    console.log(JSON.stringify({
      type: "soccercard_analytics",
      accepted: events.length,
      events,
    }));

    await forwardEvents(events);
    return sendJson(res, { ok: true, accepted: events.length });
  } catch (error) {
    console.error(JSON.stringify({
      type: "soccercard_analytics_error",
      message: error?.message || "server_error",
    }));
    return sendJson(res, { error: "server_error" }, 500);
  }
};

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
  res.setHeader("Cache-Control", "no-store");
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function sendJson(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function getRequestUrl(req) {
  return new URL(req.url || "/", `https://${req.headers.host || "localhost"}`);
}

function isAdminRequest(req) {
  const url = getRequestUrl(req);
  return url.searchParams.get("admin") === "1" || url.searchParams.get("mode") === "admin";
}

function isAuthorizedAdmin(req) {
  const adminKey = process.env.SOCCERCARD_ADMIN_KEY || "";
  if (!adminKey) return true;
  const url = getRequestUrl(req);
  return req.headers["x-admin-key"] === adminKey || url.searchParams.get("key") === adminKey;
}

function normalizeEvent(req, event) {
  if (!event || typeof event !== "object") return null;
  const name = clampString(event.event, 64);
  if (!ALLOWED_EVENTS.has(name)) return null;
  const server = getServerContext(req);
  return {
    event: name,
    version: clampString(event.version, 64),
    visitorId: clampString(event.visitorId, 96),
    sessionId: clampString(event.sessionId, 96),
    screen: clampString(event.screen, 64),
    page: sanitizeObject(stripSensitiveKeys(event.page), 1200),
    source: sanitizeObject(stripSensitiveKeys(event.source), 1800),
    details: sanitizeObject(stripSensitiveKeys(event.details), MAX_DETAIL_BYTES),
    clientTs: clampString(event.clientTs, 40),
    serverTs: new Date().toISOString(),
    server,
  };
}

function getServerContext(req) {
  const ip = getClientIp(req);
  return {
    ipHash: hashValue(`${process.env.SOCCERCARD_TRACK_SALT || "soccercard-track-v1"}:${ip}`),
    country: clampString(req.headers["x-vercel-ip-country"], 16),
    region: clampString(req.headers["x-vercel-ip-country-region"], 64),
    city: clampString(req.headers["x-vercel-ip-city"], 128),
    userAgent: clampString(req.headers["user-agent"], 300),
    referer: clampString(req.headers.referer || req.headers.referrer, 600),
  };
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "";
}

function hashValue(value) {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 32);
}

function stripSensitiveKeys(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const blocked = new Set([
    "nickname",
    "birthdate",
    "birthtime",
    "birthplace",
    "gender",
    "input",
    "query",
    "landingQuery",
    "email",
    "phone",
  ]);
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !blocked.has(key)),
  );
}

function sanitizeObject(value, maxBytes) {
  if (!value || typeof value !== "object") return {};
  const parsed = JSON.parse(JSON.stringify(value));
  const text = JSON.stringify(parsed);
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return parsed;
  return { truncated: true };
}

function clampString(value, max) {
  if (typeof value !== "string") return "";
  return value.slice(0, max);
}

async function forwardEvents(events) {
  const url = process.env.SOCCERCARD_TRACK_WEBHOOK_URL;
  if (!url) return;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "soccercard_analytics", events }),
  });
  if (!response.ok) throw new Error(`tracking_webhook_failed:${response.status}`);
}

function getStore() {
  if (!globalThis.__soccercardAnalyticsMemory) {
    globalThis.__soccercardAnalyticsMemory = {
      createdAt: new Date().toISOString(),
      updatedAt: "",
      events: [],
    };
  }
  return globalThis.__soccercardAnalyticsMemory;
}

function recordEvents(events) {
  const store = getStore();
  store.events.push(...events);
  if (store.events.length > MAX_STORED_EVENTS) {
    store.events.splice(0, store.events.length - MAX_STORED_EVENTS);
  }
  store.updatedAt = new Date().toISOString();
}

function buildAdminSnapshot(req) {
  const url = getRequestUrl(req);
  const hours = Math.max(1, Math.min(168, Number(url.searchParams.get("hours") || 24)));
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const store = getStore();
  const events = store.events.filter((event) => Date.parse(event.serverTs || "") >= cutoff);
  const sessions = uniqueCount(events, "sessionId");
  const visitors = uniqueCount(events, "visitorId");
  const funnel = buildFunnel(events);
  const share = buildShareSummary(events);

  return {
    ok: true,
    mode: "memory",
    generatedAt: new Date().toISOString(),
    summary: {
      events: events.length,
      visitors,
      sessions,
      firstEventAt: events[0]?.serverTs || "",
      lastEventAt: events[events.length - 1]?.serverTs || "",
    },
    retention: {
      hours,
      storedEvents: store.events.length,
      maxEvents: MAX_STORED_EVENTS,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
    },
    funnel,
    topCards: rankCards(events),
    sources: rankSources(events),
    locations: rankLocations(events),
    share,
    recentEvents: events.slice(-40).reverse(),
  };
}

function uniqueCount(events, key) {
  return new Set(events.map((event) => event[key]).filter(Boolean)).size;
}

function buildFunnel(events) {
  const steps = [
    "page_view",
    "form_start",
    "generate_click",
    "loading_view",
    "result_view",
    "share_click",
    "poster_generated",
    "poster_download",
  ];
  const entrySessions = Math.max(1, uniqueSessionsForEvent(events, steps[0]).size);
  let previous = entrySessions;
  return steps.map((event) => {
    const sessions = uniqueSessionsForEvent(events, event).size;
    const rateOfEntry = Math.round((sessions / entrySessions) * 100);
    const dropoffFromPrevious = previous ? Math.max(0, Math.round(((previous - sessions) / previous) * 100)) : 0;
    previous = sessions;
    return { event, sessions, rateOfEntry, dropoffFromPrevious };
  });
}

function uniqueSessionsForEvent(events, eventName) {
  return new Set(
    events
      .filter((event) => event.event === eventName)
      .map((event) => event.sessionId)
      .filter(Boolean),
  );
}

function buildShareSummary(events) {
  return {
    clicks: countEvent(events, "share_click"),
    posters: countEvent(events, "poster_generated"),
    downloads: countEvent(events, "poster_download"),
    inboundSessions: uniqueCount(events.filter((event) => event.source?.parentShareId), "sessionId"),
  };
}

function countEvent(events, eventName) {
  return events.filter((event) => event.event === eventName).length;
}

function rankCards(events) {
  const counts = new Map();
  events
    .filter((event) => ["generate_click", "result_view", "poster_generated", "gallery_card_open"].includes(event.event))
    .forEach((event) => {
      const role = event.details?.role || "";
      const cardId = event.details?.cardId || "";
      const key = role || (cardId ? `#${cardId}` : "");
      if (!key) return;
      const current = counts.get(key) || { label: key, count: 0, meta: cardId ? `Card ${cardId}` : "" };
      current.count += 1;
      counts.set(key, current);
    });
  return rankMap(counts);
}

function rankSources(events) {
  const counts = new Map();
  events.forEach((event) => {
    const source = event.source || {};
    const label = source.utmSource || hostname(source.referrer) || hostname(event.server?.referer) || "direct";
    const current = counts.get(label) || { label, count: 0, meta: source.utmMedium || "" };
    current.count += 1;
    counts.set(label, current);
  });
  return rankMap(counts);
}

function rankLocations(events) {
  const counts = new Map();
  events.forEach((event) => {
    const server = event.server || {};
    const label = [server.country, server.region, server.city].filter(Boolean).join(" / ") || "unknown";
    const current = counts.get(label) || { label, count: 0, meta: "" };
    current.count += 1;
    counts.set(label, current);
  });
  return rankMap(counts);
}

function rankMap(counts) {
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function hostname(value) {
  if (!value) return "";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return clampString(String(value), 80);
  }
}
