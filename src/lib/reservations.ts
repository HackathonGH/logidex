/** Shared reservation rules (mirrors the database checks so the UI can preview them). */
export const TZ = "Europe/Madrid";
export const ORDER_RE = /^4500[0-9]{6}$/;
export const MAX_ORDERS = 6;
export const MAX_PALLETS = 66;

/** Locked unload duration in minutes from total pallets; null when not allowed. */
export function durationForPallets(p: number): number | null {
  if (p >= 1 && p <= 15) return 30;
  if (p >= 16 && p <= 19) return 45;
  if (p >= 20 && p <= 33) return 60;
  if (p >= 34 && p <= 66) return 120;
  return null;
}

export type OrderLine = { order_number: string; supplier: string; pallets: number };

/** Returns an error key, or null when the order list is valid. */
export function validateOrders(orders: OrderLine[]): string | null {
  if (orders.length < 1 || orders.length > MAX_ORDERS) return "ERR_ORDERS_COUNT";
  for (const o of orders) {
    if (!ORDER_RE.test(o.order_number)) return "ERR_ORDER_FORMAT";
    if (!o.supplier.trim()) return "ERR_REQUIRED";
    if (!Number.isInteger(o.pallets) || o.pallets < 1 || o.pallets > MAX_PALLETS) return "ERR_PALLETS";
  }
  if (new Set(orders.map((o) => o.order_number)).size !== orders.length) return "ERR_ORDER_DUP";
  if (new Set(orders.map((o) => o.supplier.trim().toLowerCase())).size > 6) return "ERR_SUPPLIERS";
  if (orders.reduce((s, o) => s + o.pallets, 0) > MAX_PALLETS) return "ERR_PALLETS";
  return null;
}

/** 15-minute slots of a day: "00:00" … "23:45". */
export const TIME_SLOTS = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);

function madridParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value])) as Record<"year" | "month" | "day" | "hour" | "minute", string>;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Madrid local date ("YYYY-MM-DD") and time ("HH:MM") of an instant. */
export const toMadrid = (iso: string | Date) => madridParts(new Date(iso));

/** Converts a Madrid wall-clock date+time to a UTC ISO string (DST aware). */
export function madridToISO(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const target = Date.UTC(y!, m! - 1, d!, hh!, mm!);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const p = madridParts(new Date(guess));
    const [py, pm, pd] = p.date.split("-").map(Number);
    const [ph, pmin] = p.time.split(":").map(Number);
    guess += target - Date.UTC(py!, pm! - 1, pd!, ph!, pmin!);
  }
  return new Date(guess).toISOString();
}

export function fmtDateTime(iso: string, lang: string) {
  return new Intl.DateTimeFormat(lang, { timeZone: TZ, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}
export function fmtTime(iso: string) {
  return toMadrid(iso).time;
}

/** Extracts a known rule code (ERR_*) from a database error message. */
export function errorCode(msg: string | undefined): string {
  const m = msg?.match(/ERR_[A-Z_]+/);
  if (m) return m[0];
  if (msg?.includes("forbidden")) return "ERR_FORBIDDEN";
  return "ERR_UNKNOWN";
}
