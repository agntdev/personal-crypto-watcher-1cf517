import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  inlineButton,
  inlineKeyboard,
  registerMainMenuItem,
} from "../toolkit/index.js";
import {
  getOrCreateUserProfile,
  getWatchlist,
  fetchPrices,
  tickerToCoinId,
  tickerDisplayName,
  getUserAlertsInRange,
  writeRecord,
  userProfileKey,
  now,
} from "../crypto.js";

registerMainMenuItem({ label: "📊 Summary", data: "summary:show", order: 40 });

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

composer.callbackQuery("summary:show", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCallbackQuery();

  const profile = await getOrCreateUserProfile(userId, ctx.from?.first_name ?? "there");
  const items = await getWatchlist(userId);

  if (items.length === 0) {
    await ctx.editMessageText(
      "📊 Morning Summary\n\n" +
      `Status: ${profile.summary_enabled ? "ON" : "OFF"}\n` +
      `Delivery time: ${profile.summary_time} (${profile.timezone})\n\n` +
      "Your watchlist is empty — add some coins to get a daily summary.",
      {
        reply_markup: inlineKeyboard([
          [inlineButton(profile.summary_enabled ? "🔴 Turn OFF" : "🟢 Turn ON", "summary:toggle")],
          [inlineButton("⏰ Change time", "summary:time")],
          [inlineButton("➕ Add coins", "watchlist:show")],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
    return;
  }

  // Fetch current prices
  const coinIds = items.map((i) => tickerToCoinId(i.ticker_symbol)).filter(Boolean) as string[];
  const prices = await fetchPrices(coinIds);

  // Get yesterday's alerts for the user
  const oneDayAgo = now().getTime() - 24 * 60 * 60 * 1000;
  const alerts = await getUserAlertsInRange(userId, oneDayAgo);

  const lines = [
    "📊 Morning Summary\n",
    `Status: ${profile.summary_enabled ? "ON" : "OFF"}`,
    `Delivery: ${profile.summary_time} (${profile.timezone})`,
    "",
    "Current prices:",
  ];

  for (const item of items) {
    const coinId = tickerToCoinId(item.ticker_symbol);
    const price = coinId ? prices[coinId] : null;
    if (price) {
      lines.push(`${item.display_name}: ${formatPrice(price.usd)} (${formatChange(price.usd_24h_change)})`);
    } else {
      lines.push(`${item.display_name}: price unavailable`);
    }
  }

  if (alerts.length > 0) {
    lines.push("", `${alerts.length} alert${alerts.length === 1 ? "" : "s"} in the last 24h:`);
    for (const alert of alerts.slice(0, 5)) {
      const time = new Date(alert.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      lines.push(`• ${alert.ticker}: ${alert.alert_type} (${formatChange(alert.percent_change)}) at ${time}`);
    }
    if (alerts.length > 5) {
      lines.push(`  ...and ${alerts.length - 5} more`);
    }
  } else {
    lines.push("", "No alerts triggered in the last 24h.");
  }

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard([
      [inlineButton(profile.summary_enabled ? "🔴 Turn OFF" : "🟢 Turn ON", "summary:toggle")],
      [inlineButton("⏰ Change time", "summary:time")],
      [inlineButton("🔄 Refresh", "summary:show")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery("summary:toggle", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCallbackQuery();

  const profile = await getOrCreateUserProfile(userId, ctx.from?.first_name ?? "there");
  profile.summary_enabled = !profile.summary_enabled;
  await writeRecord(userProfileKey(userId), profile);

  await ctx.editMessageText(
    `📊 Morning summary is now ${profile.summary_enabled ? "ON" : "OFF"}.`,
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to summary", "summary:show")]]) },
  );
});

composer.callbackQuery("summary:time", async (ctx) => {
  await ctx.answerCallbackQuery();
  const times = [
    "06:00", "06:30", "07:00", "07:30", "08:00", "08:30",
    "09:00", "09:30", "10:00", "10:30", "11:00", "12:00",
  ];
  const buttons = times.map((t) => [inlineButton(t, `summary:settime:${t}`)]);
  buttons.push([inlineButton("⬅️ Back to summary", "summary:show")]);
  await ctx.editMessageText(
    "⏰ Pick when you'd like your morning summary:",
    { reply_markup: inlineKeyboard(buttons) },
  );
});

composer.callbackQuery(/^summary:settime:([^:]+)$/, async (ctx) => {
  const match = ctx.match;
  if (!match) return;
  const time = match[1];
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCallbackQuery();

  const profile = await getOrCreateUserProfile(userId, ctx.from?.first_name ?? "there");
  profile.summary_time = time;
  await writeRecord(userProfileKey(userId), profile);

  await ctx.editMessageText(`✅ Morning summary set to ${time} (${profile.timezone}).`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to summary", "summary:show")]]),
  });
});

// Handle /summary command directly
composer.command("summary", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const profile = await getOrCreateUserProfile(userId, ctx.from?.first_name ?? "there");
  await ctx.reply(
    `📊 Morning Summary: ${profile.summary_enabled ? "ON" : "OFF"} at ${profile.summary_time} (${profile.timezone})\n\n` +
    "Tap the button to view details or change settings.",
    { reply_markup: inlineKeyboard([[inlineButton("📊 View summary", "summary:show")]]) },
  );
});

export default composer;
