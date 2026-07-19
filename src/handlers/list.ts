import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  inlineButton,
  inlineKeyboard,
  registerMainMenuItem,
} from "../toolkit/index.js";
import {
  getWatchlist,
  removeWatchlistItem,
  updateWatchlistItem,
  KNOWN_TICKERS,
  tickerDisplayName,
} from "../crypto.js";

registerMainMenuItem({ label: "📋 Watchlist", data: "watchlist:show", order: 10 });

const composer = new Composer<Ctx>();

function watchlistKeyboard(items: Array<{ ticker_symbol: string; display_name: string }>) {
  const rows = items.map((item) => [
    inlineButton(`${item.display_name} (${item.ticker_symbol})`, `wl:detail:${item.ticker_symbol}`),
    inlineButton("🗑", `wl:remove:${item.ticker_symbol}`),
  ]);
  rows.push([
    inlineButton("➕ Add ticker", "wl:add:prompt"),
  ]);
  rows.push([inlineButton("⬅️ Back to menu", "menu:main")]);
  return inlineKeyboard(rows);
}

composer.callbackQuery("watchlist:show", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCallbackQuery();

  const items = await getWatchlist(userId);
  if (items.length === 0) {
    await ctx.editMessageText(
      "Your watchlist is empty — tap ➕ Add to track your first crypto.",
      { reply_markup: watchlistKeyboard([]) },
    );
    return;
  }
  await ctx.editMessageText(
    `You're watching ${items.length} coin${items.length === 1 ? "" : "s"}:`,
    { reply_markup: watchlistKeyboard(items) },
  );
});

composer.callbackQuery("wl:add:prompt", async (ctx) => {
  await ctx.answerCallbackQuery();
  const quickButtons = [
    inlineButton("BTC", "quickadd:BTC"),
    inlineButton("ETH", "quickadd:ETH"),
    inlineButton("TON", "quickadd:TON"),
  ];
  const moreButtons = KNOWN_TICKERS.filter((t) => !["BTC", "ETH", "TON"].includes(t))
    .slice(0, 10)
    .map((t) => inlineButton(t, `quickadd:${t}`));

  await ctx.editMessageText(
    "Pick a coin to add, or type its ticker (e.g. SOL):",
    {
      reply_markup: inlineKeyboard([
        quickButtons,
        moreButtons.slice(0, 5),
        moreButtons.slice(5, 10),
        [inlineButton("⬅️ Back to watchlist", "watchlist:show")],
      ]),
    },
  );
});

// Watchlist item detail view
composer.callbackQuery(/^wl:detail:(.+)$/, async (ctx) => {
  const match = ctx.match;
  if (!match) return;
  const ticker = match[1].toUpperCase();
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCallbackQuery();

  const items = await getWatchlist(userId);
  const item = items.find((i) => i.ticker_symbol === ticker);
  if (!item) {
    await ctx.editMessageText("That ticker is no longer in your watchlist.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to watchlist", "watchlist:show")]]),
    });
    return;
  }

  const lines = [
    `📊 ${item.display_name} (${item.ticker_symbol})`,
    "",
    `Threshold alerts: ${item.threshold_alert_enabled ? `ON (${item.threshold_direction} $${item.threshold_value})` : "OFF"}`,
    `Percent alerts: ${item.percent_alert_enabled ? `ON (${item.percent_value}%)` : "OFF"}`,
    `Check interval: ${item.interval} min`,
  ];

  const buttons = [
    [
      inlineButton(
        item.threshold_alert_enabled ? "🔴 Threshold OFF" : "🟢 Threshold ON",
        `wl:toggle:threshold:${ticker}`,
      ),
    ],
    [
      inlineButton(
        item.percent_alert_enabled ? "🔴 Percent OFF" : "🟢 Percent ON",
        `wl:toggle:percent:${ticker}`,
      ),
    ],
    [inlineButton("🗑 Remove", `wl:confirmremove:${ticker}`)],
    [inlineButton("⬅️ Back to watchlist", "watchlist:show")],
  ];

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard(buttons),
  });
});

