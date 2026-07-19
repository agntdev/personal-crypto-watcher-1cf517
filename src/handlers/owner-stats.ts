import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import {
  computeAnalytics,
  getAllUserIds,
  getUserAlertsInRange,
  getWatchlist,
  now,
  tickerDisplayName,
} from "../crypto.js";

const OWNER_IDS = (process.env.OWNER_IDS ?? "").split(",").map(Number).filter(Boolean);

function isOwner(userId: number): boolean {
  if (OWNER_IDS.length === 0) return true; // no owner restriction in dev
  return OWNER_IDS.includes(userId);
}

const composer = new Composer<Ctx>();

composer.command("owner_stats", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (!isOwner(userId)) {
    await ctx.reply("This command is for the bot owner only.");
    return;
  }

  const analytics = await computeAnalytics();
  const userIds = await getAllUserIds();

  const lines = [
    "📊 Owner Analytics Dashboard\n",
    `Total users: ${analytics.total_users}`,
    `Active (30d): ${analytics.active_users_30d}`,
    "",
  ];

  // Top alerts by ticker
  const topTickers = Object.entries(analytics.top_alerts_by_ticker)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  if (topTickers.length > 0) {
    lines.push("Top alerts:");
    for (const [ticker, count] of topTickers) {
      lines.push(`  ${tickerDisplayName(ticker)}: ${count}`);
    }
  } else {
    lines.push("No alerts triggered yet.");
  }

  // Alert type breakdown
  lines.push("", "Alert types:");
  lines.push(`  Threshold: ${analytics.alert_type_counts.threshold ?? 0}`);
  lines.push(`  Percent: ${analytics.alert_type_counts.percent ?? 0}`);
  lines.push(`  Summary: ${analytics.alert_type_counts.summary ?? 0}`);

  await ctx.reply(lines.join("\n"), {
    reply_markup: inlineKeyboard([
      [inlineButton("🔄 Refresh", "owner:refresh")],
      [inlineButton("📋 User detail", "owner:users")],
    ]),
  });
});

composer.callbackQuery("owner:refresh", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId || !isOwner(userId)) {
    await ctx.answerCallbackQuery();
    return;
  }
  await ctx.answerCallbackQuery();

  const analytics = await computeAnalytics();
  const lines = [
    "📊 Owner Analytics Dashboard\n",
    `Total users: ${analytics.total_users}`,
    `Active (30d): ${analytics.active_users_30d}`,
    "",
  ];

  const topTickers = Object.entries(analytics.top_alerts_by_ticker)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  if (topTickers.length > 0) {
    lines.push("Top alerts:");
    for (const [ticker, count] of topTickers) {
      lines.push(`  ${tickerDisplayName(ticker)}: ${count}`);
    }
  } else {
    lines.push("No alerts triggered yet.");
  }

  lines.push("", "Alert types:");
  lines.push(`  Threshold: ${analytics.alert_type_counts.threshold ?? 0}`);
  lines.push(`  Percent: ${analytics.alert_type_counts.percent ?? 0}`);
  lines.push(`  Summary: ${analytics.alert_type_counts.summary ?? 0}`);

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard([
      [inlineButton("🔄 Refresh", "owner:refresh")],
      [inlineButton("📋 User detail", "owner:users")],
    ]),
  });
});

composer.callbackQuery("owner:users", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId || !isOwner(userId)) {
    await ctx.answerCallbackQuery();
    return;
  }
  await ctx.answerCallbackQuery();

  const userIds = await getAllUserIds();
  const lines = [`👥 Users (${userIds.length}):\n`];

  for (const uid of userIds.slice(0, 10)) {
    const watchlist = await getWatchlist(uid);
    const tickers = watchlist.map((w) => w.ticker_symbol).join(", ") || "empty";
    lines.push(`• ${uid}: ${tickers}`);
  }
  if (userIds.length > 10) {
    lines.push(`  ...and ${userIds.length - 10} more`);
  }

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to dashboard", "owner:refresh")],
    ]),
  });
});

export default composer;
