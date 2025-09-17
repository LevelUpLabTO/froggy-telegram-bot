import { Bot, GrammyError, HttpError, webhookCallback } from "grammy";
import { D1Database, ScheduledController } from "@cloudflare/workers-types";
import { SubscriptionType, subscribe, unsubscribe, getAllSubscribers, countSubscribers } from "./db-helpers.js";
import { fetchFreeGames } from "./game-finder.js";
import { WELCOME_MESSAGE, HELP_MESSAGE } from "./messages.js";
import { CRON_LEVEL_UP_EVENTS, CRON_FREE_GAMES } from "./cron-triggers.js";
import { escapeMarkdownV2IgnoreLinks as escMD } from "./md-helpers.js";
import { isDevRequest, performDevActions } from "./dev-tools.js";


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


function createBot(env: Env): Bot {
  const bot = new Bot(env.BOT_TOKEN);

  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`An error occurred during bot update ${ctx.update.update_id}:`);
    const e = err.error;

    if (e instanceof GrammyError) {
      console.error("Request error:", e.description);
    } else if (e instanceof HttpError) {
      console.error("Cannot connect to Telegram servers:", e);
    } else {
      console.error("Unknown error:", e);
    }

    ctx.reply("An error occurred while processing your request.");
  });

  bot.command("start", async (ctx) => {
      await ctx.reply(WELCOME_MESSAGE, messageOptions);
  });

  bot.command("help", async (ctx) => {
      await ctx.reply(HELP_MESSAGE, messageOptions);
  });

  bot.command("freegames", async (ctx) => {
    const games = await fetchFreeGames();
    await ctx.reply(games, messageOptions);
  });

  bot.command("start_freegames", async (ctx) => {
    await subscribe(ctx, env.DB, SubscriptionType.FREE_GAMES);
  });

  bot.command("stop_freegames", async (ctx) => {
    await unsubscribe(ctx, env.DB, SubscriptionType.FREE_GAMES);
  });

  bot.command("events", async (ctx) => {
    await ctx.reply(escMD("⚠️ Event reminders are currently in development and not yet available."), messageOptions);
  });

  bot.command("start_events", async (ctx) => {
    await subscribe(ctx, env.DB, SubscriptionType.EVENTS_LUL);
  });

  bot.command("stop_events", async (ctx) => {
    await unsubscribe(ctx, env.DB, SubscriptionType.EVENTS_LUL);
  });

  return bot;
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
