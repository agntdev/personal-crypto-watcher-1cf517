import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

const HELP =
  "ℹ️ How this bot works:\n\n" +
  "• Tap 📋 Watchlist to add or remove coins\n" +
  "• Tap 💰 Price to check current prices\n" +
  "• Tap ⚙️ Settings to set quiet hours, timezone, and cooldowns\n" +
  "• Tap 📊 Summary to see your daily digest\n\n" +
  "Everything is just a tap away — no commands to remember.";

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

composer.command("help", async (ctx) => {
  await ctx.reply(HELP);
});

composer.callbackQuery("menu:help", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(HELP, { reply_markup: backToMenu });
});

export default composer;
