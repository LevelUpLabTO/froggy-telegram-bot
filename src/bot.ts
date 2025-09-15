import { Bot, webhookCallback } from "grammy";
import { fetchFreeGames } from "./game-finder.js";
import { ScheduledController } from "@cloudflare/workers-types";


export interface Env {
  BOT_TOKEN: string;
  FREE_GAMES_CHAT_ID: string;
  EVENTS_CHAT_ID: string;
}


export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    
    const bot = createBot(env.BOT_TOKEN);
    return webhookCallback(bot, "cloudflare-mod")(request);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: any): Promise<void> {
    const bot = createBot(env.BOT_TOKEN);
    ctx.waitUntil(sendFreeGames(bot, env.FREE_GAMES_CHAT_ID));
  },
};


function createBot(botToken: string): Bot {
  const bot = new Bot(botToken);

  bot.command("start", async (ctx) => await ctx.reply("Welcome! Up and running."));
  bot.command("freegames", async (ctx) => {
    const games = await fetchFreeGames();
    await ctx.reply(games, {
      parse_mode: 'MarkdownV2',
      link_preview_options: { is_disabled: true }
    });
  });
  bot.command("sub_freegames", async (ctx) => {
    // TODO: Save chatId to database or file for future messages
    console.log(`Free games registration request for chatId: ${ctx.chatId}`);
    await ctx.reply("You have been registered to receive free game notifications!");
  });
  bot.command("sub_events", async (ctx) => {
    // TODO: Save chatId to database or file for future messages
    console.log(`Events registration request for chatId: ${ctx.chatId}`);
    await ctx.reply("You have been registered to receive event notifications!");
  });

  // Handle other messages
  bot.on("message", async (ctx) =>
  {
    console.log(`Msg: ${ctx.message.text} | ChatId: ${ctx.chatId}`);
    //await ctx.reply("Message received!")
  });

  return bot;
}


async function sendFreeGames(bot: Bot, chatId: string) {
  const games = await fetchFreeGames();
      await sendMessage(bot, chatId, games);
}


async function sendMessage(bot: Bot, chatId: string, text: string) {
  await bot.api.sendMessage(chatId, text, {
    parse_mode: 'MarkdownV2',
    link_preview_options: { is_disabled: true }
  });
}