// Toggle threshold alerts
composer.callbackQuery(/^wl:toggle:threshold:(.+)$/, async (ctx) => {
  const match = ctx.match;
  if (!match) return;
  const ticker = match[1].toUpperCase();
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCallbackQuery();

  const items = await getWatchlist(userId);
  const item = items.find((i) => i.ticker_symbol === ticker);
  if (!item) return;

  await updateWatchlistItem(userId, ticker, {
    threshold_alert_enabled: !item.threshold_alert_enabled,
    threshold_value: item.threshold_alert_enabled ? 0 : item.last_known_price * 1.05,
    threshold_direction: "above",
  });

  // Re-show detail
  const updatedItems = await getWatchlist(userId);
  const updatedItem = updatedItems.find((i) => i.ticker_symbol === ticker);
  if (!updatedItem) return;

  const lines = [
    `📊 ${updatedItem.display_name} (${updatedItem.ticker_symbol})`,
    "",
    `Threshold alerts: ${updatedItem.threshold_alert_enabled ? `ON (${updatedItem.threshold_direction} $${updatedItem.threshold_value.toFixed(2)})` : "OFF"}`,
    `Percent alerts: ${updatedItem.percent_alert_enabled ? `ON (${updatedItem.percent_value}%)` : "OFF"}`,
    `Check interval: ${updatedItem.interval} min`,
  ];

  const buttons = [
    [
      inlineButton(
        updatedItem.threshold_alert_enabled ? "🔴 Threshold OFF" : "🟢 Threshold ON",
        `wl:toggle:threshold:${ticker}`,
      ),
    ],
    [
      inlineButton(
        updatedItem.percent_alert_enabled ? "🔴 Percent OFF" : "🟢 Percent ON",
        `wl:toggle:percent:${ticker}`,
      ),
    ],
    [inlineButton("🗑 Remove", `wl:confirmremove:${ticker}`)],
    [inlineButton("⬅️ Back to watchlist", "watchlist:show")],
  ];

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard(buttons),
  });
});

// Toggle percent alerts
composer.callbackQuery(/^wl:toggle:percent:(.+)$/, async (ctx) => {
  const match = ctx.match;
  if (!match) return;
  const ticker = match[1].toUpperCase();
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCallbackQuery();

  const items = await getWatchlist(userId);
  const item = items.find((i) => i.ticker_symbol === ticker);
  if (!item) return;

  await updateWatchlistItem(userId, ticker, {
    percent_alert_enabled: !item.percent_alert_enabled,
  });

  // Re-show detail
  const updatedItems = await getWatchlist(userId);
  const updatedItem = updatedItems.find((i) => i.ticker_symbol === ticker);
  if (!updatedItem) return;

  const lines = [
    `📊 ${updatedItem.display_name} (${updatedItem.ticker_symbol})`,
    "",
    `Threshold alerts: ${updatedItem.threshold_alert_enabled ? `ON (${updatedItem.threshold_direction} $${updatedItem.threshold_value.toFixed(2)})` : "OFF"}`,
    `Percent alerts: ${updatedItem.percent_alert_enabled ? `ON (${updatedItem.percent_value}%)` : "OFF"}`,
    `Check interval: ${updatedItem.interval} min`,
  ];

  const buttons = [
    [
      inlineButton(
        updatedItem.threshold_alert_enabled ? "🔴 Threshold OFF" : "🟢 Threshold ON",
        `wl:toggle:threshold:${ticker}`,
      ),
    ],
    [
      inlineButton(
        updatedItem.percent_alert_enabled ? "🔴 Percent OFF" : "🟢 Percent ON",
        `wl:toggle:percent:${ticker}`,
      ),
    ],
    [inlineButton("🗑 Remove", `wl:confirmremove:${ticker}`)],
    [inlineButton("⬅️ Back to watchlist", "watchlist:show")],
  ];

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard(buttons),
  });
});

// Confirm remove
composer.callbackQuery(/^wl:confirmremove:(.+)$/, async (ctx) => {
  const match = ctx.match;
  if (!match) return;
  const ticker = match[1].toUpperCase();
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    `Remove ${ticker} from your watchlist?`,
    {
      reply_markup: inlineKeyboard([
        [
          inlineButton("✅ Yes", `wl:remove:${ticker}`),
          inlineButton("❌ No", `wl:detail:${ticker}`),
        ],
      ]),
    },
  );
});

// Remove from watchlist
composer.callbackQuery(/^wl:remove:(.+)$/, async (ctx) => {
  const match = ctx.match;
  if (!match) return;
  const ticker = match[1].toUpperCase();
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCallbackQuery();

  const removed = await removeWatchlistItem(userId, ticker);
  if (removed) {
    await ctx.editMessageText(`${ticker} removed from your watchlist.`, {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to watchlist", "watchlist:show")]]),
    });
  } else {
    await ctx.editMessageText("That ticker wasn't in your watchlist.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to watchlist", "watchlist:show")]]),
    });
  }
});

// Handle /list command directly
composer.command("list", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const items = await getWatchlist(userId);
  if (items.length === 0) {
    await ctx.reply(
      "Your watchlist is empty — tap a button below to add your first coin.",
      { reply_markup: watchlistKeyboard([]) },
    );
    return;
  }
  await ctx.reply(
    `You're watching ${items.length} coin${items.length === 1 ? "" : "s"}:`,
    { reply_markup: watchlistKeyboard(items) },
  );
});

export default composer;
