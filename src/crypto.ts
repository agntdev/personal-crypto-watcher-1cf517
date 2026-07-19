// Shared utilities for the Personal Crypto Watcher bot.
// Injects a clock seam for testable time-based behavior.

// ── Injectable clock ──────────────────────────────────────────────────────────
let clockFn: () => Date = () => new Date();

/** Current time (injectable for tests). */
export function now(): Date {
  return clockFn();
}

/** Override the clock (test-only). */
export function _setClock(fn: () => Date): void {
  clockFn = fn;
}

// ── CoinGecko price API ──────────────────────────────────────────────────────
// Real integration against CoinGecko's free API (no key required).

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

/** Well-known coin id map for quick-add tickers. CoinGecko uses slugs, not tickers. */
const TICKER_TO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  TON: "the-open-network",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  DOT: "polkadot",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  LINK: "chainlink",
  USDT: "tether",
  USDC: "usd-coin",
  SHIB: "shiba-inu",
  LTC: "litecoin",
  TRX: "tron",
  DAI: "dai",
  UNI: "uniswap",
  ATOM: "cosmos",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  SUI: "sui",
  PEPE: "pepe",
  WIF: "dogwifcoin",
  FIL: "filecoin",
  NEAR: "near",
  AAVE: "aave",
  CRV: "curve-dao-token",
};

export function tickerToCoinId(ticker: string): string | null {
  return TICKER_TO_ID[ticker.toUpperCase()] ?? null;
}

/** All known tickers for quick-add suggestions. */
export const KNOWN_TICKERS = Object.keys(TICKER_TO_ID);

/** Known ticker display names for suggestions. */
export function tickerDisplayName(ticker: string): string {
  const names: Record<string, string> = {
    BTC: "Bitcoin",
    ETH: "Ethereum",
    TON: "Toncoin",
    SOL: "Solana",
    BNB: "BNB",
    XRP: "XRP",
    ADA: "Cardano",
    DOGE: "Dogecoin",
    DOT: "Polkadot",
    AVAX: "Avalanche",
    MATIC: "Polygon",
    LINK: "Chainlink",
    USDT: "Tether",
    USDC: "USD Coin",
    SHIB: "Shiba Inu",
    LTC: "Litecoin",
    TRX: "TRON",
    DAI: "Dai",
    UNI: "Uniswap",
    ATOM: "Cosmos",
    APT: "Aptos",
    ARB: "Arbitrum",
    OP: "Optimism",
    SUI: "Sui",
    PEPE: "Pepe",
    WIF: "dogwifcoin",
    FIL: "Filecoin",
    NEAR: "NEAR",
    AAVE: "Aave",
    CRV: "Curve DAO",
  };
  return names[ticker.toUpperCase()] ?? ticker.toUpperCase();
}

export interface CoinPrice {
  usd: number;
  usd_24h_change: number;
}

