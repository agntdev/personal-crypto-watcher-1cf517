import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  inlineButton,
  inlineKeyboard,
  registerMainMenuItem,
} from "../toolkit/index.js";
import {
  fetchPrice,
  fetchPrices,
  getWatchlist,
  tickerToCoinId,
  tickerDisplayName,
} from "../crypto.js";

registerMainMenuItem({ label: "💰 Price", data: "price:menu", order: 20 });

const composer = new Composer<Ctx>();

function formatPrice(usd: number): string {
  if (usd >= 1000) return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(6)}`;
}

function formatChange(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

composer.callbackQuery("price:menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const items = await getWatchlist(userId);
  if (items.length === 0) {
    await ctx.editMessageText(
      "No coins to check — add some to your watchlist first.",
      { reply_markup: inlineKeyboard([[inlineButton("➕ Add coins", "watchlist:show"), inlineButton("⬅️ Back to menu", "menu:main")]]) },
    );
    return;
  }

  // Fetch prices for all watchlist items
  const coinIds = items.map((i) => tickerToCoinId(i.ticker_symbol)).filter(Boolean) as string[];
  const prices = await fetchPrices(coinIds);

  const lines: string[] = ["💰 Current prices:\n"];
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

  for (const item of items) {
    const coinId = tickerToCoinId(item.ticker_symbol);
    const price = coinId ? prices[coinId] : null;
    if (price) {
      lines.push(
        `${item.display_name}: ${formatPrice(price.usd)} (${formatChange(price.usd_24h_change)})`
      );
    } else {
      lines.push(`${item.display_name}: price unavailable`);
    }
    buttons.push([inlineButton(`📊 ${item.display_name}`, `price:detail:${item.ticker_symbol}`)]);
  }

  buttons.push([inlineButton("🔄 Refresh", "price:menu")]);
  buttons.push([inlineButton("⬅️ Back to menu", "menu:main")]);

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard(buttons),
  });
});

composer.callbackQuery(/^price:detail:(.+)$/, async (ctx) => {
  const match = ctx.match;
  if (!match) return;
  const ticker = match[1].toUpperCase();
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCallbackQuery();

  const coinId = tickerToCoinId(ticker);
  if (!coinId) {
    await ctx.editMessageText(`Couldn't find price data for ${ticker}.`, {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to prices", "price:menu")]]),
    });
    return;
  }

  const price = await fetchPrice(coinId);
  if (!price) {
    await ctx.editMessageText(`Couldn't fetch the price for ${tickerDisplayName(ticker)}. Try again in a moment.`, {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to prices", "price:menu")]]),
    });
    return;
  }

  const lines = [
    `📊 ${tickerDisplayName(ticker)} (${ticker})`,
    "",
    `Price: ${formatPrice(price.usd)}`,
    `24h change: ${formatChange(price.usd_24h_change)}`,
  ];

  // Check if this should trigger an alert
  const items = await getWatchlist(userId);
  const item = items.find((i) => i.ticker_symbol === ticker);
  if (item) {
    // Check threshold alert
    if (item.threshold_alert_enabled) {
      if (
        (item.threshold_direction === "above" && price.usd >= item.threshold_value) ||
        (item.threshold_direction === "below" && price.usd <= item.threshold_value)
      ) {
        lines.push("", `🔔 Threshold alert triggered! Price is ${item.threshold_direction} $${item.threshold_value}`);
      }
    }
    // Check percent alert
    if (item.percent_alert_enabled && Math.abs(price.usd_24h_change) >= item.percent_value) {
      lines.push("", `🔔 Percent alert triggered! ${formatChange(price.usd_24h_change)} in 24h`);
    }
  }

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard([
      [inlineButton("🔄 Refresh", `price:detail:${ticker}`)],
      [inlineButton("⬅️ Back to prices", "price:menu")],
    ]),
  });
});

// Handle /price command directly
composer.command("price", async (ctx) => {
  const text = ctx.message?.text;
  if (!text) return;
  const args = text.split(/\s+/).slice(1);
  const userId = ctx.from?.id;
  if (!userId) return;

  if (args.length === 0) {
    // Show all watchlist prices
    const items = await getWatchlist(userId);
    if (items.length === 0) {
      await ctx.reply(
        "Your watchlist is empty. Add some coins first, then check prices.",
        { reply_markup: inlineKeyboard([[inlineButton("➕ Add coins", "watchlist:show"), inlineButton("⬅️ Back to menu", "menu:main")]]) },
      );
      return;
    }
    const coinIds = items.map((i) => tickerToCoinId(i.ticker_symbol)).filter(Boolean) as string[];
    const prices = await fetchPrices(coinIds);
    const lines = ["💰 Your watchlist:\n"];
    for (const item of items) {
      const coinId = tickerToCoinId(item.ticker_symbol);
      const price = coinId ? prices[coinId] : null;
      if (price) {
        lines.push(`${item.display_name}: ${formatPrice(price.usd)} (${formatChange(price.usd_24h_change)})`);
      } else {
        lines.push(`${item.display_name}: price unavailable`);
      }
    }
    await ctx.reply(lines.join("\n"));
    return;
  }

  const ticker = args[0].toUpperCase();
  const coinId = tickerToCoinId(ticker);
  if (!coinId) {
    await ctx.reply(`I don't recognize "${ticker}". Try a known ticker like BTC, ETH, or SOL.`);
    return;
  }

  const price = await fetchPrice(coinId);
  if (!price) {
    await ctx.reply(`Couldn't fetch the price for ${ticker}. Try again in a moment.`);
    return;
  }

  await ctx.reply(
    `${tickerDisplayName(ticker)} (${ticker}): ${formatPrice(price.usd)} (${formatChange(price.usd_24h_change)})`
  );
});

export default composer;
