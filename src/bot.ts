import { Bot, webhookCallback } from "grammy";
import { subscribe, unsubscribe, getAllSubscribers, countSubscribers } from "./db-helpers.js";
import { fetchFreeGames } from "./game-finder.js";
import { D1Database, ScheduledController } from "@cloudflare/workers-types";


export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
  FREE_GAMES_CHAT_ID: string;
  EVENTS_CHAT_ID: string;
}

interface FreeGameRow {
  chat_id: number;
}

interface EventRow {
  chat_id: number;
}


const freeGamesTable = "freegames_subscriptions";
const eventsTable = "events_subscriptions";
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
    return webhookCallback(bot, "cloudflare-mod")(request);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: any): Promise<void> {
    const bot = createBot(env);
    ctx.waitUntil(sendFreeGames(bot, env));
  },
};


function createBot(env: Env): Bot {
  const bot = new Bot(env.BOT_TOKEN);

  bot.command("start", async (ctx) => await ctx.reply("Welcome! Up and running.\nUse /freegames to get the latest free games.\nUse /start_freegames to subscribe to free game notifications.\nUse /stop_freegames to unsubscribe."));

  bot.command("freegames", async (ctx) => {
    const games = await fetchFreeGames();
    await ctx.reply(games, messageOptions);
  });

  bot.command("debug_sendgames", async (ctx) => {
    sendFreeGames(bot, env);
    let freeGameSubsCount = await countSubscribers(env.DB, freeGamesTable);
    await ctx.reply(`Sent free games to ${freeGameSubsCount} subscribed chats.`);
  });

  bot.command("start_freegames", async (ctx) => {
    await subscribe(ctx, env.DB, freeGamesTable, "free game");
  });

  bot.command("stop_freegames", async (ctx) => {
    await unsubscribe(ctx, env.DB, freeGamesTable,"free game");
  });

  bot.command("start_events", async (ctx) => {
    await subscribe(ctx, env.DB, eventsTable, "event");
  });

  bot.command("stop_events", async (ctx) => {
    await unsubscribe(ctx, env.DB, eventsTable, "event");
  });

  return bot;
}


async function sendFreeGames(bot: Bot, env: Env) {
  const games = await fetchFreeGames();
  await sendToSubscribers<FreeGameRow>(bot, env.DB, freeGamesTable, games);
}

async function sendToSubscribers<T extends { chat_id: number }>(
  bot: Bot,
  db: D1Database,
  table: string,
  text: string
) {
  const subs = await getAllSubscribers<T>(db, table);

  await Promise.all(subs.map(async (row) => {
    try {
      await sendMessage(bot, String(row.chat_id), text);
    } catch (err) {
      console.error(`Failed to send to chatId ${row.chat_id}:`, err);
    }
  }));
}

async function sendMessage(bot: Bot, chatId: string, text: string) {
  await bot.api.sendMessage(chatId, text, messageOptions);
}
