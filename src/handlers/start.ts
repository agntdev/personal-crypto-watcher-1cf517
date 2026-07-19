import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  inlineButton,
  inlineKeyboard,
  registerMainMenuItem,
} from "../toolkit/index.js";
import {
  getOrCreateUserProfile,
  addWatchlistItem,
  tickerDisplayName,
  registerUser,
} from "../crypto.js";

// Register main menu buttons for features
registerMainMenuItem({ label: "📋 Watchlist", data: "watchlist:show", order: 10 });
registerMainMenuItem({ label: "💰 Price", data: "price:menu", order: 20 });
registerMainMenuItem({ label: "⚙️ Settings", data: "settings:show", order: 30 });
registerMainMenuItem({ label: "📊 Summary", data: "summary:show", order: 40 });

const composer = new Composer<Ctx>();

const WELCOME =
  "👋 Welcome! Track crypto prices and get alerts — right here in Telegram.\n\n" +
  "Tap a button below to get started.";

function mainMenuKeyboard() {
  return inlineKeyboard([
    [inlineButton("📋 Watchlist", "watchlist:show"), inlineButton("💰 Price", "price:menu")],
    [inlineButton("⚙️ Settings", "settings:show"), inlineButton("📊 Summary", "summary:show")],
    [inlineButton("❓ Help", "menu:help")],
  ]);
}

composer.command("start", async (ctx) => {
  const userId = ctx.from?.id;
  const name = ctx.from?.first_name ?? "there";
  if (userId) {
    await getOrCreateUserProfile(userId, name);
    await registerUser(userId);
  }
  await ctx.reply(WELCOME, { reply_markup: mainMenuKeyboard() });
});

composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(WELCOME, { reply_markup: mainMenuKeyboard() });
});

// Quick-add buttons: add BTC/ETH/TON to watchlist
composer.callbackQuery(/^quickadd:(.+)$/, async (ctx) => {
  const match = ctx.match;
  if (!match) return;
  const ticker = match[1].toUpperCase();
  const userId = ctx.from?.id;
  if (!userId) return;

  await ctx.answerCallbackQuery();
  const item = await addWatchlistItem(userId, ticker, tickerDisplayName(ticker));
  await ctx.editMessageText(
    `✅ ${item.display_name} (${item.ticker_symbol}) added to your watchlist!`,
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
  );
});

export default composer;
