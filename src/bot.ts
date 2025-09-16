import { Bot, GrammyError, HttpError, webhookCallback } from "grammy";
import { D1Database, ScheduledController } from "@cloudflare/workers-types";
import { subscribe, unsubscribe, getAllSubscribers, countSubscribers } from "./db-helpers.js";
import { fetchFreeGames } from "./game-finder.js";
import { WELCOME_MESSAGE, HELP_MESSAGE } from "./messages.js";


export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
  DEV_API_KEY: string;
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
    
    if (isDevRequest(request)) {
      return performDevActions(request, env);
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

function isDevRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.pathname.startsWith("/dev");
}

async function performDevActions(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  const authHeader = request.headers.get("dev-api-key");
  if (authHeader !== env.DEV_API_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (url.pathname === "/dev/sendgames") {
    try {
      await sendFreeGames(createBot(env), env);
    }
    catch (err) {
      return new Response(`Error sending free games: ${err}`, { status: 500 });
    }
    
    const freeGameSubsCount = await countSubscribers(env.DB, freeGamesTable);
    return new Response(`Sent free games to ${freeGameSubsCount} subscribers.`);
  }
  
  return new Response("Dev command not found.", { status: 404 });
}