/** Fetch current price + 24h change for a single coin id from CoinGecko. */
export async function fetchPrice(coinId: string): Promise<CoinPrice | null> {
  try {
    const url = `${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
    const entry = data[coinId];
    if (!entry || entry.usd == null) return null;
    return { usd: entry.usd, usd_24h_change: entry.usd_24h_change ?? 0 };
  } catch {
    return null;
  }
}

/** Fetch prices for multiple coin ids in one call. */
export async function fetchPrices(
  coinIds: string[],
): Promise<Record<string, CoinPrice>> {
  if (coinIds.length === 0) return {};
  try {
    const url = `${COINGECKO_BASE}/simple/price?ids=${coinIds.map(encodeURIComponent).join(",")}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return {};
    const data = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
    const out: Record<string, CoinPrice> = {};
    for (const [id, entry] of Object.entries(data)) {
      if (entry && entry.usd != null) {
        out[id] = { usd: entry.usd, usd_24h_change: entry.usd_24h_change ?? 0 };
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Search CoinGecko for a ticker symbol, returning top matches. */
export async function searchTicker(
  query: string,
): Promise<Array<{ id: string; name: string; symbol: string; market_cap_rank: number | null }>> {
  try {
    const url = `${COINGECKO_BASE}/search?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      coins?: Array<{ id: string; name: string; symbol: string; market_cap_rank: number | null }>;
    };
    return (data.coins ?? []).slice(0, 5);
  } catch {
    return [];
  }
}

// ── Persistent storage helpers ───────────────────────────────────────────────
// Durable data uses a StorageAdapter (Redis in prod, in-memory in tests).
// We create a SEPARATE adapter instance for domain data vs session data.

import type { StorageAdapter } from "grammy";

// Domain storage adapter (injected at bot build time).
let domainStorage: StorageAdapter<Record<string, unknown>>;

/** Initialize the domain storage adapter. Called once by buildBot. */
export function initDomainStorage(
  adapter: StorageAdapter<Record<string, unknown>>,
): void {
  domainStorage = adapter;
}

/** Read a record from domain storage. */
export async function readRecord<T>(key: string): Promise<T | undefined> {
  if (!domainStorage) return undefined;
  const raw = await domainStorage.read(key);
  return raw as T | undefined;
}

/** Write a record to domain storage. */
export async function writeRecord<T>(key: string, value: T): Promise<void> {
  if (!domainStorage) return;
  await domainStorage.write(key, value as Record<string, unknown>);
}

/** Delete a record from domain storage. */
export async function deleteRecord(key: string): Promise<void> {
  if (!domainStorage) return;
  await domainStorage.delete(key);
}

// ── Domain data types ────────────────────────────────────────────────────────

export interface UserProfile {
  telegram_id: number;
  display_name: string;
  timezone: string;
  language: string;
  quiet_hours_start: number; // 0-23 (hour in user's timezone)
  quiet_hours_end: number;   // 0-23
  summary_enabled: boolean;
  summary_time: string; // "HH:MM" in user's timezone
  cooldown_duration: number; // minutes
}

export interface WatchlistItem {
  user_id: number;
  ticker_symbol: string;
  display_name: string;
  last_known_price: number;
  threshold_alert_enabled: boolean;
  threshold_value: number;
  threshold_direction: "above" | "below";
  percent_alert_enabled: boolean;
  percent_value: number;
  interval: number; // minutes between checks
  last_alert_timestamp: number;
  cooldown_state: number; // timestamp of last alert for this item
}

export interface AlertEvent {
  user_id: number;
  ticker: string;
  alert_type: "threshold" | "percent" | "summary";
  old_price: number;
  new_price: number;
  percent_change: number;
  timestamp: number;
}

export interface OwnerAnalytics {
  total_users: number;
  active_users_30d: number;
  top_alerts_by_ticker: Record<string, number>;
  alert_type_counts: Record<string, number>;
}

export interface UserIndex {
  user_ids: number[];
}

export interface WatchlistIndex {
  user_id: number;
  tickers: string[];
}

// ── User profile helpers ─────────────────────────────────────────────────────

export function userProfileKey(userId: number): string {
  return `user:${userId}`;
}

export function defaultUserProfile(userId: number, displayName: string): UserProfile {
  return {
    telegram_id: userId,
    display_name: displayName,
    timezone: "UTC",
    language: "en",
    quiet_hours_start: 22,
    quiet_hours_end: 7,
    summary_enabled: true,
    summary_time: "08:00",
    cooldown_duration: 120, // 2 hours
  };
}

export async function getOrCreateUserProfile(
  userId: number,
  displayName: string,
): Promise<UserProfile> {
  const existing = await readRecord<UserProfile>(userProfileKey(userId));
  if (existing) return existing;
  const profile = defaultUserProfile(userId, displayName);
  await writeRecord(userProfileKey(userId), profile);
  return profile;
}

export async function getUserProfile(userId: number): Promise<UserProfile | undefined> {
  return readRecord<UserProfile>(userProfileKey(userId));
}

// ── Watchlist helpers ────────────────────────────────────────────────────────

export function watchlistKey(userId: number): string {
  return `watchlist:${userId}`;
}

export function watchlistItemKey(userId: number, ticker: string): string {
  return `watchlist:${userId}:${ticker}`;
}

export async function getWatchlist(userId: number): Promise<WatchlistItem[]> {
  const index = await readRecord<WatchlistIndex>(watchlistKey(userId));
  if (!index || index.tickers.length === 0) return [];
  const items: WatchlistItem[] = [];
  for (const ticker of index.tickers) {
    const item = await readRecord<WatchlistItem>(watchlistItemKey(userId, ticker));
    if (item) items.push(item);
  }
  return items;
}

export async function addWatchlistItem(
  userId: number,
  ticker: string,
  displayName: string,
): Promise<WatchlistItem> {
  const item: WatchlistItem = {
    user_id: userId,
    ticker_symbol: ticker.toUpperCase(),
    display_name: displayName,
    last_known_price: 0,
    threshold_alert_enabled: false,
    threshold_value: 0,
    threshold_direction: "above",
    percent_alert_enabled: false,
    percent_value: 5,
    interval: 60,
    last_alert_timestamp: 0,
    cooldown_state: 0,
  };
  await writeRecord(watchlistItemKey(userId, ticker.toUpperCase()), item);
  // Update index
  const index = await readRecord<WatchlistIndex>(watchlistKey(userId)) ?? { user_id: userId, tickers: [] };
  if (!index.tickers.includes(ticker.toUpperCase())) {
    index.tickers.push(ticker.toUpperCase());
    await writeRecord(watchlistKey(userId), index);
  }
  return item;
}

export async function removeWatchlistItem(userId: number, ticker: string): Promise<boolean> {
  const key = watchlistItemKey(userId, ticker.toUpperCase());
  const existing = await readRecord<WatchlistItem>(key);
  if (!existing) return false;
  await deleteRecord(key);
  // Update index
  const index = await readRecord<WatchlistIndex>(watchlistKey(userId));
  if (index) {
    index.tickers = index.tickers.filter((t) => t !== ticker.toUpperCase());
    await writeRecord(watchlistKey(userId), index);
  }
  return true;
}

export async function updateWatchlistItem(
  userId: number,
  ticker: string,
  updates: Partial<WatchlistItem>,
): Promise<WatchlistItem | null> {
  const key = watchlistItemKey(userId, ticker.toUpperCase());
  const existing = await readRecord<WatchlistItem>(key);
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  await writeRecord(key, updated);
  return updated;
}

// ── Alert event helpers ──────────────────────────────────────────────────────

// Store all alerts for a user in one record (bounded per day, ~7 days retention).
export async function getUserAlertsInRange(
  userId: number,
  since: number,
): Promise<AlertEvent[]> {
  const data = await readRecord<{ entries: AlertEvent[] }>(`alerts_data:${userId}`);
  if (!data) return [];
  return data.entries.filter((e) => e.timestamp >= since);
}

export async function appendAlertEvent(event: AlertEvent): Promise<void> {
  const key = `alerts_data:${event.user_id}`;
  const data = await readRecord<{ entries: AlertEvent[] }>(key) ?? { entries: [] };
  data.entries.push(event);
  // Keep only last 7 days of alerts to bound the data
  const cutoff = now().getTime() - 7 * 24 * 60 * 60 * 1000;
  data.entries = data.entries.filter((e) => e.timestamp >= cutoff);
  await writeRecord(key, data);
}

// ── Owner analytics helpers ──────────────────────────────────────────────────

const ANALYTICS_KEY = "owner:analytics";
const USER_INDEX_KEY = "owner:user_index";

export async function getAllUserIds(): Promise<number[]> {
  const idx = await readRecord<UserIndex>(USER_INDEX_KEY);
  return idx?.user_ids ?? [];
}

export async function registerUser(userId: number): Promise<void> {
  const idx = await readRecord<UserIndex>(USER_INDEX_KEY) ?? { user_ids: [] };
  if (!idx.user_ids.includes(userId)) {
    idx.user_ids.push(userId);
    await writeRecord(USER_INDEX_KEY, idx);
  }
}

export async function computeAnalytics(): Promise<OwnerAnalytics> {
  const userIds = await getAllUserIds();
  const cutoff30d = now().getTime() - 30 * 24 * 60 * 60 * 1000;
  let activeCount = 0;
  const tickerAlerts: Record<string, number> = {};
  const typeCounts: Record<string, number> = { threshold: 0, percent: 0, summary: 0 };

  for (const uid of userIds) {
    const alerts = await getUserAlertsInRange(uid, cutoff30d);
    if (alerts.length > 0) activeCount++;
    for (const a of alerts) {
      tickerAlerts[a.ticker] = (tickerAlerts[a.ticker] ?? 0) + 1;
      typeCounts[a.alert_type] = (typeCounts[a.alert_type] ?? 0) + 1;
    }
  }

  const analytics: OwnerAnalytics = {
    total_users: userIds.length,
    active_users_30d: activeCount,
    top_alerts_by_ticker: tickerAlerts,
    alert_type_counts: typeCounts,
  };
  await writeRecord(ANALYTICS_KEY, analytics as unknown as Record<string, unknown>);
  return analytics;
}
