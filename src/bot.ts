import { Bot, GrammyError, HttpError, webhookCallback } from "grammy";
import { D1Database, ScheduledController } from "@cloudflare/workers-types";
import { CRON_LEVEL_UP_EVENTS, CRON_FREE_GAMES } from "./cron-triggers.js";
import { fetchFreeGames } from "./game-finder.js";
import { SubscriptionType, getAllSubscribers } from "./db-helpers.js";
import { escapeMarkdownV2IgnoreLinks as escMD } from "./md-helpers.js";
import { isDevRequest, performDevActions } from "./dev-tools.js";
import { createBot } from "./bot-factory.js";


export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
  DEV_API_KEY: string;
}

const messageOptions = {
  parse_mode: 'MarkdownV2' as const,
  link_preview_options: { is_disabled: true } as const,
};


export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const bot = createBot(env);
    
    if (isDevRequest(request)) {
      return performDevActions(request, bot, env);
    }
    
    return webhookCallback(bot, "cloudflare-mod")(request);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: any): Promise<void> {
    const bot = createBot(env);

    switch (controller.cron) {
      case CRON_LEVEL_UP_EVENTS:  ctx.waitUntil(sendLevelUpEvents(bot, env));   break;
      case CRON_FREE_GAMES:       ctx.waitUntil(sendFreeGames(bot, env));       break;
      default:                    console.log(`No scheduled task for cron: ${controller.cron}`);
    }
  },
};

export async function safeReply(ctx: any, text: string) {
    try {
        await ctx.reply(text, messageOptions);
    } catch (err) {
      if (err instanceof GrammyError) {
            // Handle Telegram-specific errors (e.g., blocked bot, invalid chat ID)
            console.error("Telegram error:", err.message);
            await ctx.reply(escMD("⚠️ An error occurred while sending the message."), messageOptions);
        } else if (err instanceof HttpError) {
            // Handle HTTP-related errors (e.g., network issues)
            console.error("HTTP error:", err.message);
            await ctx.reply(escMD("⚠️ Network error. Please try again later."), messageOptions);
        } else {
            // Handle any other unexpected errors
            console.error("Unknown error:", err);
            await ctx.reply(escMD("❌ An unexpected error occurred."), messageOptions);
        }
    }
}

export async function sendLevelUpEvents(bot: Bot, env: Env, debugOnly = false) {
  //TODO: implement event fetching
  const events = escMD("Scheduled message:\n⚠️ Event reminders are currently in development and not yet available.");
  await sendToSubscribers(bot, env.DB, SubscriptionType.EVENTS_LUL, events, debugOnly);
}

export async function sendFreeGames(bot: Bot, env: Env, debugOnly = false) {
  const games = await fetchFreeGames();
  await sendToSubscribers(bot, env.DB, SubscriptionType.FREE_GAMES, games, debugOnly);
}

async function sendToSubscribers(
  bot: Bot,
  db: D1Database,
  subType: SubscriptionType,
  text: string,
  debugOnly = false,
) {
  const subs = await getAllSubscribers(db, subType, debugOnly);

  await Promise.all(subs.map(async (row) => {
    try {
      await sendMessage(bot, String(row.id), text);
    } catch (err) {
      console.error(`Failed to send to chatId ${row.id}:`, err);
    }
  }));
}

async function sendMessage(bot: Bot, chatId: string, text: string) {
  await bot.api.sendMessage(chatId, text, messageOptions);
}
