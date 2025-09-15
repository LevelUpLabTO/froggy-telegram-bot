import { Bot, webhookCallback } from "grammy";
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
    await ctx.reply(games, {
      parse_mode: 'MarkdownV2',
      link_preview_options: { is_disabled: true }
    });
  });

  bot.command("debug_sendgames", async (ctx) => {
    sendFreeGames(bot, env);
    let freeGameSubsCount = await countFreeGamesSubscribers(env);
    await ctx.reply(`Sent free games to ${freeGameSubsCount} subscribed chats.`);
  });

  bot.command("start_freegames", async (ctx) => {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO freegames_subscriptions (chat_id) VALUES (?)"
    ).bind(ctx.chat.id).run();
    await ctx.reply("You have been registered to receive free game notifications!");
  });

  bot.command("stop_freegames", async (ctx) => {
    await env.DB.prepare(
      "DELETE FROM freegames_subscriptions WHERE chat_id = ?"
    ).bind(ctx.chat.id).run();
    await ctx.reply("You have been unsubscribed from free game notifications.");
  });

  bot.command("start_events", async (ctx) => {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO events_subscriptions (chat_id) VALUES (?)"
    ).bind(ctx.chat.id).run();
    await ctx.reply("You have been registered to receive event notifications!");
  });

  bot.command("stop_events", async (ctx) => {
    await env.DB.prepare(
      "DELETE FROM events_subscriptions WHERE chat_id = ?"
    ).bind(ctx.chat.id).run();
    await ctx.reply("You have been unsubscribed from event notifications.");
  });

  return bot;
}


async function sendFreeGames(bot: Bot, env: Env) {
  const games = await fetchFreeGames();

  const { results } = await env.DB.prepare(
    "SELECT chat_id FROM freegames_subscriptions"
  ).all<FreeGameRow>();

  await Promise.all(results.map(async (row) => {
    try {
      await sendMessage(bot, String(row.chat_id), games);
    } catch (err) {
      console.error(`Failed to send to chatId ${row.chat_id}:`, err);
    }
  }));
}


async function sendMessage(bot: Bot, chatId: string, text: string) {
  await bot.api.sendMessage(chatId, text, {
    parse_mode: 'MarkdownV2',
    link_preview_options: { is_disabled: true }
  });
}

async function countFreeGamesSubscribers(env: Env): Promise<number> {
  const { results } = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM freegames_subscriptions"
  ).all<{ count: number }>();

  return results[0]?.count ?? 0;
}
