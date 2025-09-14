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
    console.log(`Request method: ${request.method}, URL: ${request.url}`);
    
    const bot = createBot(env.BOT_TOKEN);
    await webhookCallback(bot, "cloudflare-mod")(request);
    return new Response("OK", { status: 200 });
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: any): Promise<void> {
    const bot = createBot(env.BOT_TOKEN);
    sendFreeGames(bot, env.FREE_GAMES_CHAT_ID);
  },
};


function createBot(botToken: string): Bot {
  const bot = new Bot(botToken);

  bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));
  bot.command("freegames", async (ctx) => {
    const games = await fetchFreeGames();
    ctx.reply(games, {
      parse_mode: 'MarkdownV2',
      link_preview_options: { is_disabled: true }
    });
  });
  bot.command("sub_freegames", (ctx) => {
    // TODO: Save chatId to database or file for future messages
    console.log(`Free games registration request for chatId: ${ctx.chatId}`);
    ctx.reply("You have been registered to receive free game notifications!");
  });
  bot.command("sub_events", (ctx) => {
    // TODO: Save chatId to database or file for future messages
    console.log(`Events registration request for chatId: ${ctx.chatId}`);
    ctx.reply("You have been registered to receive event notifications!");
  });

  // Handle other messages
  bot.on("message", (ctx) =>
  {
    console.log(`Msg: ${ctx.message.text} | ChatId: ${ctx.chatId}`);
    //ctx.reply("Message received!")
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
