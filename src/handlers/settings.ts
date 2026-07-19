import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  inlineButton,
  inlineKeyboard,
  registerMainMenuItem,
} from "../toolkit/index.js";
import {
  getOrCreateUserProfile,
  writeRecord,
  userProfileKey,
  type UserProfile,
} from "../crypto.js";

registerMainMenuItem({ label: "⚙️ Settings", data: "settings:show", order: 30 });

const composer = new Composer<Ctx>();

const TIMEZONES = [
  { label: "UTC", value: "UTC" },
  { label: "US Eastern (ET)", value: "America/New_York" },
  { label: "US Pacific (PT)", value: "America/Los_Angeles" },
  { label: "Europe London (GMT)", value: "Europe/London" },
  { label: "Europe Berlin (CET)", value: "Europe/Berlin" },
  { label: "Asia Tokyo (JST)", value: "Asia/Tokyo" },
  { label: "Asia Shanghai (CST)", value: "Asia/Shanghai" },
  { label: "Asia Singapore (SGT)", value: "Asia/Singapore" },
  { label: "Asia Dubai (GST)", value: "Asia/Dubai" },
  { label: "Australia Sydney (AEST)", value: "Australia/Sydney" },
];

function settingsMenuKeyboard(profile: UserProfile) {
  return inlineKeyboard([
    [inlineButton(`🌍 Timezone: ${profile.timezone}`, "settings:tz")],
    [inlineButton(`🔇 Quiet hours: ${profile.quiet_hours_start}:00–${profile.quiet_hours_end}:00`, "settings:quiet")],
    [inlineButton(`📊 Summary: ${profile.summary_enabled ? "ON" : "OFF"} (${profile.summary_time})`, "settings:summary")],
    [inlineButton(`⏱ Cooldown: ${profile.cooldown_duration}min`, "settings:cooldown")],
    [inlineButton("⬅️ Back to menu", "menu:main")],
  ]);
}

composer.callbackQuery("settings:show", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCallbackQuery();

  const profile = await getOrCreateUserProfile(userId, ctx.from?.first_name ?? "there");
  await ctx.editMessageText(
    "⚙️ Your settings:\n\nTap any option to change it.",
    { reply_markup: settingsMenuKeyboard(profile) },
  );
});

// Timezone picker
composer.callbackQuery("settings:tz", async (ctx) => {
  await ctx.answerCallbackQuery();
  const buttons = TIMEZONES.map((tz) => [inlineButton(tz.label, `settings:tz:${tz.value}`)]);
  buttons.push([inlineButton("⬅️ Back to settings", "settings:show")]);
  await ctx.editMessageText(
    "🌍 Pick your timezone:",
    { reply_markup: inlineKeyboard(buttons) },
  );
});

composer.callbackQuery(/^settings:tz:(.+)$/, async (ctx) => {
  const match = ctx.match;
  if (!match) return;
  const tz = decodeURIComponent(match[1]);
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCallbackQuery();

  const profile = await getOrCreateUserProfile(userId, ctx.from?.first_name ?? "there");
  profile.timezone = tz;
  await writeRecord(userProfileKey(userId), profile);

  await ctx.editMessageText(`✅ Timezone set to ${tz}.`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to settings", "settings:show")]]),
  });
});

// Quiet hours
composer.callbackQuery("settings:quiet", async (ctx) => {
  await ctx.answerCallbackQuery();
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const startButtons = hours.map((h) => [inlineButton(`${h}:00`, `settings:quietstart:${h}`)]);
  startButtons.push([inlineButton("⬅️ Back to settings", "settings:show")]);
  await ctx.editMessageText(
    "🔇 Pick the START hour for quiet hours (no alerts during this period):",
    { reply_markup: inlineKeyboard(startButtons) },
  );
});

composer.callbackQuery(/^settings:quietstart:(\d+)$/, async (ctx) => {
  const match = ctx.match;
  if (!match) return;
  const startHour = parseInt(match[1], 10);
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCallbackQuery();

  const profile = await getOrCreateUserProfile(userId, ctx.from?.first_name ?? "there");
  profile.quiet_hours_start = startHour;
  await writeRecord(userProfileKey(userId), profile);

  // Now ask for end hour
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const endButtons = hours.map((h) => [inlineButton(`${h}:00`, `settings:quietend:${h}`)]);
  endButtons.push([inlineButton("⬅️ Back to settings", "settings:show")]);
  await ctx.editMessageText(
    `🔇 Quiet hours start at ${startHour}:00. Now pick the END hour:`,
    { reply_markup: inlineKeyboard(endButtons) },
  );
});

composer.callbackQuery(/^settings:quietend:(\d+)$/, async (ctx) => {
  const match = ctx.match;
  if (!match) return;
  const endHour = parseInt(match[1], 10);
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCallbackQuery();

  const profile = await getOrCreateUserProfile(userId, ctx.from?.first_name ?? "there");
  profile.quiet_hours_end = endHour;
  await writeRecord(userProfileKey(userId), profile);

  await ctx.editMessageText(`✅ Quiet hours set to ${profile.quiet_hours_start}:00–${endHour}:00.`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to settings", "settings:show")]]),
  });
});

// Summary toggle
composer.callbackQuery("settings:summary", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCallbackQuery();

  const profile = await getOrCreateUserProfile(userId, ctx.from?.first_name ?? "there");
  profile.summary_enabled = !profile.summary_enabled;
  await writeRecord(userProfileKey(userId), profile);

  await ctx.editMessageText(
    `📊 Morning summary is now ${profile.summary_enabled ? "ON" : "OFF"}.`,
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to settings", "settings:show")]]) },
  );
});

// Cooldown picker
composer.callbackQuery("settings:cooldown", async (ctx) => {
  await ctx.answerCallbackQuery();
  const options = [
    { label: "30 min", value: 30 },
    { label: "1 hour", value: 60 },
    { label: "2 hours", value: 120 },
    { label: "4 hours", value: 240 },
    { label: "6 hours", value: 360 },
    { label: "12 hours", value: 720 },
  ];
  const buttons = options.map((o) => [inlineButton(o.label, `settings:cd:${o.value}`)]);
  buttons.push([inlineButton("⬅️ Back to settings", "settings:show")]);
  await ctx.editMessageText(
    "⏱ How long between alerts for the same coin?",
    { reply_markup: inlineKeyboard(buttons) },
  );
});

composer.callbackQuery(/^settings:cd:(\d+)$/, async (ctx) => {
  const match = ctx.match;
  if (!match) return;
  const minutes = parseInt(match[1], 10);
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.answerCallbackQuery();

  const profile = await getOrCreateUserProfile(userId, ctx.from?.first_name ?? "there");
  profile.cooldown_duration = minutes;
  await writeRecord(userProfileKey(userId), profile);

  const label = minutes >= 60 ? `${minutes / 60} hour${minutes > 60 ? "s" : ""}` : `${minutes} min`;
  await ctx.editMessageText(`✅ Alert cooldown set to ${label}.`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to settings", "settings:show")]]),
  });
});

// Handle /settings command directly
composer.command("settings", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const profile = await getOrCreateUserProfile(userId, ctx.from?.first_name ?? "there");
  await ctx.reply(
    "⚙️ Your settings:\n\nTap any option to change it.",
    { reply_markup: settingsMenuKeyboard(profile) },
  );
});

export default composer;
